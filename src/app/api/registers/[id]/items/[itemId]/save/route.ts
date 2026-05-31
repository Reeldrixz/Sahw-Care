import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; itemId: string }>;

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { id: registerId, itemId } = await params;

  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.registerItem.findFirst({
    where: { id: itemId, registerId },
    select: { id: true },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.savedItem.findFirst({
    where: { userId: auth.userId, itemId },
  });

  if (existing) {
    await prisma.savedItem.delete({ where: { id: existing.id } });
    return NextResponse.json({ saved: false });
  }

  await prisma.savedItem.create({
    data: { userId: auth.userId, registerId, itemId },
  });
  return NextResponse.json({ saved: true });
}
