import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const city = searchParams.get("city");

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const where: Record<string, unknown> = {
    status: { in: ["VERIFIED", "AUTO_CONFIRMED"] },
    respondedAt: { gte: monthStart },
  };

  if (city) {
    where.request = {
      item: { location: { contains: city, mode: "insensitive" } },
    };
  }

  const count = await prisma.requestFulfillment.count({ where });
  return NextResponse.json({ fulfilledThisMonth: count });
}
