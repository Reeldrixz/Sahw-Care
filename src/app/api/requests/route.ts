import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type"); // "sent" | "received"

  let requests;

  if (type === "received") {
    requests = await prisma.request.findMany({
      where: { item: { donorId: user.userId } },
      include: {
        item: { select: { id: true, title: true, images: true } },
        requester: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } else {
    requests = await prisma.request.findMany({
      where: { requesterId: user.userId },
      include: {
        item: {
          select: {
            id: true,
            title: true,
            images: true,
            donor: { select: { id: true, name: true, avatar: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId, note } = await req.json();

  if (!itemId) return NextResponse.json({ error: "itemId is required" }, { status: 400 });

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  if (item.status !== "ACTIVE") {
    return NextResponse.json({ error: "This item is no longer available" }, { status: 409 });
  }

  if (item.donorId === user.userId) {
    return NextResponse.json({ error: "You cannot request your own item" }, { status: 400 });
  }

  const existing = await prisma.request.findFirst({
    where: { itemId, requesterId: user.userId },
  });

  if (existing) {
    return NextResponse.json({ error: "You have already requested this item" }, { status: 409 });
  }

  const request = await prisma.request.create({
    data: { itemId, requesterId: user.userId, note: note ?? null },
    include: {
      item: { select: { id: true, title: true, donor: { select: { id: true, name: true } } } },
    },
  });

  return NextResponse.json({ request }, { status: 201 });
}
