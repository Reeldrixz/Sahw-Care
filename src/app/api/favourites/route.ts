import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/favourites — returns { itemIds: string[] } for the logged-in user
export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ itemIds: [] });

  const favs = await prisma.favourite.findMany({
    where: { userId: auth.userId },
    select: { itemId: true },
  });

  return NextResponse.json({ itemIds: favs.map((f) => f.itemId) });
}

// POST /api/favourites — toggle a favourite; returns { favourited: boolean }
export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId } = await req.json();
  if (!itemId || typeof itemId !== "string")
    return NextResponse.json({ error: "itemId required" }, { status: 400 });

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
