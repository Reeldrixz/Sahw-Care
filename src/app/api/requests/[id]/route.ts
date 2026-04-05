import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const request = await prisma.request.findUnique({
    where: { id },
    include: { item: true, conversation: true },
  });

  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  const isDonor = request.item.donorId === user.userId;
  const isAdmin = user.role === "ADMIN";

  if (!isDonor && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { status } = await req.json();
  const validStatuses = ["APPROVED", "REJECTED", "FULFILLED"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await prisma.request.update({
    where: { id },
    data: { status },
  });

  // When approved, create a conversation between donor and requester
  if (status === "APPROVED" && !request.conversation) {
    const conv = await prisma.conversation.create({
      data: {
        requestId: id,
        participants: {
          create: [
            { userId: request.item.donorId },
            { userId: request.requesterId },
          ],
        },
      },
    });

    return NextResponse.json({ request: updated, conversationId: conv.id });
  }

  return NextResponse.json({ request: updated });
}
