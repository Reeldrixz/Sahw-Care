import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Body: { date: ISO string, timeBlock: "MORNING"|"AFTERNOON"|"EVENING" }
// Stored as: proposedTime = start-of-block datetime, proposedBy = userId

const TIME_BLOCK_HOUR: Record<string, number> = {
  MORNING: 8,
  AFTERNOON: 12,
  EVENING: 17,
};

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
  const recipientId = coordination.request.requesterId;
  const isParty = user.userId === donorId || user.userId === recipientId;
  if (!isParty) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!["LOCATION_CONFIRMED", "TIME_PROPOSED"].includes(coordination.status)) {
    return NextResponse.json({ error: "Cannot propose time at this stage" }, { status: 409 });
  }

  const { date, timeBlock } = await req.json();
  if (!date || !timeBlock || !TIME_BLOCK_HOUR[timeBlock]) {
    return NextResponse.json({ error: "date and timeBlock (MORNING/AFTERNOON/EVENING) required" }, { status: 400 });
  }

  const proposedDate = new Date(date);
  proposedDate.setHours(TIME_BLOCK_HOUR[timeBlock], 0, 0, 0);

  if (proposedDate < new Date()) {
    return NextResponse.json({ error: "Cannot propose a time in the past" }, { status: 400 });
  }

  const updated = await prisma.pickupCoordination.update({
    where: { requestId },
    data: {
      proposedTime: proposedDate,
      proposedBy: user.userId,
      status: "TIME_PROPOSED",
    },
  });

  // Notify the other party
  const otherUserId = user.userId === donorId ? recipientId : donorId;
  const TB_LABELS: Record<string, string> = { MORNING: "Morning (8am–12pm)", AFTERNOON: "Afternoon (12pm–5pm)", EVENING: "Evening (5pm–8pm)" };
  const timeBlockLabel = TB_LABELS[timeBlock] ?? timeBlock;
  prisma.notification.create({
    data: {
      userId: otherUserId,
      type: "COORDINATION_TIME_PROPOSED",
      message: `A pickup time has been proposed: ${proposedDate.toDateString()} · ${timeBlockLabel}. Tap to confirm.`,
      link: `/coordination/${requestId}`,
      triggeredByUserId: user.userId,
    },
  }).catch(() => {});

  return NextResponse.json({ coordination: updated });
}
