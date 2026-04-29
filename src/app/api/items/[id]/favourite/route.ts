import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: itemId } = await params;

  const existing = await prisma.favourite.findUnique({
    where: { userId_itemId: { userId: auth.userId, itemId } },
  });

  if (existing) {
    await prisma.favourite.delete({ where: { id: existing.id } });
    return NextResponse.json({ favourited: false });
  } else {
    await prisma.favourite.create({ data: { userId: auth.userId, itemId } });
    return NextResponse.json({ favourited: true });
  }
}
