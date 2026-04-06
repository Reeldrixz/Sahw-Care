import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { itemId } = await params;
  const item = await prisma.registerItem.findUnique({
    where: { id: itemId },
    include: {
      register: { include: { creator: { select: { id: true, name: true } } } },
      assignment: {
        include: {
          donor: { select: { id: true, name: true } },
          messages: {
            orderBy: { createdAt: "asc" },
            include: { sender: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const register = await prisma.register.findUnique({ where: { id } });
  if (!register) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (register.creatorId !== auth.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, quantity, note, storeLinks } = await req.json();
  const item = await prisma.registerItem.update({
    where: { id: itemId },
    data: {
      ...(name && { name }),
      ...(quantity && { quantity }),
      ...(note !== undefined && { note }),
      ...(storeLinks && { storeLinks }),
    },
  });

  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  const token = await getTokenFromRequest(_req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const register = await prisma.register.findUnique({ where: { id } });
  if (!register) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (register.creatorId !== auth.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.registerItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
