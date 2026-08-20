import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// D/F4d: the mother confirms a proposed stage-for-growth change. THIS is the only
// place the live formulaStage is reassigned (confirm-before-applies). Future
// fulfillments then snapshot the new stage automatically (D/F4c reads the live
// formulaStage at fulfilment time). ACTIVE-only; a pending proposal must exist.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { episodeId } = await params;
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
    return NextResponse.json({ error: "There's no pending stage change to confirm." }, { status: 409 });
  }

  const newStage = episode.pendingFormulaStage;
  await prisma.formulaEpisode.update({
    where: { id: episode.id },
    data:  {
      formulaStage:               newStage, // apply the growth stage now
      pendingFormulaStage:        null,
      pendingStageRequestedAt:    null,
      pendingStageReminderSentAt: null,
    },
  });

  // Let admins know she accepted (best-effort).
  prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } }).then((admins) => {
    if (admins.length === 0) return;
    return prisma.notification.createMany({
      data: admins.map((a) => ({
        userId:  a.id,
        type:    "ADMIN_MESSAGE" as const,
        title:   "Stage change confirmed",
        message: `${currentUser.name ?? "A mother"} confirmed the move to Stage ${newStage}.`,
        link:    "/admin",
      })),
    });
  }).catch(() => {});

  return NextResponse.json({ ok: true, formulaStage: newStage });
}
