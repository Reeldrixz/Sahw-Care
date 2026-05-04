import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { awardImpactPoints } from "@/lib/trust";
import { logAbuseEvent } from "@/lib/abuse";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency guard
  const alreadyProcessed = await prisma.stripeEvent.findUnique({ where: { eventId: event.id } });
  if (alreadyProcessed) return NextResponse.json({ ok: true });

  await prisma.stripeEvent.create({ data: { eventId: event.id, type: event.type } });

  try {
    if (event.type === "checkout.session.completed") {
      await handleSessionCompleted(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "checkout.session.expired") {
      await handleSessionExpired(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "charge.refunded") {
      await handleChargeRefunded(event.data.object as Stripe.Charge);
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function handleSessionCompleted(session: Stripe.Checkout.Session) {
  const fundingId  = session.metadata?.fundingId;
  const itemId     = session.metadata?.itemId;
  const donorId    = session.metadata?.donorId;
  const registerId = session.metadata?.registerId;

  if (!fundingId || !itemId || !donorId || !registerId) return;

  const funding = await prisma.registerItemFunding.findUnique({ where: { id: fundingId } });
  if (!funding || funding.status !== "PENDING") return;

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;

  const item = await prisma.registerItem.findUnique({
    where:   { id: itemId },
    include: { register: { select: { creatorId: true, title: true } } },
  });
  if (!item) return;

  const { amountCents } = funding;
  const newTotal       = item.totalFundedCents + amountCents;
  const isFullyFunded  = item.standardPriceCents > 0 && newTotal >= item.standardPriceCents;
  const isFullFundInOne = isFullyFunded && item.totalFundedCents === 0;

  const newFundingStatus = isFullyFunded
    ? "FULLY_FUNDED"
    : newTotal > 0 ? "PARTIAL" : "UNFUNDED";

  const previousDonorIds = isFullyFunded
    ? (await prisma.registerItemFunding.findMany({
        where:    { registerItemId: itemId, donorId: { not: donorId }, status: "CONFIRMED" },
        select:   { donorId: true },
        distinct: ["donorId"],
      })).map((f) => f.donorId)
    : [];

  await prisma.$transaction(async (tx) => {
    await tx.registerItemFunding.update({
      where: { id: fundingId },
      data:  { status: "CONFIRMED", stripePaymentIntentId: paymentIntentId },
    });
    await tx.registerItem.update({
      where: { id: itemId },
      data:  { totalFundedCents: newTotal, fundingStatus: newFundingStatus },
    });
    await tx.user.update({
      where: { id: donorId },
      data:  { totalFundedCents: { increment: amountCents }, fundingCount: { increment: 1 } },
    });

    if (isFullyFunded) {
      await tx.fulfillmentQueue.create({
        data: { registerItemId: itemId, totalFundedCents: newTotal, status: "QUEUED" },
      });
      await tx.registerItem.update({
        where: { id: itemId },
        data:  { fundingStatus: "IN_FULFILLMENT" },
      });
      await tx.notification.create({
        data: {
          userId:  item.register.creatorId,
          type:    "ITEM_FULLY_FUNDED",
          message: `Your item "${item.name}" has been fully funded! Kradəl will fulfill it soon.`,
          link:    `/registers/${registerId}`,
        },
      });
      await tx.notification.create({
        data: {
          userId:  donorId,
          type:    "ITEM_FULLY_FUNDED",
          message: `You completed funding "${item.name}"! Kradəl will purchase and deliver it soon.`,
          link:    `/registers/${registerId}`,
        },
      });
      for (const prevDonorId of previousDonorIds) {
        await tx.notification.create({
          data: {
            userId:  prevDonorId,
            type:    "ITEM_FULLY_FUNDED",
            message: `An item you helped fund, "${item.name}", is now fully funded and will be fulfilled soon.`,
            link:    `/registers/${registerId}`,
          },
        });
      }
    }
  });

  Promise.all([
    awardImpactPoints(donorId, "REGISTER_ITEM_FUNDED", itemId),
    isFullFundInOne
      ? awardImpactPoints(donorId, "REGISTER_ITEM_FULL_FUND", itemId)
      : Promise.resolve(null),
    logAbuseEvent(donorId, "DISCOVER_REQUEST_CREATED", 0, { action: "ITEM_FUNDED", itemId, amountCents }, null as unknown as import("next/server").NextRequest),
  ]).catch(() => {});
}

async function handleSessionExpired(session: Stripe.Checkout.Session) {
  const fundingId = session.metadata?.fundingId;
  if (!fundingId) return;

  await prisma.registerItemFunding.deleteMany({
    where: { id: fundingId, status: "PENDING" },
  });
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent?.id ?? null;
  if (!paymentIntentId) return;

  const funding = await prisma.registerItemFunding.findFirst({
    where: { stripePaymentIntentId: paymentIntentId, status: "CONFIRMED" },
  });
  if (!funding) return;

  const item = await prisma.registerItem.findUnique({ where: { id: funding.registerItemId } });
  if (!item) return;

  const newTotal = Math.max(0, item.totalFundedCents - funding.amountCents);
  const newFundingStatus = newTotal >= (item.standardPriceCents || 1)
    ? "FULLY_FUNDED"
    : newTotal > 0 ? "PARTIAL" : "UNFUNDED";

  await prisma.$transaction(async (tx) => {
    await tx.registerItemFunding.update({
      where: { id: funding.id },
      data:  { status: "REFUNDED", refundedAt: new Date() },
    });
    await tx.registerItem.update({
      where: { id: item.id },
      data:  { totalFundedCents: newTotal, fundingStatus: newFundingStatus },
    });
    await tx.user.update({
      where: { id: funding.donorId },
      data:  {
        totalFundedCents: { decrement: funding.amountCents },
        fundingCount:     { decrement: 1 },
      },
    });
  });
}
