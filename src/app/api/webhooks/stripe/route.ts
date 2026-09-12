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

async function handlePlatformSupportCompleted(session: Stripe.Checkout.Session) {
  const contributionId = session.metadata?.contributionId;
  const donorId        = session.metadata?.donorId;
  if (!contributionId || !donorId) return;

  const contribution = await prisma.supportContribution.findUnique({ where: { id: contributionId } });
  if (!contribution || contribution.status !== "PENDING") return;

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;

  await prisma.supportContribution.update({
    where: { id: contributionId },
    data:  { status: "CONFIRMED", stripePaymentIntentId: paymentIntentId, confirmedAt: new Date() },
  });
}

async function handleSessionCompleted(session: Stripe.Checkout.Session) {
  if (session.metadata?.type === "platform_support") {
    await handlePlatformSupportCompleted(session);
    return;
  }

  const fundingId  = session.metadata?.fundingId;
  const itemId     = session.metadata?.itemId;
  const registerId = session.metadata?.registerId;

  // donorId is OPTIONAL now. A guest funds without a Kradel account, so its
  // absence is a legitimate state rather than a malformed session — isGuest says
  // so explicitly, which is the difference between "no donor on purpose" and
  // "metadata got lost".
  const donorId = session.metadata?.donorId || null;
  const isGuest = session.metadata?.isGuest === "true";

  // fundingId, itemId and registerId remain REQUIRED. Without fundingId there is
  // no row to mark paid and nothing this function can safely do, which means a
  // real payment is sitting at Stripe unrecorded — the loudest possible failure,
  // so it is logged as an error rather than returning quietly.
  if (!fundingId || !itemId || !registerId) {
    console.error(
      "[stripe-webhook] PAYMENT RECEIVED WITH INCOMPLETE METADATA — money may be unrecorded",
      { sessionId: session.id, fundingId, itemId, registerId },
    );
    return;
  }
  if (!donorId && !isGuest) {
    // Neither a donor nor an explicit guest marker: treat as suspect and say so,
    // but continue — the payment is real and Phase 1 must still record it.
    console.error(
      "[stripe-webhook] session has no donorId and is not marked isGuest — recording anyway",
      { sessionId: session.id, fundingId },
    );
  }

  const funding = await prisma.registerItemFunding.findUnique({ where: { id: fundingId } });
  // IDEMPOTENCY. Stripe retries webhooks, and a handler that ran once must not
  // run twice. This guard is the whole protection against double-counting a
  // payment, and it must survive any future refactor of this function.
  if (!funding || funding.status !== "PENDING") return;

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;

  const item = await prisma.registerItem.findUnique({
    where:   { id: itemId },
    include: {
      register: {
        select: {
          creatorId: true, title: true, addressMode: true,
          savedAddress: { select: { id: true } },
        },
      },
    },
  });
  if (!item) return;

  const { amountCents } = funding;
  const newTotal       = item.totalFundedCents + amountCents;
  const isFullyFunded  = item.standardPriceCents > 0 && newTotal >= item.standardPriceCents;
  const isFullFundInOne = isFullyFunded && item.totalFundedCents === 0;

  const newFundingStatus = isFullyFunded
    ? "FULLY_FUNDED"
    : newTotal > 0 ? "PARTIAL" : "UNFUNDED";

  // Other donors who already funded this item, for the "it's complete" notice.
  // donorId may be null (guest), and `{ not: null }` in Prisma means "has a
  // value" — which is exactly right here: guests have no inbox to notify, so
  // they are excluded from the recipient list while still being counted as
  // contributors everywhere that counts rows rather than users.
  const previousDonorIds = isFullyFunded
    ? (await prisma.registerItemFunding.findMany({
        where: {
          registerItemId: itemId,
          status:         "CONFIRMED",
          donorId:        donorId ? { not: donorId } : { not: null },
        },
        select:   { donorId: true },
        distinct: ["donorId"],
      }))
        .map((f) => f.donorId)
        .filter((d): d is string => d !== null)
    : [];

  // ════════════════════════════════════════════════════════════════════════
  // PHASE 1 — RECORD THE MONEY. Unconditional, isolated, idempotent.
  //
  // Nothing donor-keyed may enter this transaction. It previously contained
  // tx.user.update({ where: { id: donorId } }), which for a guest throws and
  // rolls back the CONFIRMED status and the item total — while Stripe keeps the
  // money and retries into the same failure forever. That single call was the
  // money-vanishes bug, and it now lives in Phase 3.
  //
  // If this transaction commits, the payment is recorded. That is the invariant
  // the whole restructure exists to protect, and it must hold for a guest
  // exactly as it does for an account holder.
  // ════════════════════════════════════════════════════════════════════════
  await prisma.$transaction(async (tx) => {
    await tx.registerItemFunding.update({
      where: { id: fundingId },
      data:  { status: "CONFIRMED", stripePaymentIntentId: paymentIntentId },
    });
    await tx.registerItem.update({
      where: { id: itemId },
      data:  { totalFundedCents: newTotal, fundingStatus: newFundingStatus },
    });
  });

  // ── Overlay marker ───────────────────────────────────────────────────────
  // Bump the event's contribution counter so the broadcast overlay's 2s stream
  // knows something changed and recomputes. Deliberately OUTSIDE the Phase 1
  // transaction and independently failable: a missed animation is cosmetic, a
  // payment rolled back for an animation marker would be precisely the bug the
  // phase split exists to prevent.
  //
  // funding.fundraisingEventId is read from the row rather than from metadata,
  // because attribution was resolved and stored at creation. A non-null value
  // implies the event still exists — the foreign key is ON DELETE SET NULL, so a
  // deleted event would have nulled this.
  if (funding.fundraisingEventId) {
    try {
      await prisma.fundraisingEvent.update({
        where: { id: funding.fundraisingEventId },
        data:  { contributionCounter: { increment: 1 } },
      });
    } catch (err) {
      console.error("[stripe-webhook] overlay marker bump failed — payment IS recorded", { fundingId, err });
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // PHASE 2 — FULFILMENT. Register-keyed, so already guest-safe: what happens
  // when an item completes depends on the mother's register and address mode,
  // never on who paid. Wrapped separately so a fulfilment failure cannot undo
  // the recorded payment in Phase 1.
  // ════════════════════════════════════════════════════════════════════════
  try {
    await prisma.$transaction(async (tx) => {
    if (isFullyFunded) {
      const hasSavedAddress = !!item.register.savedAddress;
      const useSavedAddress = item.register.addressMode === "SAVED_PER_REGISTER" && hasSavedAddress;

      if (useSavedAddress) {
        // Address on file — go straight to fulfilment queue
        await tx.fulfillmentQueue.create({
          data: { registerItemId: itemId, totalFundedCents: newTotal, status: "QUEUED" },
        });
        await tx.registerItem.update({
          where: { id: itemId },
          data:  { status: "AWAITING_PURCHASE", fundingStatus: "IN_FULFILLMENT" },
        });
        await tx.notification.create({
          data: {
            userId:  item.register.creatorId,
            type:    "ITEM_FULLY_FUNDED",
            message: `Your ${item.name} is fully funded and will ship to your saved address. We'll notify you when it's on its way.`,
            link:    `/registers/${registerId}`,
          },
        });
      } else {
        // Ask per shipment — hold for address confirmation
        await tx.registerItem.update({
          where: { id: itemId },
          data:  { status: "AWAITING_ADDRESS", fundingStatus: "FULLY_FUNDED" },
        });
        await tx.notification.create({
          data: {
            userId:  item.register.creatorId,
            type:    "ITEM_FULLY_FUNDED",
            message: `Your ${item.name} is fully funded! Please confirm your shipping address so we can send it to you.`,
            link:    `/registers/${registerId}?confirm=true`,
          },
        });
      }

    }
    });
  } catch (err) {
    // The payment is already recorded. Fulfilment failing is serious and needs
    // a human, but it is not a reason to lose the money.
    console.error("[stripe-webhook] PHASE 2 fulfilment failed — payment IS recorded", { fundingId, itemId, err });
  }

  // ════════════════════════════════════════════════════════════════════════
  // PHASE 3 — DONOR SIDE EFFECTS. Every one of these is skipped for a guest,
  // and every one is independently wrapped: a failure here can neither undo the
  // recorded payment nor prevent the others from running.
  //
  // Guest answers, each deliberate rather than incidental:
  //   user counters      — skipped; there is no row to increment
  //   impact points      — skipped; a points ledger needs an account to accrue to
  //   donor notification — skipped; a guest has no inbox. She is still counted
  //                        as a contributor everywhere that counts funding ROWS
  //                        rather than users, so her contribution is visible.
  //   abuse logging      — skipped; it already needs a NextRequest it does not
  //                        have here, and guest abuse belongs with rate limiting
  //                        rather than this ledger.
  // ════════════════════════════════════════════════════════════════════════
  if (donorId) {
    await Promise.allSettled([
      prisma.user.update({
        where: { id: donorId },
        data:  { totalFundedCents: { increment: amountCents }, fundingCount: { increment: 1 } },
      }),
      isFullyFunded
        ? prisma.notification.create({
            data: {
              userId:  donorId,
              type:    "ITEM_FULLY_FUNDED",
              message: `You completed funding "${item.name}"! Kradel will purchase and deliver it soon.`,
              link:    `/registers/${registerId}`,
            },
          })
        : Promise.resolve(null),
      awardImpactPoints(donorId, "REGISTER_ITEM_FUNDED", itemId),
      isFullFundInOne
        ? awardImpactPoints(donorId, "REGISTER_ITEM_FULL_FUND", itemId)
        : Promise.resolve(null),
      logAbuseEvent(donorId, "DISCOVER_REQUEST_CREATED", 0, { action: "ITEM_FUNDED", itemId, amountCents }, null as unknown as import("next/server").NextRequest),
    ]).then((rs) => {
      const failed = rs.filter((r) => r.status === "rejected");
      if (failed.length) console.error("[stripe-webhook] PHASE 3 donor side effects failed", { fundingId, donorId, failed });
    });
  }

  // Previous contributors are notified regardless of who completed the item —
  // they are account holders by construction, since guests were filtered out of
  // previousDonorIds above.
  if (isFullyFunded && previousDonorIds.length) {
    await Promise.allSettled(previousDonorIds.map((prevDonorId) =>
      prisma.notification.create({
        data: {
          userId:  prevDonorId,
          type:    "ITEM_FULLY_FUNDED",
          message: `An item you helped fund, "${item.name}", is now fully funded and will be fulfilled soon.`,
          link:    `/registers/${registerId}`,
        },
      })
    ));
  }
}

async function handleSessionExpired(session: Stripe.Checkout.Session) {
  const fundingId = session.metadata?.fundingId;
  if (fundingId) {
    await prisma.registerItemFunding.deleteMany({ where: { id: fundingId, status: "PENDING" } });
    return;
  }
  const contributionId = session.metadata?.contributionId;
  if (contributionId) {
    await prisma.supportContribution.deleteMany({ where: { id: contributionId, status: "PENDING" } });
  }
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

  // PHASE 1 — record the refund. Same rule as a payment, for the same reason:
  // tx.user.update used to live in here, and for a guest refund it throws and
  // rolls back the REFUNDED status and the item total. The refund would then have
  // happened at Stripe while Kradel still showed the money as funded.
  await prisma.$transaction(async (tx) => {
    await tx.registerItemFunding.update({
      where: { id: funding.id },
      data:  { status: "REFUNDED", refundedAt: new Date() },
    });
    await tx.registerItem.update({
      where: { id: item.id },
      data:  { totalFundedCents: newTotal, fundingStatus: newFundingStatus },
    });
  });

  // PHASE 3 — donor counters, outside the transaction and skipped for guests.
  // There is no Phase 2 here: a refund has no fulfilment step.
  if (funding.donorId) {
    try {
      await prisma.user.update({
        where: { id: funding.donorId },
        data:  {
          totalFundedCents: { decrement: funding.amountCents },
          fundingCount:     { decrement: 1 },
        },
      });
    } catch (err) {
      console.error("[stripe-webhook] refund donor counters failed — refund IS recorded", { fundingId: funding.id, err });
    }
  }
}
