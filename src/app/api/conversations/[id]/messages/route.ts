// DEPRECATED: chat replaced by PickupCoordination system.
// Kept temporarily; remove after 30 days of no production traffic.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: { participants: true },
  });

  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const isParticipant = conversation.participants.some((p) => p.userId === user.userId);
  if (!isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: { participants: true },
  });

  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const isParticipant = conversation.participants.some((p) => p.userId === user.userId);
  if (!isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Message text is required" }, { status: 400 });

  const message = await prisma.message.create({
    data: {
      text: text.trim(),
      senderId: user.userId,
      conversationId: id,
    },
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
    },
  });

  return NextResponse.json({ message }, { status: 201 });
}
