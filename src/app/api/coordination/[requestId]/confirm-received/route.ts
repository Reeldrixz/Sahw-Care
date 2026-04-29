import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { awardImpactPoints } from "@/lib/trust";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coordination = await prisma.pickupCoordination.findUnique({
    where: { requestId },
    include: {
      request: {
        include: { item: { select: { id: true, title: true, donorId: true } } },
      },
    },
  });

  if (!coordination) return NextResponse.json({ error: "Coordination not found" }, { status: 404 });

  const recipientId = coordination.request.requesterId;
  if (user.userId !== recipientId) {
    return NextResponse.json({ error: "Only the recipient can confirm receipt" }, { status: 403 });
  }

  if (coordination.status !== "DELIVERED") {
    return NextResponse.json({ error: "Donor must mark as delivered first" }, { status: 409 });
  }

  const [updatedCoord] = await prisma.$transaction([
    prisma.pickupCoordination.update({
      where: { requestId },
      data: { status: "CONFIRMED" },
    }),
    prisma.request.update({
      where: { id: requestId },
      data: { status: "CONFIRMED" },
    }),
    prisma.item.update({
      where: { id: coordination.request.item.id },
      data: { status: "FULFILLED" },
    }),
    // +10 trust to donor, +5 to recipient
    prisma.user.update({
      where: { id: coordination.request.item.donorId },
      data: { trustScore: { increment: 10 }, impactScore: { increment: 10 } },
    }),
    prisma.user.update({
      where: { id: recipientId },
      data: {
        trustScore: { increment: 5 },
        requestCountSinceReset: { decrement: 1 },
      },
    }),
  ]);

  awardImpactPoints(coordination.request.item.donorId, "FULFILLED_REQUEST", requestId).catch(() => {});

  prisma.notification.create({
    data: {
      userId: coordination.request.item.donorId,
      type: "COORDINATION_DELIVERED",
      message: "Pickup confirmed! Thank you for donating. 💛",
      link: `/coordination/${requestId}`,
      triggeredByUserId: recipientId,
    },
  }).catch(() => {});

  return NextResponse.json({ coordination: updatedCoord });
}
