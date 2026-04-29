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
      request: { include: { item: { select: { donorId: true } } } },
      location: true,
    },
  });

  if (!coordination) return NextResponse.json({ error: "Coordination not found" }, { status: 404 });

  const donorId = coordination.request.item.donorId;
  const recipientId = coordination.request.requesterId;
  const isParty = user.userId === donorId || user.userId === recipientId;
  if (!isParty) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (coordination.status !== "TIME_PROPOSED") {
    return NextResponse.json({ error: "No time proposal to confirm" }, { status: 409 });
  }

  // The proposer cannot confirm their own proposal
  if (coordination.proposedBy === user.userId) {
    return NextResponse.json({ error: "You cannot confirm your own time proposal — the other party must confirm" }, { status: 409 });
  }

  const updated = await prisma.pickupCoordination.update({
    where: { requestId },
    data: { confirmedTime: coordination.proposedTime, status: "SCHEDULED" },
    include: { location: true },
  });

  // Notify both parties
  const timeStr = coordination.proposedTime?.toDateString() ?? "the scheduled time";
  const locationName = coordination.location?.name ?? "the agreed location";
  const otherUserId = user.userId === donorId ? recipientId : donorId;

  await Promise.all([
    prisma.notification.create({
      data: {
        userId: otherUserId,
        type: "COORDINATION_SCHEDULED",
        message: `Meetup confirmed! ${timeStr} at ${locationName}.`,
        link: `/coordination/${requestId}`,
        triggeredByUserId: user.userId,
      },
    }),
    prisma.notification.create({
      data: {
        userId: user.userId,
        type: "COORDINATION_SCHEDULED",
        message: `Meetup confirmed! ${timeStr} at ${locationName}.`,
        link: `/coordination/${requestId}`,
      },
    }),
  ]).catch(() => {});

  return NextResponse.json({ coordination: updated });
}
