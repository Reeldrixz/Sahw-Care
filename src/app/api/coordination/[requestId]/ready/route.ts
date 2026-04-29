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
    include: { request: { include: { item: { select: { donorId: true } } } } },
  });

  if (!coordination) return NextResponse.json({ error: "Coordination not found" }, { status: 404 });

  const donorId = coordination.request.item.donorId;
  if (user.userId !== donorId && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only the donor can mark ready" }, { status: 403 });
  }

  if (coordination.status !== "SCHEDULED") {
    return NextResponse.json({ error: "Coordination must be SCHEDULED first" }, { status: 409 });
  }

  const updated = await prisma.pickupCoordination.update({
    where: { requestId },
    data: { status: "DONOR_READY" },
  });

  prisma.notification.create({
    data: {
      userId: coordination.request.requesterId,
      type: "COORDINATION_DELIVERED",
      message: "Your donor is at the pickup location — head over!",
      link: `/coordination/${requestId}`,
      triggeredByUserId: user.userId,
    },
  }).catch(() => {});

  // Log "I'm here" as a coordination message
  await prisma.coordinationMessage.create({
    data: {
      coordinationId: coordination.id,
      senderId: user.userId,
      messageType: "IM_HERE",
    },
  });

  return NextResponse.json({ coordination: updated });
}
