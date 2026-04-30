import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = auth.userId;

  const coordinations = await prisma.pickupCoordination.findMany({
    where: {
      OR: [
        { request: { requesterId: userId } },
        { request: { item: { donorId: userId } } },
      ],
    },
    include: {
      request: {
        include: {
          item: {
            select: {
              id: true,
              title: true,
              donorId: true,
              donor: { select: { id: true, name: true } },
            },
          },
          requester: { select: { id: true, name: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { id: true, name: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const rows = coordinations.map((c) => {
    const donorId    = c.request.item.donorId;
    const isUserDonor = userId === donorId;
    const otherParty = isUserDonor
      ? { id: c.request.requester.id, name: c.request.requester.name }
      : { id: c.request.item.donor.id, name: c.request.item.donor.name };

    const lastMessage = c.messages[0] ?? null;

    return {
      coordinationId: c.id,
      requestId:      c.requestId,
      status:         c.status,
      updatedAt:      c.updatedAt.toISOString(),
      itemId:         c.request.item.id,
      itemTitle:      c.request.item.title,
      isUserDonor,
      otherParty,
      lastMessage: lastMessage
        ? {
            senderId:    lastMessage.senderId,
            senderName:  lastMessage.sender.name,
            messageType: lastMessage.messageType,
            content:     lastMessage.content,
            createdAt:   lastMessage.createdAt.toISOString(),
          }
        : null,
    };
  });

  return NextResponse.json({ pickups: rows });
}
