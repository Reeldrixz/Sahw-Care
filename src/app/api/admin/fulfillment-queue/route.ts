import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    if (status === "AWAITING_ADDRESS") {
      const items = await prisma.registerItem.findMany({
        where: { status: "AWAITING_ADDRESS" },
        select: {
          id: true, name: true, updatedAt: true,
          register: {
            select: {
              id: true, creatorId: true, city: true,
              creator: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { updatedAt: "asc" },
        take: 200,
      });
      return NextResponse.json({ awaitingAddress: items });
    }

    const queue = await prisma.fulfillmentQueue.findMany({
      where: status ? { status: status as never } : undefined,
      include: {
        registerItem: {
          select: {
            id: true, name: true, category: true, quantity: true,
            totalFundedCents: true, standardPriceCents: true,
            register: {
              select: {
                id: true, title: true, city: true,
                creator: { select: { id: true, name: true, location: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { status: "asc" },
        { queuedAt: "asc" },
      ],
    });

    return NextResponse.json({ queue });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { itemId } = await req.json();
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  const item = await prisma.registerItem.findUnique({
    where: { id: itemId },
    select: {
      id: true, name: true, status: true,
      register: { select: { id: true, creatorId: true } },
    },
  });

  if (!item || item.status !== "AWAITING_ADDRESS") {
    return NextResponse.json({ error: "Item not awaiting address" }, { status: 400 });
  }

  await prisma.notification.create({
    data: {
      userId:  item.register.creatorId,
      type:    "ADDRESS_REMINDER",
      message: `Reminder: your ${item.name} needs a shipping address. Please confirm it to continue.`,
      link:    `/registers/${item.register.id}?confirm=true&item=${item.id}`,
    },
  });

  return NextResponse.json({ ok: true });
}
