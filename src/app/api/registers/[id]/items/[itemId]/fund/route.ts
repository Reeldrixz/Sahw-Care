import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { awardImpactPoints } from "@/lib/trust";
import { logAbuseEvent } from "@/lib/abuse";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId } = await params;
  const { amountCents } = await req.json();

  if (!amountCents || typeof amountCents !== "number" || amountCents <= 0) {
    return NextResponse.json({ error: "amountCents must be a positive number" }, { status: 400 });
  }
  if (!Number.isInteger(amountCents)) {
    return NextResponse.json({ error: "amountCents must be a whole number" }, { status: 400 });
  }

  const [item, donor] = await Promise.all([
    prisma.registerItem.findUnique({
      where:   { id: itemId },
      include: { register: { select: { creatorId: true, title: true } } },
    }),
    prisma.user.findUnique({ where: { id: auth.userId }, select: { id: true, name: true, email: true } }),
  ]);

  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  if (!donor) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (item.register.creatorId === auth.userId) {
    return NextResponse.json({ error: "You cannot fund your own register item" }, { status: 400 });
  }
  if (["FULLY_FUNDED", "IN_FULFILLMENT", "FULFILLED"].includes(item.fundingStatus)) {
    return NextResponse.json({ error: "This item is already fully funded" }, { status: 409 });
  }

  const newTotal = item.totalFundedCents + amountCents;
  const isFullyFunded = item.standardPriceCents > 0 && newTotal >= item.standardPriceCents;

  const newFundingStatus = isFullyFunded
    ? "FULLY_FUNDED"
    : newTotal > 0
      ? "PARTIAL"
      : "UNFUNDED";

  const isFullFundInOne = isFullyFunded && item.totalFundedCents === 0;

  await prisma.$transaction(async (tx) => {
    await tx.registerItemFunding.create({
      data: { registerItemId: itemId, donorId: auth.userId, amountCents, status: "CONFIRMED" },
    });
    await tx.registerItem.update({
      where: { id: itemId },
      data: { totalFundedCents: newTotal, fundingStatus: newFundingStatus },
    });
    await tx.user.update({
      where: { id: auth.userId },
      data: {
        totalFundedCents: { increment: amountCents },
        fundingCount:     { increment: 1 },
      },
    });
    if (isFullyFunded) {
      await tx.fulfillmentQueue.create({
        data: { registerItemId: itemId, totalFundedCents: newTotal, status: "QUEUED" },
      });
      await tx.registerItem.update({
        where: { id: itemId },
        data:  { fundingStatus: "IN_FULFILLMENT" },
      });
      // Notify mother
      await tx.notification.create({
        data: {
          userId:  item.register.creatorId,
          type:    "ITEM_FULLY_FUNDED",
          message: `Your item "${item.name}" has been fully funded! Kradəl will fulfill it soon.`,
          link:    `/registers/${item.registerId}`,
        },
      });
    }
  });

  // Award impact points (fire-and-forget)
  Promise.all([
    awardImpactPoints(auth.userId, "REGISTER_ITEM_FUNDED", itemId),
    isFullFundInOne
      ? awardImpactPoints(auth.userId, "REGISTER_ITEM_FULL_FUND", itemId)
      : Promise.resolve(null),
    logAbuseEvent(auth.userId, "DISCOVER_REQUEST_CREATED", 0, { action: "ITEM_FUNDED", itemId, amountCents }, req),
  ]).catch(() => {});

  return NextResponse.json({
    ok: true,
    newTotal,
    fundingStatus: isFullyFunded ? "IN_FULFILLMENT" : newFundingStatus,
    isFullyFunded,
  }, { status: 201 });
}
