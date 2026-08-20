import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedCron } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";

// D/F4e (part 1): monthly delivery-due surfacing. Each day, flip SCHEDULED
// deliveries whose month has arrived (scheduledFor <= now) to DUE, under ACTIVE
// episodes only, and notify.
//
// SAFETY — selecting ONLY status: "SCHEDULED" is what makes every guarantee hold:
//  - CANCELLED / FULFILLED / already-DUE rows are not SCHEDULED, so they are
//    never selected (idempotent: safe to re-run; a delivery is never advanced
//    past DUE).
//  - The only write is FormulaDelivery.status SCHEDULED -> DUE. This cron never
//    touches FormulaEpisode.status, so it can never complete (or otherwise move)
//    an episode — completion stays the admin's 6th fulfilment in D/F4c.
//  - The episode relation filter keeps this to ACTIVE episodes (month 1 is born
//    DUE at confirmation, so it is never re-flipped here).
// DUE is a surfacing hint only; the admin can already fulfil any month.

export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();

  const due = await prisma.formulaDelivery.findMany({
    where: {
      status:       "SCHEDULED",
      scheduledFor: { lte: now },
      episode:      { status: "ACTIVE" },
    },
    select: {
      id: true, monthIndex: true,
      episode: {
        select: {
          monthsTotal: true, userId: true,
          user: { select: { name: true } },
        },
      },
    },
    take: 200,
  });

  // Fetch admin recipients once, not per delivery.
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });

  let flipped = 0;

  for (const d of due) {
    // Flip FIRST and await, so a failed notification can never leave the row
    // stuck SCHEDULED (it would just re-notify on the next run, never re-flip).
    await prisma.formulaDelivery.update({
      where: { id: d.id },
      data:  { status: "DUE" },
    });
    flipped++;

    const motherName = d.episode.user.name ?? "A mother";

    // Admin(s): prepare/send this month. Per-delivery at beta scale; if formula
    // volume grows, batch these into one daily digest (someday, not now).
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId:  a.id,
          type:    "ADMIN_MESSAGE" as const,
          title:   "Formula month due",
          message: `${motherName} — month ${d.monthIndex} of ${d.episode.monthsTotal} is due. Please prepare and send it.`,
          link:    "/admin",
        })),
      }).catch((err) => console.error("[formula-delivery-due] admin notify failed", err));
    }

    // Mother: gentle reassurance. In-app only — her inbox is reserved for the two
    // bookends (activation + completion).
    await prisma.notification.create({
      data: {
        userId:  d.episode.userId,
        type:    "BUNDLE_UPDATE",
        message: "Your formula for this month is being prepared — there's nothing you need to do. We'll let you know as it's on its way. 💛",
        link:    "/bundles/formula-support",
      },
    }).catch((err) => console.error("[formula-delivery-due] mother notify failed", err));
  }

  return NextResponse.json({ ok: true, flipped, timestamp: now.toISOString() });
}
export { POST as GET };
