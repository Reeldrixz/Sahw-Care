import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      donor: { select: { id: true, name: true, avatar: true, trustRating: true, location: true } },
      _count: { select: { requests: true } },
    },
  });

  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  return NextResponse.json({ item });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  if (item.donorId !== user.userId && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, category, condition, quantity, location, description, images, urgent, status } = body;

  const updated = await prisma.item.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(category && { category }),
      ...(condition && { condition }),
      ...(quantity && { quantity }),
      ...(location && { location }),
      ...(description !== undefined && { description }),
      ...(images && { images }),
      ...(urgent !== undefined && { urgent }),
      ...(status && user.role === "ADMIN" && { status }),
    },
    include: {
      donor: { select: { id: true, name: true, avatar: true } },
    },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  if (item.donorId !== user.userId && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.item.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
