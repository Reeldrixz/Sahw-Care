import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getResend } from "@/lib/resend";

export const dynamic = "force-dynamic";

// D/F4c: mark one month's formula delivery as FULFILLED. The admin can fulfil
// ANY non-fulfilled, non-cancelled month of an ACTIVE episode (DUE is only a
// time-based surfacing hint, never a gate). We snapshot the episode's CURRENT
// formulaStage onto the delivery so stage-for-growth history is preserved.
//
// CRITICAL: completion is at 6 FULFILLMENTS, not 6 calendar months. The
// fulfilment that brings the count to monthsTotal flips the episode to COMPLETED
// in the SAME transaction. A SELECT ... FOR UPDATE on the episode row serialises
// concurrent fulfilments of the same episode so the "final" one is counted
// exactly once (no missed or duplicated completion).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; monthIndex: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, monthIndex: monthIndexRaw } = await params;
  const monthIndex = Number(monthIndexRaw);
  if (!Number.isInteger(monthIndex) || monthIndex < 1) {
    return NextResponse.json({ error: "Invalid month." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined;

  const episode = await prisma.formulaEpisode.findUnique({
    where:  { id },
    select: { id: true, userId: true, status: true, formulaStage: true, monthsTotal: true, purchaseUrlConfirmedAt: true },
  });
  if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  if (episode.status !== "ACTIVE") {
    return NextResponse.json({ error: "Only an active episode's deliveries can be fulfilled." }, { status: 409 });
  }
  // F4: a month can only be completed for a product she has confirmed. If she
  // retracted her confirmation after the purchase, reset the purchase, correct
  // the link, and get it re-confirmed rather than recording a delivery of a
  // product she flagged as wrong.
  if (!episode.purchaseUrlConfirmedAt) {
    return NextResponse.json({
      error: "She hasn't confirmed this product, so this month can't be completed.",
      code:  "NOT_CONFIRMED",
    }, { status: 409 });
  }
  if (monthIndex > episode.monthsTotal) {
    return NextResponse.json({ error: `This episode only has ${episode.monthsTotal} months.` }, { status: 400 });
  }

  const delivery = await prisma.formulaDelivery.findUnique({
    where:  { episodeId_monthIndex: { episodeId: episode.id, monthIndex } },
    select: { id: true, status: true, purchasedAt: true },
  });
  if (!delivery) return NextResponse.json({ error: "Delivery not found for that month." }, { status: 404 });
  if (delivery.status === "FULFILLED") {
    return NextResponse.json({ error: "That month is already fulfilled." }, { status: 409 });
  }
  if (delivery.status === "CANCELLED") {
    return NextResponse.json({ error: "That month was cancelled and cannot be fulfilled." }, { status: 409 });
  }
  // You cannot fulfil what was never bought. purchaseUrlAtPurchase was snapshot
  // at purchase time and is NOT rewritten here — it records what was actually
  // bought, even if the link has since changed.
  if (!delivery.purchasedAt) {
    return NextResponse.json({
      error: "Purchase this month before completing it.",
      code:  "NOT_PURCHASED",
    }, { status: 409 });
  }

  const now = new Date();
  let fulfilledCount = 0;
  let episodeCompleted = false;

  try {
    await prisma.$transaction(async (tx) => {
      // Serialise concurrent fulfilments of this episode so the completion count
      // is exact even if two admins act at once.
      await tx.$queryRaw`SELECT id FROM "FormulaEpisode" WHERE id = ${episode.id} FOR UPDATE`;

      await tx.formulaDelivery.update({
        where: { episodeId_monthIndex: { episodeId: episode.id, monthIndex } },
        data:  {
          status:                   "FULFILLED",
          fulfilledAt:              now,
          fulfilledByAdminId:       admin.userId,
          formulaStageAtFulfilment: episode.formulaStage, // current live stage
          ...(note !== undefined && { note }),
        },
      });

      fulfilledCount = await tx.formulaDelivery.count({
        where: { episodeId: episode.id, status: "FULFILLED" },
      });

      if (fulfilledCount >= episode.monthsTotal) {
        // Conditional flip: only the transition ACTIVE -> COMPLETED counts, so
        // the completion side effects fire exactly once.
        const flipped = await tx.formulaEpisode.updateMany({
          where: { id: episode.id, status: "ACTIVE" },
          data:  { status: "COMPLETED", completedAt: now },
        });
        episodeCompleted = flipped.count === 1;
      }
    });
  } catch (e) {
    console.error("[formula fulfill]", e);
    return NextResponse.json({ error: "Could not mark this month fulfilled. Please try again." }, { status: 500 });
  }

  // Notify the mother (best-effort, outside the txn). On the completing
  // fulfilment we send the warmer completion message INSTEAD of the per-month
  // one, so she never gets two pings at once.
  if (episodeCompleted) {
    const mother = await prisma.user.findUnique({ where: { id: episode.userId }, select: { name: true, email: true } });
    prisma.notification.create({
      data: {
        userId:  episode.userId,
        type:    "BUNDLE_UPDATE",
        // Leads with belonging (Circle) then the other supports; links to her
        // community, not the formula page she's now graduated from.
        message: "Your 6 months of formula support are complete. 💛 You're still part of the Kradel community — your Circle, your Register, and Discover are all here whenever you need them.",
        link:    "/circles",
      },
    }).catch(() => {});
    if (mother?.email) {
      getResend().emails.send({
        from:    process.env.RESEND_FROM_EMAIL ?? "noreply@kradel.care",
        to:      mother.email,
        subject: "Your formula support is complete — and you're still part of Kradel",
        html:    `<p>Hi ${mother.name},</p><p>Your 6 months of formula support are now complete — every month has been sent. It's been our privilege to walk this stretch with you and your baby.</p><p>Formula support is a one-time, six-month program, and it comes to a close here — but your place in Kradel doesn't. Your Circle is still yours: your stage community, the mothers you've met, and your Reflections. So are your Register and Discover, here whenever you need them.</p><p>Thank you for letting us be part of your journey. You're always welcome here.</p><p>With warmth,<br/>The Kradel Team</p>`,
      }).catch((err) => console.error("[formula complete email]", err));
    }
  } else {
    // Per-month shipment notice. This now emails as well as posting in-app: it
    // is the most email-worthy recurring moment in the programme, and in-app
    // alone meant a mother who doesn't open the app never learned her baby's
    // formula was on its way. "On its way" rather than "has been sent" because
    // Complete may be stamped before the parcel physically moves.
    const mother = await prisma.user.findUnique({ where: { id: episode.userId }, select: { name: true, email: true } });
    await prisma.notification.create({
      data: {
        userId:  episode.userId,
        type:    "BUNDLE_UPDATE",
        message: "Your formula for this month is on its way to you. 💛",
        link:    "/bundles/formula-support",
      },
    }).catch((err) => console.error("[formula fulfil notify]", err));
    if (mother?.email) {
      await getResend().emails.send({
        from:    process.env.RESEND_FROM_EMAIL ?? "noreply@kradel.care",
        to:      mother.email,
        subject: "Your formula for this month is on its way",
        html:    `<p>Hi ${mother.name},</p><p>Your formula for this month is on its way to you. There's nothing you need to do — we'll keep going month by month.</p><p>With warmth,<br/>The Kradel Team</p>`,
      }).catch((err) => console.error("[formula fulfil email]", err));
    }
  }

  return NextResponse.json({ ok: true, monthIndex, fulfilledCount, episodeCompleted });
}
