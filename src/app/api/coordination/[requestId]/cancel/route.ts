import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coordination = await prisma.pickupCoordination.findUnique({
    where: { requestId },
    include: {
      request: { include: { item: { select: { id: true, donorId: true, status: true, quantityNum: true } } } },
    },
  });

  if (!coordination) return NextResponse.json({ error: "Coordination not found" }, { status: 404 });

  const donorId = coordination.request.item.donorId;
  const recipientId = coordination.request.requesterId;
  const isParty = user.userId === donorId || user.userId === recipientId;
  if (!isParty && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const terminalStatuses = ["CONFIRMED", "CANCELLED", "REPORTED"];
  if (terminalStatuses.includes(coordination.status)) {
    return NextResponse.json({ error: "Coordination is already in a terminal state" }, { status: 409 });
  }

  const { reason } = await req.json();

  const updated = await prisma.pickupCoordination.update({
    where: { requestId },
    data: {
      status: "CANCELLED",
      cancelledById: user.userId,
      cancelReason: reason ?? null,
    },
  });

  await prisma.request.update({
    where: { id: requestId },
    data: { status: "CANCELLED" },
  });

  // Restore the item to the pool, whoever cancelled. Acceptance decremented the
  // quantity and may have flipped it to RESERVED, so restoring only on a donor
  // cancel (as this did) left an item permanently reserved and invisible to
  // everyone whenever the RECIPIENT backed out — the item leaked out of
  // circulation with no way back. The reservation belongs to the cancelled
  // coordination, not to whoever happened to end it.
  if (coordination.request.item.status === "RESERVED") {
    await prisma.item.update({
      where: { id: coordination.request.item.id },
      data: {
        status: "ACTIVE",
        quantityNum: (coordination.request.item.quantityNum ?? 0) + 1,
      },
    });
  }

  const otherUserId = user.userId === donorId ? recipientId : donorId;
  const isDonorCancelling = user.userId === donorId;

  prisma.notification.create({
    data: {
      userId: otherUserId,
      type: "COORDINATION_CANCELLED",
      message: isDonorCancelling
        ? "This pickup has been cancelled. The item may still be available to others."
        : "The recipient has cancelled this pickup.",
      link: `/coordination/${requestId}`,
      triggeredByUserId: user.userId,
    },
  }).catch(() => {});

  return NextResponse.json({ coordination: updated });
}
