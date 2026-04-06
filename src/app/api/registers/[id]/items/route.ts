import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = await prisma.registerItem.findMany({
    where: { registerId: id },
    orderBy: { createdAt: "asc" },
    include: {
      assignment: {
        include: { donor: { select: { id: true, name: true } } },
      },
    },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const register = await prisma.register.findUnique({ where: { id } });
  if (!register) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (register.creatorId !== auth.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, quantity, note, storeLinks } = await req.json();
  if (!name) return NextResponse.json({ error: "Item name is required" }, { status: 400 });

  const item = await prisma.registerItem.create({
    data: {
      registerId: id,
      name,
      quantity: quantity ?? "1",
      note: note ?? null,
      storeLinks: storeLinks ?? [],
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
