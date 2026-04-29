import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coordination = await prisma.pickupCoordination.findUnique({
    where: { requestId },
    include: {
      request: {
        include: {
          item: { select: { id: true, title: true, donorId: true } },
          requester: { select: { id: true, name: true, verificationLevel: true, trustScore: true } },
          preferredLocation: true,
        },
      },
      location: true,
      messages: {
        include: { sender: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      reports: { select: { id: true, reason: true, createdAt: true, reviewed: true } },
    },
  });

  if (!coordination) {
    // Check if request exists and user is a party to it
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { item: { select: { donorId: true } } },
    });
    if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const isParty = request.requesterId === user.userId || request.item.donorId === user.userId;
    if (!isParty && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ coordination: null, request });
  }

  const donorId = coordination.request.item.donorId;
  const recipientId = coordination.request.requesterId;
  const isParty = user.userId === donorId || user.userId === recipientId;
  if (!isParty && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ coordination });
}
