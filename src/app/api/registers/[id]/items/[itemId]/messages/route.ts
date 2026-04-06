import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { itemId } = await params;
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.registerItem.findUnique({
    where: { id: itemId },
    include: { register: true, assignment: true },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only mom (register creator) or the assigned donor can read messages
  const isMom = item.register.creatorId === auth.userId;
  const isDonor = item.assignment?.donorId === auth.userId;
  if (!isMom && !isDonor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!item.assignment) return NextResponse.json({ messages: [] });

  const messages = await prisma.registerMessage.findMany({
    where: { assignmentId: item.assignment.id },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { itemId } = await params;
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.registerItem.findUnique({
    where: { id: itemId },
    include: { register: true, assignment: true },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!item.assignment) return NextResponse.json({ error: "No donor assigned yet" }, { status: 400 });

  const isMom = item.register.creatorId === auth.userId;
  const isDonor = item.assignment.donorId === auth.userId;
  if (!isMom && !isDonor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });

  const message = await prisma.registerMessage.create({
    data: {
      text: text.trim(),
      senderId: auth.userId,
      assignmentId: item.assignment.id,
    },
    include: { sender: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ message }, { status: 201 });
}
