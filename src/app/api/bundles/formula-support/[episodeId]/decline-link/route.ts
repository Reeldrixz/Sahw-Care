import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// F3: the mother flags that the product isn't right ("Something doesn't look
// right"). The note is OPTIONAL by design — never put a barrier in front of a
// safety flag.
//
// She may flag even AFTER confirming, and doing so RETRACTS the confirmation:
// purchaseUrlConfirmedAt is cleared, making the link immediately unpurchasable
// again. A mother who spots a mistake must always be able to stop a purchase.
// Months already bought are historical (recorded on the delivery) and untouched.
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
    return NextResponse.json({ error: "There's no product to flag right now." }, { status: 409 });
  }

  const wasConfirmed = !!episode.purchaseUrlConfirmedAt;
  const now = new Date();

  await prisma.formulaEpisode.update({
    where: { id: episode.id },
    data:  {
      purchaseUrlDeclinedAt:  now,
      purchaseUrlDeclineNote: note || null,
      // Retract any confirmation: unpurchasable again, immediately.
      purchaseUrlConfirmedAt: null,
      // Stop nudging her — the ball is now in the admin's court to correct it.
      purchaseUrlReminderCount:  0,
      purchaseUrlReminderSentAt: null,
      blockedAdminNotifiedAt:    null,
      blockedAdminEscalatedAt:   null,
    },
  });

  // Alert admins loudly — nothing can be purchased until they correct the link.
  prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } }).then((admins) => {
    if (admins.length === 0) return;
    return prisma.notification.createMany({
      data: admins.map((a) => ({
        userId:  a.id,
        type:    "ADMIN_MESSAGE" as const,
        title:   wasConfirmed ? "Formula product flagged AFTER confirming" : "Formula product flagged as wrong",
        message: `${currentUser.name ?? "A mother"} flagged her formula product as wrong.${note ? ` She said: "${note}"` : ""}${wasConfirmed ? " She had previously confirmed it, so the confirmation has been withdrawn." : ""} Nothing can be purchased until the link is corrected.`,
        link:    "/admin",
      })),
    });
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
