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

  // A guest has no User and therefore no name. She still appears — she
  // contributed — under a non-identifying label rather than being hidden, which
  // would make the list disagree with the total.
  const contributors = item.funding.map((f) => ({
    firstName: f.donor ? f.donor.name.split(" ")[0] : "Someone",
    amountCents: f.amountCents,
  }));

  // Counting distinct donorId would collapse EVERY guest into a single entry,
  // because they all share the value null — three guests would report as one
  // contributor. So: distinct account holders, plus one per guest row, since each
  // guest row is a separate person paying separately.
  const accountDonors = new Set(
    item.funding.map((f) => f.donorId).filter((d): d is string => d !== null)
  ).size;
  const guestContributions = item.funding.filter((f) => f.donorId === null).length;
  const donorCount = accountDonors + guestContributions;

  return NextResponse.json({
    totalFundedCents:   item.totalFundedCents,
    standardPriceCents: item.standardPriceCents,
    fundingStatus:      item.fundingStatus,
    donorCount,
    contributors,
  });
}
