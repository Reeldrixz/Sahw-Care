import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyAdmins } from "@/lib/notify";

export const dynamic = "force-dynamic";

// D/F4d + F5: the mother confirms a proposed stage-for-growth change AND the new
// stage's product in one action. THIS is the only place the live formulaStage is
// reassigned (confirm-before-applies). Future fulfillments then snapshot the new
// stage automatically (D/F4c reads the live formulaStage at fulfilment time).
//
// Because she has just checked the new product here, the pending link becomes
// the live link AND is marked confirmed in the same write — so purchasing
// resumes immediately at the new stage with no second round-trip.
// ACTIVE-only; a pending proposal must exist.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { episodeId } = await params;
  const episode = await prisma.formulaEpisode.findUnique({
    where:  { id: episodeId },
    select: { id: true, userId: true, status: true, pendingFormulaStage: true, pendingPurchaseUrl: true },
  });
  if (!episode || episode.userId !== currentUser.userId) {
    return NextResponse.json({ error: "Formula episode not found" }, { status: 404 });
  }
  if (episode.status !== "ACTIVE") {
    return NextResponse.json({ error: "This formula support is not active." }, { status: 409 });
  }
  if (!episode.pendingFormulaStage) {
    return NextResponse.json({ error: "There's no pending stage change to confirm." }, { status: 409 });
  }

  const newStage = episode.pendingFormulaStage;
  const newLink  = episode.pendingPurchaseUrl;
  const now      = new Date();
  await prisma.formulaEpisode.update({
    where: { id: episode.id },
    data:  {
      formulaStage:               newStage, // apply the growth stage now
      pendingFormulaStage:        null,
      pendingPurchaseUrl:         null,
      pendingStageRequestedAt:    null,
      pendingStageReminderSentAt: null,
      // She checked the new stage's product as part of this same ask, so the
      // pending link goes live already confirmed — purchasing resumes at once.
      ...(newLink && {
        purchaseUrl:            newLink,
        purchaseUrlSetAt:       now,
        purchaseUrlSentAt:      now,
        purchaseUrlConfirmedAt: now,
        purchaseUrlDeclinedAt:  null,
        purchaseUrlDeclineNote: null,
      }),
      purchaseUrlReminderCount:  0,
      purchaseUrlReminderSentAt: null,
      blockedAdminNotifiedAt:    null,
      blockedAdminEscalatedAt:   null,
    },
  });

  // Let admins know she accepted (best-effort).
  await notifyAdmins({
    title:   "Stage change confirmed",
    message: `${currentUser.name ?? "A mother"} confirmed the move to Stage ${newStage}.`,
    context: "formula:confirm-stage",
  });

  return NextResponse.json({ ok: true, formulaStage: newStage });
}
