import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amountCents } = await req.json();

  if (!amountCents || typeof amountCents !== "number") {
    return NextResponse.json({ error: "amountCents is required" }, { status: 400 });
  }
  if (!Number.isInteger(amountCents) || amountCents < 100) {
    return NextResponse.json({ error: "amountCents must be a whole number of at least 100 (minimum $1.00)" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const contribution = await prisma.supportContribution.create({
    data: { donorId: auth.userId, amountCents, status: "PENDING" },
  });

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    await prisma.supportContribution.delete({ where: { id: contribution.id } });
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
          unit_amount: amountCents,
          product_data: {
            name: "Support Kradəl operations",
            description: "Helps fund hosting, payment processing, and fulfilment for Kradəl Care.",
          },
        },
      }],
      metadata: {
        type:           "platform_support",
        donorId:        auth.userId,
        amountCents:    amountCents.toString(),
        contributionId: contribution.id,
      },
      success_url: `${appUrl}/support?payment=success`,
      cancel_url:  `${appUrl}/support?payment=cancel`,
    });
  } catch (err) {
    await prisma.supportContribution.delete({ where: { id: contribution.id } });
    console.error("Stripe session creation failed:", err);
    return NextResponse.json({ error: "Failed to create payment session" }, { status: 500 });
  }

  await prisma.supportContribution.update({
    where: { id: contribution.id },
    data:  { stripeSessionId: session.id },
  });

  return NextResponse.json({ sessionUrl: session.url }, { status: 201 });
}
