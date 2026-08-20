import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getResend } from "@/lib/resend";
import { isAuthorizedCron } from "@/lib/cronAuth";
import { formatCooldownDate } from "@/lib/cooldowns";

export const dynamic = "force-dynamic";

// D/F3d: nudge and expire pending formula confirmations.
//  - day-7 and day-12 reminders (each fires once, guarded by reminderNSentAt)
//  - day-14 no-fault expiry when the confirmation window has passed
// Anchored on confirmationDeadline so an admin spec-fix (which resets the
// deadline and nulls the reminder flags) cleanly re-nudges the new window.
// Only AWAITING_CONFIRMATION episodes are touched. Idempotent: safe to re-run.

const DAY = 24 * 60 * 60 * 1000;

// In-app always; email when present. SMS-ready: a phone-only mother gets the
// in-app notice today; add an SMS send here once Twilio Messaging is provisioned
// (Verify, which we currently have, only sends OTP codes, not free-form text).
async function notifyMother(
  opts: { userId: string; email: string | null; phone: string | null; inApp: string; subject: string; html: string }
) {
  await prisma.notification.create({
    data: { userId: opts.userId, type: "BUNDLE_UPDATE", message: opts.inApp, link: "/bundles/formula-support" },
  }).catch((err) => console.error("[formula-confirmation] in-app notify failed", err));

  if (opts.email) {
    await getResend().emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? "noreply@kradel.care",
      to:      opts.email,
      subject: opts.subject,
      html:    opts.html,
    }).catch((err) => console.error("[formula-confirmation] email failed", err));
  }
  // TODO(SMS): if opts.phone && messaging provisioned, send an SMS here too.
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();

  const episodes = await prisma.formulaEpisode.findMany({
    where:  { status: "AWAITING_CONFIRMATION", confirmationDeadline: { not: null } },
    select: {
      id: true, userId: true, confirmationDeadline: true,
      reminder7SentAt: true, reminder12SentAt: true,
      user: { select: { name: true, email: true, phone: true } },
    },
    take: 200,
  });

  let remindersDay7 = 0;
  let remindersDay12 = 0;
  let expired = 0;

  for (const ep of episodes) {
    const deadline = ep.confirmationDeadline!;
    const name = ep.user.name ?? "there";
    const heldUntil = formatCooldownDate(deadline);

    // 1. Past the window -> no-fault expiry. The STATE CHANGE IS COMMITTED FIRST
    //    and awaited; the notification is best-effort afterwards, so a failed
    //    email can never leave the episode stuck in AWAITING_CONFIRMATION.
    if (deadline.getTime() <= now.getTime()) {
      await prisma.formulaEpisode.update({
        where: { id: ep.id },
        data:  { status: "ENDED", endedAt: now, endReason: "Confirmation window elapsed" },
      });
      expired++; // capacity is freed the moment status leaves AWAITING_CONFIRMATION

      await notifyMother({
        userId: ep.userId, email: ep.user.email, phone: ep.user.phone,
        inApp:   "We weren't able to confirm your baby's formula in time, so we've released your spot for now. There's no problem at all, and you can be admitted again anytime. Just reach out or submit a new request whenever you're ready.",
        subject: "Your formula support spot has been released for now",
        html:    `<p>Hi ${name},</p><p>We didn't hear back to confirm your baby's formula, so we've gently released your spot so another baby can be helped in the meantime. This is completely no-fault. You're welcome to be set up again anytime, just reach out or submit a new request.</p><p>The Kradel Team</p>`,
      });
      continue;
    }

    const day7Mark  = deadline.getTime() - 7 * DAY;   // 7 days into a 14-day window
    const day12Mark = deadline.getTime() - 2 * DAY;   // 12 days into a 14-day window

    // 2. Day-12 (more urgent) first. Also stamp reminder7 if still null so the
    //    stale day-7 copy can never back-fire after the day-12 copy.
    if (now.getTime() >= day12Mark && !ep.reminder12SentAt) {
      await prisma.formulaEpisode.update({
        where: { id: ep.id },
        data:  { reminder12SentAt: now, ...(ep.reminder7SentAt ? {} : { reminder7SentAt: now }) },
      });
      remindersDay12++;
      await notifyMother({
        userId: ep.userId, email: ep.user.email, phone: ep.user.phone,
        inApp:   `Just checking in: your formula support is ready as soon as you confirm your baby's formula. Your spot is held until ${heldUntil}.`,
        subject: "Your formula support is ready when you are",
        html:    `<p>Hi ${name},</p><p>Your formula support is set up and waiting, we just need you to confirm your baby's exact formula. Your place is held until ${heldUntil}. It only takes a moment, and if any detail is off you can tell us and we'll fix it.</p><p>The Kradel Team</p>`,
      });
      continue;
    }

    // 3. Day-7.
    if (now.getTime() >= day7Mark && !ep.reminder7SentAt) {
      await prisma.formulaEpisode.update({
        where: { id: ep.id },
        data:  { reminder7SentAt: now },
      });
      remindersDay7++;
      await notifyMother({
        userId: ep.userId, email: ep.user.email, phone: ep.user.phone,
        inApp:   "A gentle reminder: please confirm your baby's formula so we can start your support. It only takes a moment.",
        subject: "A gentle reminder to confirm your baby's formula",
        html:    `<p>Hi ${name},</p><p>Whenever you have a moment, please confirm your baby's exact formula so we can begin your six months of support. No rush, we just want to get the details right before we send anything.</p><p>The Kradel Team</p>`,
      });
    }
  }

  return NextResponse.json({ ok: true, remindersDay7, remindersDay12, expired, timestamp: now.toISOString() });
}
export { POST as GET };
