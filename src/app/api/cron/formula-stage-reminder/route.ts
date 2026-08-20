import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getResend } from "@/lib/resend";
import { isAuthorizedCron } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";

// D/F4d: ONE gentle nudge ~7 days after a stage-for-growth proposal if the
// mother hasn't re-confirmed. Unlike the confirmation window there is NO hard
// timeout and NO expiry: the safe default is that her baby's CURRENT stage keeps
// shipping until she confirms, so an unconfirmed proposal simply waits. This
// cron only sends the single reminder (guarded by pendingStageReminderSentAt)
// and never changes any stage. Idempotent: safe to re-run.

const DAY = 24 * 60 * 60 * 1000;
const REMINDER_AFTER_DAYS = 7;

export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now    = new Date();
  const cutoff = new Date(now.getTime() - REMINDER_AFTER_DAYS * DAY);

  // ACTIVE episodes with a still-open proposal older than 7 days, not yet nudged.
  const episodes = await prisma.formulaEpisode.findMany({
    where: {
      status:                     "ACTIVE",
      pendingFormulaStage:        { not: null },
      pendingStageRequestedAt:    { lte: cutoff },
      pendingStageReminderSentAt: null,
    },
    select: {
      id: true, userId: true, pendingFormulaStage: true,
      user: { select: { name: true, email: true, phone: true } },
    },
    take: 200,
  });

  let reminded = 0;

  for (const ep of episodes) {
    const name  = ep.user.name ?? "there";
    const stage = ep.pendingFormulaStage!;

    // Stamp FIRST and await, so a failed email can never re-nudge tomorrow.
    await prisma.formulaEpisode.update({
      where: { id: ep.id },
      data:  { pendingStageReminderSentAt: now },
    });
    reminded++;

    await prisma.notification.create({
      data: {
        userId:  ep.userId,
        type:    "BUNDLE_UPDATE",
        message: `A gentle reminder: we've suggested moving your baby's formula to Stage ${stage}. Your current stage keeps arriving until you confirm — just take a look when you have a moment.`,
        link:    "/bundles/formula-support",
      },
    }).catch((err) => console.error("[formula-stage-reminder] in-app notify failed", err));

    if (ep.user.email) {
      await getResend().emails.send({
        from:    process.env.RESEND_FROM_EMAIL ?? "noreply@kradel.care",
        to:      ep.user.email,
        subject: "A gentle reminder about your baby's formula stage",
        html:    `<p>Hi ${name},</p><p>A little while ago we suggested moving your baby's formula up to <strong>Stage ${stage}</strong> as they grow. There's no rush and nothing has changed — your current stage keeps arriving until you confirm. When you have a moment, please open your formula support page and let us know it's right.</p><p>With warmth,<br/>The Kradel Team</p>`,
      }).catch((err) => console.error("[formula-stage-reminder] email failed", err));
    }
    // TODO(SMS): if ep.user.phone && messaging provisioned, send an SMS here too.
  }

  return NextResponse.json({ ok: true, reminded, timestamp: now.toISOString() });
}
export { POST as GET };
