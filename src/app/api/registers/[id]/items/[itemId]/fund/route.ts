import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { computeBreakdown, MIN_GIFT_CENTS } from "@/lib/checkoutFees";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId } = await params;
  const body = await req.json();
  const { amountCents, supportOn = true, coverStripe = true } = body;

  if (!amountCents || typeof amountCents !== "number" || !Number.isInteger(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "amountCents must be a positive integer" }, { status: 400 });
  }
  if (amountCents < MIN_GIFT_CENTS) {
    return NextResponse.json({ error: `Minimum contribution is $${MIN_GIFT_CENTS / 100}` }, { status: 400 });
  }

  const [item, donor] = await Promise.all([
    prisma.registerItem.findUnique({
      where:   { id: itemId },
      include: { register: { select: { id: true, creatorId: true, title: true } } },
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

  const breakdown = computeBreakdown(amountCents, Boolean(supportOn), Boolean(coverStripe));

  const existingPending = await prisma.registerItemFunding.findFirst({
    where: { registerItemId: itemId, donorId: auth.userId, status: "PENDING" },
  });

  if (existingPending) {
    if (existingPending.stripeSessionId) {
      try {
        const stripe = getStripe();
        const existingSession = await stripe.checkout.sessions.retrieve(existingPending.stripeSessionId);
        if (existingSession.status === "open") {
          return NextResponse.json({ sessionUrl: existingSession.url }, { status: 200 });
        }
      } catch {
        // Session not found — fall through
      }
    }
    await prisma.registerItemFunding.delete({ where: { id: existingPending.id } });
  }

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const registerId = item.register.id;

  const funding = await prisma.registerItemFunding.create({
    data: {
      registerItemId:  itemId,
      donorId:         auth.userId,
      amountCents:     breakdown.itemSubtotal,
      kradelFee:       breakdown.kradelFee,
      optionalSupport: breakdown.optionalSupport,
      stripeFee:       breakdown.stripeFee,
      totalCharged:    breakdown.total,
      status:          "PENDING",
    },
  });

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    await prisma.registerItemFunding.delete({ where: { id: funding.id } });
    return NextResponse.json({ error: "Payment service is unavailable" }, { status: 503 });
  }

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "cad",
          unit_amount: breakdown.total,
          product_data: {
            name: item.name,
            description: `Gift contribution${breakdown.stripeFee > 0 ? " (incl. processing fee)" : ""}`,
          },
        },
      }],
      metadata: {
        fundingId:  funding.id,
        itemId,
        donorId:    auth.userId,
        registerId,
      },
      success_url: `${appUrl}/registers/${registerId}?payment=success&item=${itemId}`,
      cancel_url:  `${appUrl}/registers/${registerId}?payment=cancel`,
    });
  } catch (err) {
    await prisma.registerItemFunding.delete({ where: { id: funding.id } });
    console.error("Stripe session creation failed:", err);
    return NextResponse.json({ error: "Failed to create payment session" }, { status: 500 });
  }

  await prisma.registerItemFunding.update({
    where: { id: funding.id },
    data:  { stripeSessionId: session.id },
  });

  return NextResponse.json({ sessionUrl: session.url }, { status: 201 });
}
