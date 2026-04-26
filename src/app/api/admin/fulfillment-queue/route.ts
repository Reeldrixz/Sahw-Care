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
