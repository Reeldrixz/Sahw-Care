import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId } = await params;

  const item = await prisma.registerItem.findUnique({
    where:   { id: itemId },
    include: {
      funding: {
        where:   { status: "CONFIRMED" },
        include: { donor: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contributors = item.funding.map((f) => ({
    firstName: f.donor.name.split(" ")[0],
    amountCents: f.amountCents,
  }));

  const donorCount = new Set(item.funding.map((f) => f.donorId)).size;

  return NextResponse.json({
    totalFundedCents:   item.totalFundedCents,
    standardPriceCents: item.standardPriceCents,
    fundingStatus:      item.fundingStatus,
    donorCount,
    contributors,
  });
}
