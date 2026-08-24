import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";

// F2: send the purchasing link to the mother for confirmation ("Approve").
//
// This does NOT approve the purchase — only she can do that. It hands her the
// exact product to check. Purchasing stays blocked until purchaseUrlConfirmedAt
// is set by her confirmation (F3).
//
// Guards make the send meaningful rather than a repeatable nudge:
//   - no link yet                  -> nothing to send
//   - she already confirmed        -> nothing to ask
//   - she DECLINED this link       -> correct it first; re-sending the same link
//                                     she flagged as wrong would ignore her
//   - already sent, awaiting her   -> the reminder cron does the nudging
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const episode = await prisma.formulaEpisode.findUnique({
    where:  { id },
    select: {
      id: true, userId: true, status: true,
      purchaseUrl: true, purchaseUrlSentAt: true,
      purchaseUrlConfirmedAt: true, purchaseUrlDeclinedAt: true,
      user: { select: { name: true, email: true } },
    },
  });
  if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  if (episode.status !== "ACTIVE") {
    return NextResponse.json({ error: "Only an active episode's purchase link can be sent." }, { status: 409 });
  }
  if (!episode.purchaseUrl) {
    return NextResponse.json({ error: "Add a purchase link before sending it to her.", code: "NO_LINK" }, { status: 409 });
  }
  if (episode.purchaseUrlConfirmedAt) {
    return NextResponse.json({ error: "She has already confirmed this product.", code: "ALREADY_CONFIRMED" }, { status: 409 });
  }
  if (episode.purchaseUrlDeclinedAt) {
    return NextResponse.json({
      error: "She flagged this link as wrong. Correct it before sending again.",
      code:  "DECLINED_NEEDS_CORRECTION",
    }, { status: 409 });
  }
  if (episode.purchaseUrlSentAt) {
    return NextResponse.json({
      error: "This link has already been sent — she hasn't replied yet. Reminders go out automatically; if it's urgent, reach her directly.",
      code:  "ALREADY_SENT",
    }, { status: 409 });
  }

  const now = new Date();
  await prisma.formulaEpisode.update({
    where: { id: episode.id },
    data:  {
      purchaseUrlSentAt: now,
      // Her reminder clock starts from this send.
      purchaseUrlReminderCount:  0,
      purchaseUrlReminderSentAt: null,
      blockedAdminNotifiedAt:    null,
      blockedAdminEscalatedAt:   null,
    },
  });

  // Ask her to check the product (best-effort, outside the write). The email
  // links to her formula support page, NOT straight to Amazon — the checklist
  // and the confirm/decline actions live on the card there.
  // Tier-1: if this never reaches her she cannot confirm, and the month stalls
  // with nothing purchased — so the result is reported back to the admin.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sahw-care.vercel.app";
  const { reached } = await notifyUser({
    userId:  episode.userId,
    type:    "BUNDLE_UPDATE",
    message: "Please take a look at your baby's formula before we buy it. Open the product, check it's right, and we'll send it.",
    link:    "/bundles/formula-support",
    context: "formula:approve-link",
    email: {
      to:      episode.user.email,
      subject: "Please confirm your baby's formula before we send it",
      html:    `<p>Hi ${episode.user.name},</p><p>We're getting this month's formula ready. Before we buy anything, please open the exact product and confirm it's what your baby uses. We never purchase until you've checked.</p><p>It only takes a moment: <a href="${appUrl}/bundles/formula-support">check your formula</a>.</p><p>With warmth,<br/>The Kradel Team</p>`,
    },
  });

  return NextResponse.json({ ok: true, sentAt: now.toISOString(), notified: reached });
}
