import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const now      = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [
      totalFundedThisMonth,
      totalSpentThisMonth,
      queueCount,
      fulfilledThisMonth,
      allTimeFunded,
    ] = await Promise.all([
      prisma.registerItemFunding.aggregate({
        where:  { createdAt: { gte: monthStart, lte: monthEnd }, status: "CONFIRMED" },
        _sum:   { amountCents: true },
      }),
      prisma.fulfillmentQueue.aggregate({
        where:  { deliveredAt: { gte: monthStart, lte: monthEnd } },
        _sum:   { actualCostCents: true },
      }),
      prisma.fulfillmentQueue.count({
        where: { status: { in: ["QUEUED", "PURCHASED", "DISPATCHED"] } },
      }),
      prisma.fulfillmentQueue.count({
        where: { status: "DELIVERED", deliveredAt: { gte: monthStart, lte: monthEnd } },
      }),
      prisma.registerItemFunding.aggregate({
        where: { status: "CONFIRMED" },
        _sum:  { amountCents: true },
      }),
    ]);

    const funded = totalFundedThisMonth._sum.amountCents ?? 0;
    const spent  = totalSpentThisMonth._sum.actualCostCents ?? 0;

    return NextResponse.json({
      month:            `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      totalFundedCents: funded,
      totalSpentCents:  spent,
      surplusCents:     funded - spent,
      itemsInQueue:     queueCount,
      itemsFulfilledThisMonth: fulfilledThisMonth,
      allTimeFundedCents: allTimeFunded._sum.amountCents ?? 0,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
