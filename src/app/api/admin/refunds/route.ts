import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const fundings = await prisma.registerItemFunding.findMany({
      where: { status: "CONFIRMED" },
      select: {
        id: true,
        amountCents: true,
        createdAt: true,
        stripePaymentIntentId: true,
        donor: { select: { name: true, email: true } },
        registerItem: {
          select: {
            name: true,
            register: { select: { title: true, creator: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ fundings });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { fundingId } = await req.json();
    if (!fundingId) return NextResponse.json({ error: "fundingId required" }, { status: 400 });

    const funding = await prisma.registerItemFunding.findUnique({
      where: { id: fundingId },
      include: {
        registerItem: {
          include: {
            fulfillmentQueue: true,
            register: { select: { creatorId: true } },
          },
        },
        donor: { select: { name: true } },
      },
    });

    if (!funding) return NextResponse.json({ error: "Funding not found" }, { status: 404 });
    if (funding.status !== "CONFIRMED") return NextResponse.json({ error: "Only CONFIRMED fundings can be refunded" }, { status: 400 });
    if (!funding.stripePaymentIntentId) return NextResponse.json({ error: "No payment intent on record. Cannot refund" }, { status: 400 });

    const stripe = getStripe();
    await stripe.refunds.create({ payment_intent: funding.stripePaymentIntentId });

    const item = funding.registerItem;
    const newTotal = Math.max(0, item.totalFundedCents - funding.amountCents);
    const stillFullyFunded = item.standardPriceCents > 0 && newTotal >= item.standardPriceCents;
    const wasFullyFunded = ["FULLY_FUNDED", "IN_FULFILLMENT"].includes(item.fundingStatus);

    let newFundingStatus = item.fundingStatus;
    if (wasFullyFunded && !stillFullyFunded) {
      newFundingStatus = newTotal > 0 ? "PARTIAL" : "UNFUNDED";
    }

    const amountStr = `$${(funding.amountCents / 100).toFixed(2)}`;

    await prisma.$transaction(async (tx) => {
      await tx.registerItemFunding.update({
        where: { id: fundingId },
        data: { status: "REFUNDED", refundedAt: new Date() },
      });
      await tx.registerItem.update({
        where: { id: item.id },
        data: { totalFundedCents: newTotal, fundingStatus: newFundingStatus as never },
      });
      if (wasFullyFunded && !stillFullyFunded && item.fulfillmentQueue) {
        await tx.fulfillmentQueue.delete({ where: { registerItemId: item.id } });
      }
      await tx.notification.create({
        data: {
          userId: funding.donorId,
          type: "ADMIN_MESSAGE",
          message: `Your ${amountStr} contribution to "${item.name}" has been refunded. It will appear on your card in 5 to 10 days.`,
          link: `/registers/${item.registerId}`,
        },
      });
      await tx.notification.create({
        data: {
          userId: item.register.creatorId,
          type: "ADMIN_MESSAGE",
          message: `A contribution toward "${item.name}" was refunded. Your register progress has been updated.`,
          link: `/registers/${item.registerId}`,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin refund error:", err);
    return NextResponse.json({ error: "Refund failed" }, { status: 500 });
  }
}
