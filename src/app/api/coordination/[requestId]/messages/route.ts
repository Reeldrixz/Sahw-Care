import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coordination = await prisma.pickupCoordination.findUnique({
    where: { requestId },
    select: {
      status: true,
      messages: {
        include: { sender: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      request: {
        select: {
          requesterId: true,
          item: { select: { donorId: true } },
        },
      },
    },
  });

  if (!coordination) return NextResponse.json({ messages: [], status: "PENDING" });

  const { requesterId } = coordination.request;
  const donorId = coordination.request.item.donorId;
  const isParty = user.userId === donorId || user.userId === requesterId;
  if (!isParty && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    messages: coordination.messages,
    status: coordination.status,
  });
}
