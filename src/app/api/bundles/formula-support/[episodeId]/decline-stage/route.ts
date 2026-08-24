import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyAdmins } from "@/lib/notify";

export const dynamic = "force-dynamic";

// D/F4d + F5: the mother declines / flags a proposed stage change. The live
// formulaStage AND the live purchase link are left UNTOUCHED — her baby keeps
// its current stage and that product stays confirmed and purchasable, so
// declining costs her nothing and never blocks a month. Only the pending
// proposal (stage + its link) is dropped. Admins are notified, with her note if
// she left one. ACTIVE-only; a pending proposal must exist.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { episodeId } = await params;
  const body = await req.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

  const episode = await prisma.formulaEpisode.findUnique({
    where:  { id: episodeId },
    select: { id: true, userId: true, status: true, pendingFormulaStage: true },
  });
  if (!episode || episode.userId !== currentUser.userId) {
    return NextResponse.json({ error: "Formula episode not found" }, { status: 404 });
  }
  if (episode.status !== "ACTIVE") {
    return NextResponse.json({ error: "This formula support is not active." }, { status: 409 });
  }
  if (!episode.pendingFormulaStage) {
    return NextResponse.json({ error: "There's no pending stage change to decline." }, { status: 409 });
  }

  const declinedStage = episode.pendingFormulaStage;
  // Clear the proposal ONLY. formulaStage and the live purchase link (with its
  // confirmation) are intentionally not written here.
  await prisma.formulaEpisode.update({
    where: { id: episode.id },
    data:  {
      pendingFormulaStage:        null,
      pendingPurchaseUrl:         null,
      pendingStageRequestedAt:    null,
      pendingStageReminderSentAt: null,
    },
  });

  // Alert admins she declined so someone can follow up (best-effort).
  await notifyAdmins({
    title:   "Stage change declined",
    message: `${currentUser.name ?? "A mother"} declined the move to Stage ${declinedStage}.${note ? ` Note: ${note}` : ""}`,
    context: "formula:decline-stage",
  });

  return NextResponse.json({ ok: true });
}
