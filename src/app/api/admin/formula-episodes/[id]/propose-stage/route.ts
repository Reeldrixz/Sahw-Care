import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getResend } from "@/lib/resend";

export const dynamic = "force-dynamic";

const MAX_STAGE_LEN = 60;

// D/F4d: admin proposes a mid-episode STAGE change (stage-for-growth, e.g.
// Stage 1 -> 2 as the baby ages). This endpoint is deliberately incapable of
// changing brand/type/form or the live formulaStage: it reads ONLY formulaStage
// from the body and writes ONLY the pending* proposal fields. The live
// formulaStage is reassigned later, and only by the mother's confirm-stage
// (confirm-before-applies). Re-proposing overwrites a prior pending proposal so
// an admin can fix a typo before she acts.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  // Stage ONLY. No other field is read from the body.
  const proposedStage = typeof body.formulaStage === "string" ? body.formulaStage.trim() : "";
  if (!proposedStage) {
    return NextResponse.json({ error: "A new stage is required." }, { status: 400 });
  }
  if (proposedStage.length > MAX_STAGE_LEN) {
    return NextResponse.json({ error: "That stage looks too long." }, { status: 400 });
  }

  const episode = await prisma.formulaEpisode.findUnique({
    where:  { id },
    select: { id: true, userId: true, status: true, formulaStage: true },
  });
  if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  if (episode.status !== "ACTIVE") {
    return NextResponse.json({ error: "Only an active episode's stage can be changed." }, { status: 409 });
  }
  if (proposedStage === episode.formulaStage) {
    return NextResponse.json({ error: "That is already her current stage." }, { status: 400 });
  }

  // Write ONLY the proposal fields — never formulaBrand/formulaType/formulaForm,
  // and never the live formulaStage. Reset the reminder marker so this fresh
  // proposal gets its own single day-7 nudge.
  await prisma.formulaEpisode.update({
    where: { id: episode.id },
    data:  {
      pendingFormulaStage:        proposedStage,
      pendingStageRequestedAt:    new Date(),
      pendingStageReminderSentAt: null,
    },
  });

  // Notify the mother: in-app always, email when present (best-effort).
  const mother = await prisma.user.findUnique({ where: { id: episode.userId }, select: { name: true, email: true } });
  prisma.notification.create({
    data: {
      userId:  episode.userId,
      type:    "BUNDLE_UPDATE",
      message: `As your baby grows, we'd like to move their formula to Stage ${proposedStage}. Please take a look and confirm it's right before we send your next month.`,
      link:    "/bundles/formula-support",
    },
  }).catch(() => {});
  if (mother?.email) {
    getResend().emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? "noreply@kradel.care",
      to:      mother.email,
      subject: "A stage update for your baby's formula",
      html:    `<p>Hi ${mother.name},</p><p>As babies grow, formula usually moves up a stage. We'd like to update your support to <strong>Stage ${proposedStage}</strong> — only the stage changes, it's the same brand, type, and form your baby already uses.</p><p>Please open your formula support page to confirm it's right before we send your next month.</p><p>With warmth,<br/>The Kradel Team</p>`,
    }).catch((err) => console.error("[propose-stage email]", err));
  }

  return NextResponse.json({ ok: true, pendingFormulaStage: proposedStage });
}
