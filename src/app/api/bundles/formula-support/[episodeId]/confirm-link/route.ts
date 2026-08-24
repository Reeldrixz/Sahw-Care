import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// F3: the mother confirms the exact product is right for her baby.
//
// THIS is what makes a purchase safe — purchaseUrlConfirmedAt is the only
// signal that lets an admin buy (F4 enforces it server-side). Nothing else in
// the system can set it.
//
// Confirming after a decline is allowed: if the link is still the one she
// flagged, nothing has changed except her mind, and blocking her would leave her
// waiting on an admin round-trip for her own correction. It clears the decline.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { episodeId } = await params;
  const episode = await prisma.formulaEpisode.findUnique({
    where:  { id: episodeId },
    select: {
      id: true, userId: true, status: true,
      purchaseUrl: true, purchaseUrlSentAt: true, purchaseUrlConfirmedAt: true,
    },
  });
  if (!episode || episode.userId !== currentUser.userId) {
    return NextResponse.json({ error: "Formula episode not found" }, { status: 404 });
  }
  if (episode.status !== "ACTIVE") {
    return NextResponse.json({ error: "This formula support is not active." }, { status: 409 });
  }
  if (!episode.purchaseUrl || !episode.purchaseUrlSentAt) {
    return NextResponse.json({ error: "There's no product waiting for your confirmation." }, { status: 409 });
  }
  if (episode.purchaseUrlConfirmedAt) {
    return NextResponse.json({ error: "You've already confirmed this product." }, { status: 409 });
  }

  const now = new Date();
  await prisma.formulaEpisode.update({
    where: { id: episode.id },
    data:  {
      purchaseUrlConfirmedAt: now, // safe to purchase
      // Her confirmation resolves any earlier flag and ends the blocked state.
      purchaseUrlDeclinedAt:     null,
      purchaseUrlDeclineNote:    null,
      purchaseUrlReminderCount:  0,
      purchaseUrlReminderSentAt: null,
      blockedAdminNotifiedAt:    null,
      blockedAdminEscalatedAt:   null,
    },
  });

  // Tell admins it's now safe to buy (best-effort).
  prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } }).then((admins) => {
    if (admins.length === 0) return;
    return prisma.notification.createMany({
      data: admins.map((a) => ({
        userId:  a.id,
        type:    "ADMIN_MESSAGE" as const,
        title:   "Formula product confirmed",
        message: `${currentUser.name ?? "A mother"} confirmed her formula product. It's safe to purchase and send.`,
        link:    "/admin",
      })),
    });
  }).catch(() => {});

  return NextResponse.json({ ok: true, confirmedAt: now.toISOString() });
}
