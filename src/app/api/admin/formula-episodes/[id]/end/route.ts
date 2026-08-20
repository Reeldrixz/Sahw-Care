import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getResend } from "@/lib/resend";

export const dynamic = "force-dynamic";

const MAX_REASON_LEN = 1000;

// Admin early-end: humane mid-episode exit for an ACTIVE formula episode (baby
// off formula, mother unreachable, funding lapsed, ...). Requires an INTERNAL
// reason that the mother never sees. Sets ENDED + endedAt + endReason +
// endedByAdminId, cancels the remaining SCHEDULED/DUE deliveries, and frees the
// reserved slot automatically (ENDED leaves the ACTIVE set — capacity is
// live-computed, nothing to write). Mirrors the no-fault RELEASED/expiry pattern.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ error: "An internal reason is required to end an episode." }, { status: 400 });
  }

  const episode = await prisma.formulaEpisode.findUnique({
    where:  { id },
    select: { id: true, userId: true, status: true },
  });
  if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  if (episode.status !== "ACTIVE") {
    return NextResponse.json({ error: "Only an active episode can be ended early." }, { status: 409 });
  }

  const now = new Date();
  let cancelledDeliveries = 0;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.formulaEpisode.update({
        where: { id: episode.id },
        data:  {
          status:         "ENDED",
          endedAt:        now,
          endReason:      reason.slice(0, MAX_REASON_LEN),
          endedByAdminId: admin.userId,
          // An ended episode carries no live proposal.
          pendingFormulaStage:        null,
          pendingStageRequestedAt:    null,
          pendingStageReminderSentAt: null,
        },
      });

      // Cancel only the still-open months. FULFILLED history is preserved;
      // already-CANCELLED rows are untouched.
      const cancelled = await tx.formulaDelivery.updateMany({
        where: { episodeId: episode.id, status: { in: ["SCHEDULED", "DUE"] } },
        data:  { status: "CANCELLED" },
      });
      cancelledDeliveries = cancelled.count;
    });
  } catch (e) {
    console.error("[formula end]", e);
    return NextResponse.json({ error: "Could not end this episode. Please try again." }, { status: 500 });
  }

  // Warm, vague, no-fault note to the mother (best-effort, outside the txn). The
  // internal reason is NEVER included here. "Paused" is deliberate — her page
  // falls through to normal intake, so she can always come back.
  const mother = await prisma.user.findUnique({ where: { id: episode.userId }, select: { name: true, email: true } });
  prisma.notification.create({
    data: {
      userId:  episode.userId,
      type:    "BUNDLE_UPDATE",
      message: "We've paused your formula support for now. If this was unexpected, or anything has changed and you'd like to continue, please reach out — we're here and happy to help. 💛",
      link:    "/bundles/formula-support",
    },
  }).catch(() => {});
  if (mother?.email) {
    getResend().emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? "noreply@kradel.care",
      to:      mother.email,
      subject: "About your formula support",
      html:    `<p>Hi ${mother.name},</p><p>We've paused your formula support for now. If this was unexpected, or if anything has changed and you'd like to continue, please reach out — we're here and happy to help.</p><p>Warmly,<br/>The Kradel Team</p>`,
    }).catch((err) => console.error("[formula end email]", err));
  }

  return NextResponse.json({ ok: true, cancelledDeliveries });
}
