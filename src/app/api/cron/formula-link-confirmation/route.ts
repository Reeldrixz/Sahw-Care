import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getResend } from "@/lib/resend";
import { isAuthorizedCron } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";

// F6: chase an unconfirmed purchasing link. Two jobs with DIFFERENT triggers:
//
//   A. Remind HER — requires purchaseUrlSentAt (she was actually asked).
//      Nagging her before anyone asked would be nonsense.
//   B. Alert ADMINS — requires a due, unfulfilled month, whether or not she was
//      ever asked. Two of its sub-states are admin failures, not hers (no link
//      added; link saved but never approved). Its condition mirrors the F4
//      BLOCKED panel exactly so the panel and the alerts can never disagree.
//
// SAFETY: this cron only sends notifications and stamps marker fields. It NEVER
// writes purchaseUrl, purchaseUrlConfirmedAt, a delivery status, or an episode
// status — so no failure here can cause a wrong purchase. All reset logic lives
// in the F2/F3/F5 endpoints; the cron only ever sets markers.

const DAY = 24 * 60 * 60 * 1000;
const REMINDER_DAYS = [3, 7, 14, 21] as const; // cap 4
const ESCALATE_AFTER_DAYS_WITH_EMAIL = 7;
const ESCALATE_AFTER_DAYS_PHONE_ONLY = 3; // in-app is her only automated channel

// Her reminder copy, indexed by which reminder this is. Email on the first two
// only; after that it is a human-contact problem and more email is just noise.
function reminderCopy(idx: number, name: string, appUrl: string) {
  const link = `<p><a href="${appUrl}/bundles/formula-support">Check your formula</a></p>`;
  switch (idx) {
    case 0:
      return {
        inApp:   "We're ready to send your formula — we just need you to open the product and confirm it's right. We won't buy anything until you do.",
        subject: "One quick check before we send your formula",
        html:    `<p>Hi ${name},</p><p>Your formula for this month is ready to buy — we just need you to open the exact product and confirm it's what your baby uses. We never purchase until you've checked, so nothing has been sent yet. It only takes a moment.</p>${link}<p>With warmth,<br/>The Kradel Team</p>`,
      };
    case 1:
      return {
        inApp:   "Your formula for this month hasn't been sent yet — we're still waiting to confirm the product is right. If something's in the way, please reach out and we'll help.",
        subject: "Your formula hasn't been sent yet",
        html:    `<p>Hi ${name},</p><p>We haven't sent your formula this month yet, because we don't buy anything until you've confirmed the exact product is right for your baby. If the link didn't work, or anything else is in the way, just reach out — we'll sort it out with you.</p>${link}<p>With warmth,<br/>The Kradel Team</p>`,
      };
    case 2:
      return {
        inApp:   "We're still holding this month's formula for you. A quick check is all we need — or reach out and we can go through it together.",
        subject: null,
        html:    null,
      };
    default:
      return {
        inApp:   "We haven't been able to send your formula yet. We'd really like to help — please reach out whenever you can, and we'll take it from there.",
        subject: null,
        html:    null,
      };
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now    = new Date();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sahw-care.vercel.app";

  // Every ACTIVE episode whose product is not confirmed. Covers all sub-states:
  // no link, link never sent, sent and awaiting her, and declined.
  const episodes = await prisma.formulaEpisode.findMany({
    where: { status: "ACTIVE", purchaseUrlConfirmedAt: null },
    select: {
      id: true, userId: true, monthsTotal: true,
      purchaseUrl: true, purchaseUrlSetAt: true, purchaseUrlSentAt: true,
      purchaseUrlDeclinedAt: true,
      purchaseUrlReminderCount: true,
      blockedAdminNotifiedAt: true, blockedAdminEscalatedAt: true,
      user: { select: { name: true, email: true, phone: true } },
      deliveries: {
        orderBy: { monthIndex: "asc" },
        select:  { monthIndex: true, status: true, scheduledFor: true },
      },
    },
    take: 200,
  });

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });

  const notifyAdmins = async (title: string, message: string) => {
    if (admins.length === 0) return;
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id, type: "ADMIN_MESSAGE" as const, title, message, link: "/admin",
      })),
    }).catch((err) => console.error("[formula-link-confirmation] admin notify failed", err));
  };

  let remindersSent = 0;
  let blockedAlerts = 0;
  let escalations   = 0;

  for (const ep of episodes) {
    const name = ep.user.name ?? "there";

    // ── Job A: remind her (only if she was actually asked, and hasn't flagged) ──
    if (ep.purchaseUrlSentAt && !ep.purchaseUrlDeclinedAt) {
      const daysSent = Math.floor((now.getTime() - ep.purchaseUrlSentAt.getTime()) / DAY);
      // Catch-up: jump to the highest threshold passed and send only THAT copy,
      // so a cron outage never delivers a stale day-3 note on day 12.
      const targetCount = REMINDER_DAYS.filter((d) => daysSent >= d).length;

      if (targetCount > ep.purchaseUrlReminderCount) {
        const idx  = targetCount - 1;
        const copy = reminderCopy(idx, name, appUrl);

        // Stamp FIRST and await, so a failed send can never re-fire tomorrow.
        await prisma.formulaEpisode.update({
          where: { id: ep.id },
          data:  { purchaseUrlReminderCount: targetCount, purchaseUrlReminderSentAt: now },
        });
        remindersSent++;

        await prisma.notification.create({
          data: {
            userId: ep.userId, type: "BUNDLE_UPDATE",
            message: copy.inApp, link: "/bundles/formula-support",
          },
        }).catch((err) => console.error("[formula-link-confirmation] in-app notify failed", err));

        if (copy.subject && copy.html && ep.user.email) {
          await getResend().emails.send({
            from:    process.env.RESEND_FROM_EMAIL ?? "noreply@kradel.care",
            to:      ep.user.email,
            subject: copy.subject,
            html:    copy.html,
          }).catch((err) => console.error("[formula-link-confirmation] email failed", err));
        }
        // TODO(SMS): a phone-only mother only sees the in-app notice. Send an SMS
        // here once Twilio Messaging is provisioned (Verify only sends OTP codes).
      }
    }

    // ── Job B: alert admins about a due month with nothing purchased ───────────
    const blockedMonth = ep.deliveries.find(
      (d) => d.status !== "FULFILLED" && d.status !== "CANCELLED" && d.scheduledFor.getTime() <= now.getTime()
    );
    if (!blockedMonth) continue;

    // Anchor: when she was asked, else when the link was saved, else how long the
    // month has been owed — so a never-started link still escalates eventually.
    const waitingSince = ep.purchaseUrlSentAt ?? ep.purchaseUrlSetAt ?? blockedMonth.scheduledFor;
    const daysWaiting  = Math.floor((now.getTime() - waitingSince.getTime()) / DAY);
    const monthLabel   = `month ${blockedMonth.monthIndex} of ${ep.monthsTotal}`;

    if (!ep.blockedAdminNotifiedAt) {
      await prisma.formulaEpisode.update({
        where: { id: ep.id },
        data:  { blockedAdminNotifiedAt: now },
      });
      blockedAlerts++;

      const message = !ep.purchaseUrl
        ? `${name} — ${monthLabel} is due and there's no purchase link yet. Nothing can be bought until one is added and she confirms it.`
        : ep.purchaseUrlDeclinedAt
          ? `${name} — ${monthLabel} is due and she flagged the link as wrong. Please correct it and send it again.`
          : !ep.purchaseUrlSentAt
            ? `${name} — ${monthLabel} is due. A link is saved but hasn't been sent to her yet, so she hasn't been able to confirm it.`
            : `${name} — ${monthLabel} is blocked. She hasn't confirmed the product, so nothing has been purchased and she has received no formula this month. Please reach out to her.`;
      await notifyAdmins("Formula month blocked", message);
    }

    // Phone-only mothers escalate sooner: in-app is their only automated channel,
    // so a human call is the real remedy and shouldn't wait a week.
    const escalateAfter = ep.user.email ? ESCALATE_AFTER_DAYS_WITH_EMAIL : ESCALATE_AFTER_DAYS_PHONE_ONLY;
    if (daysWaiting >= escalateAfter && !ep.blockedAdminEscalatedAt) {
      await prisma.formulaEpisode.update({
        where: { id: ep.id },
        data:  { blockedAdminEscalatedAt: now },
      });
      escalations++;

      const phone = ep.user.phone ? `Please call her: ${ep.user.phone}.` : "No phone on file — reach her any way you can.";
      const noEmail = ep.user.email ? "" : " She is PHONE-ONLY and receives no email reminders.";
      await notifyAdmins(
        "Formula month still blocked",
        `${name} — still blocked after ${daysWaiting} days, ${ep.purchaseUrlReminderCount} reminder${ep.purchaseUrlReminderCount === 1 ? "" : "s"} sent. She has received nothing this month.${noEmail} ${phone}`
      );
    }
  }

  return NextResponse.json({
    ok: true, remindersSent, blockedAlerts, escalations, timestamp: now.toISOString(),
  });
}
export { POST as GET };
