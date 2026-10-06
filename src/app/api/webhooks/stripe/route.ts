import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { awardImpactPoints } from "@/lib/trust";
import { logAbuseEvent } from "@/lib/abuse";
import {
  withStripeEvent, isDuplicateStripeEvent, applyConfirmedPayment, applyRefund,
} from "@/lib/stripeLedger";

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

  // Fast path for a redelivery of an event already processed. Not the guard
  // itself: every handler records the StripeEvent row inside the same
  // transaction as its work (lib/stripeLedger withStripeEvent), so an event is
  // marked processed only if its work committed.
  const alreadyProcessed = await prisma.stripeEvent.findUnique({ where: { eventId: event.id } });
  if (alreadyProcessed) return NextResponse.json({ ok: true });

  try {
    if (event.type === "checkout.session.completed") {
      await handleSessionCompleted(event, event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "checkout.session.expired") {
      await handleSessionExpired(event, event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "charge.refunded") {
      await handleChargeRefunded(event, event.data.object as Stripe.Charge);
    } else {
      // Not one we act on; recorded so redeliveries short-circuit.
      await withStripeEvent(event.id, event.type, async () => {});
    }
  } catch (err) {
    // The same event delivered twice at once: the other delivery committed it.
    if (isDuplicateStripeEvent(err)) return NextResponse.json({ ok: true });
    // Anything else rolled back with its StripeEvent row, so Stripe's retry
    // will process it.
    console.error(`Webhook handler error for ${event.type}:`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function paymentIntentIdOf(pi: string | Stripe.PaymentIntent | null): string | null {
  return typeof pi === "string" ? pi : pi?.id ?? null;
}

async function handlePlatformSupportCompleted(event: Stripe.Event, session: Stripe.Checkout.Session) {
  const contributionId = session.metadata?.contributionId;
  const donorId        = session.metadata?.donorId;

  await withStripeEvent(event.id, event.type, async (tx) => {
    if (!contributionId || !donorId) return;
    await tx.supportContribution.updateMany({
      where: { id: contributionId, status: "PENDING" },
      data:  {
        status: "CONFIRMED",
        stripePaymentIntentId: paymentIntentIdOf(session.payment_intent),
        confirmedAt: new Date(),
      },
    });
  });
}

async function handleSessionCompleted(event: Stripe.Event, session: Stripe.Checkout.Session) {
  if (session.metadata?.type === "platform_support") {
    await handlePlatformSupportCompleted(event, session);
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
  // so it is logged as an error. The event is still recorded: a retry carries
  // the same metadata and could not do better.
  if (!fundingId || !itemId || !registerId) {
    console.error(
      "[stripe-webhook] PAYMENT RECEIVED WITH INCOMPLETE METADATA — money may be unrecorded",
      { sessionId: session.id, fundingId, itemId, registerId },
    );
    await withStripeEvent(event.id, event.type, async () => {});
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

  // ════════════════════════════════════════════════════════════════════════
  // PHASE 1 — RECORD THE MONEY. Unconditional, isolated, exactly once.
  //
  // One transaction: the StripeEvent row, the contribution PENDING → CONFIRMED
  // (conditional, so it can only happen once), and the item total, computed
  // from the item row locked FOR UPDATE so two payments landing together are
  // both counted. See lib/stripeLedger.
  //
  // Nothing donor-keyed may enter this transaction. It previously contained
  // tx.user.update({ where: { id: donorId } }), which for a guest throws and
  // rolls back the CONFIRMED status and the item total — while Stripe keeps the
  // money and retries into the same failure forever. That lives in Phase 3.
  // ════════════════════════════════════════════════════════════════════════
  const applied = await withStripeEvent(event.id, event.type, (tx) =>
    applyConfirmedPayment(tx, fundingId, paymentIntentIdOf(session.payment_intent)),
  );
  // Already confirmed by an earlier delivery, or expired and deleted.
  if (!applied) return;

  if (applied.itemId !== itemId) {
    console.error("[stripe-webhook] session itemId differs from the funding's item — used the funding's", {
      fundingId, sessionItemId: itemId, fundingItemId: applied.itemId,
    });
  }

  // Everything below runs after the money is recorded and must not throw: a
  // throw here would answer 500, and the retry would find the event processed.

  // ── Overlay marker ───────────────────────────────────────────────────────
  // Bump the event's contribution counter so the broadcast overlay's 2s stream
  // knows something changed. Outside Phase 1 on purpose: a missed animation is
  // cosmetic; a payment rolled back for an animation marker would not be.
  if (applied.fundraisingEventId) {
    try {
      await prisma.fundraisingEvent.update({
        where: { id: applied.fundraisingEventId },
        data:  { contributionCounter: { increment: 1 } },
      });
    } catch (err) {
      console.error("[stripe-webhook] overlay marker bump failed — payment IS recorded", { fundingId, err });
    }
  }

  // Phase 2 and the completion notices act only for the payment that COMPLETED
  // the item. Before the item row was locked, a second payment landing on an
  // already-funded item re-ran fulfilment (a duplicate queue entry, which the
  // unique registerItemId rejected) and re-sent the "fully funded" notices.
  const { becameFullyFunded, isFullFundInOne, newTotalCents } = applied;

  let item: {
    name: string;
    register: { creatorId: string; addressMode: string; savedAddress: { id: string } | null };
  } | null = null;
  try {
    item = await prisma.registerItem.findUnique({
      where:  { id: applied.itemId },
      select: {
        name: true,
        register: { select: { creatorId: true, addressMode: true, savedAddress: { select: { id: true } } } },
      },
    });
  } catch (err) {
    console.error("[stripe-webhook] item lookup after payment failed — payment IS recorded", { fundingId, err });
  }
  if (!item) return;
  const itemName = item.name;

  // ════════════════════════════════════════════════════════════════════════
  // PHASE 2 — FULFILMENT. Register-keyed, so already guest-safe: what happens
  // when an item completes depends on the mother's register and address mode,
  // never on who paid. Wrapped separately so a fulfilment failure cannot undo
  // the recorded payment in Phase 1.
  // ════════════════════════════════════════════════════════════════════════
  if (becameFullyFunded) {
    const register = item.register;
    try {
      await prisma.$transaction(async (tx) => {
        const useSavedAddress = register.addressMode === "SAVED_PER_REGISTER" && !!register.savedAddress;

        if (useSavedAddress) {
          // Address on file — go straight to fulfilment queue
          await tx.fulfillmentQueue.create({
            data: { registerItemId: applied.itemId, totalFundedCents: newTotalCents, status: "QUEUED" },
          });
          await tx.registerItem.update({
            where: { id: applied.itemId },
            data:  { status: "AWAITING_PURCHASE", fundingStatus: "IN_FULFILLMENT" },
          });
          await tx.notification.create({
            data: {
              userId:  register.creatorId,
              type:    "ITEM_FULLY_FUNDED",
              message: `Your ${itemName} is fully funded and will ship to your saved address. We'll notify you when it's on its way.`,
              link:    `/registers/${registerId}`,
            },
          });
        } else {
          // Ask per shipment — hold for address confirmation
          await tx.registerItem.update({
            where: { id: applied.itemId },
            data:  { status: "AWAITING_ADDRESS", fundingStatus: "FULLY_FUNDED" },
          });
          await tx.notification.create({
            data: {
              userId:  register.creatorId,
              type:    "ITEM_FULLY_FUNDED",
              message: `Your ${itemName} is fully funded! Please confirm your shipping address so we can send it to you.`,
              link:    `/registers/${registerId}?confirm=true`,
            },
          });
        }
      });
    } catch (err) {
      // The payment is already recorded. Fulfilment failing is serious and needs
      // a human, but it is not a reason to lose the money.
      console.error("[stripe-webhook] PHASE 2 fulfilment failed — payment IS recorded", { fundingId, itemId: applied.itemId, err });
    }
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
    const { amountCents } = applied;
    await Promise.allSettled([
      prisma.user.update({
        where: { id: donorId },
        data:  { totalFundedCents: { increment: amountCents }, fundingCount: { increment: 1 } },
      }),
      becameFullyFunded
        ? prisma.notification.create({
            data: {
              userId:  donorId,
              type:    "ITEM_FULLY_FUNDED",
              message: `You completed funding "${itemName}"! Kradel will purchase and deliver it soon.`,
              link:    `/registers/${registerId}`,
            },
          })
        : Promise.resolve(null),
      awardImpactPoints(donorId, "REGISTER_ITEM_FUNDED", applied.itemId),
      isFullFundInOne
        ? awardImpactPoints(donorId, "REGISTER_ITEM_FULL_FUND", applied.itemId)
        : Promise.resolve(null),
      logAbuseEvent(donorId, "DISCOVER_REQUEST_CREATED", 0, { action: "ITEM_FUNDED", itemId: applied.itemId, amountCents }, null as unknown as import("next/server").NextRequest),
    ]).then((rs) => {
      const failed = rs.filter((r) => r.status === "rejected");
      if (failed.length) console.error("[stripe-webhook] PHASE 3 donor side effects failed", { fundingId, donorId, failed });
    });
  }

  // Previous contributors are told the item is complete, once, by the payment
  // that completed it. Account holders only: guests have no inbox, and
  // `{ not: null }` in Prisma means "has a value".
  if (becameFullyFunded) {
    try {
      const previousDonorIds = (await prisma.registerItemFunding.findMany({
        where: {
          registerItemId: applied.itemId,
          status:         "CONFIRMED",
          id:             { not: fundingId },
          donorId:        donorId ? { not: donorId } : { not: null },
        },
        select:   { donorId: true },
        distinct: ["donorId"],
      }))
        .map((f) => f.donorId)
        .filter((d): d is string => d !== null);

      await Promise.allSettled(previousDonorIds.map((prevDonorId) =>
        prisma.notification.create({
          data: {
            userId:  prevDonorId,
            type:    "ITEM_FULLY_FUNDED",
            message: `An item you helped fund, "${itemName}", is now fully funded and will be fulfilled soon.`,
            link:    `/registers/${registerId}`,
          },
        })
      ));
    } catch (err) {
      console.error("[stripe-webhook] previous-donor notices failed — payment IS recorded", { fundingId, err });
    }
  }
}

async function handleSessionExpired(event: Stripe.Event, session: Stripe.Checkout.Session) {
  const fundingId      = session.metadata?.fundingId;
  const contributionId = session.metadata?.contributionId;

  await withStripeEvent(event.id, event.type, async (tx) => {
    if (fundingId) {
      await tx.registerItemFunding.deleteMany({ where: { id: fundingId, status: "PENDING" } });
    } else if (contributionId) {
      await tx.supportContribution.deleteMany({ where: { id: contributionId, status: "PENDING" } });
    }
  });
}

async function handleChargeRefunded(event: Stripe.Event, charge: Stripe.Charge) {
  const paymentIntentId = paymentIntentIdOf(charge.payment_intent);

  // PHASE 1 — record the refund: StripeEvent, CONFIRMED → REFUNDED (once), and
  // the item total from the locked row, in one transaction. A guest refund must
  // record exactly like an account holder's, so nothing donor-keyed is in here.
  const refund = await withStripeEvent(event.id, event.type, async (tx) =>
    paymentIntentId ? applyRefund(tx, paymentIntentId) : null,
  );
  if (!refund) return;

  // PHASE 3 — donor counters, outside the transaction and skipped for guests.
  // There is no Phase 2 here: a refund has no fulfilment step.
  if (refund.donorId) {
    try {
      await prisma.user.update({
        where: { id: refund.donorId },
        data:  {
          totalFundedCents: { decrement: refund.amountCents },
          fundingCount:     { decrement: 1 },
        },
      });
    } catch (err) {
      console.error("[stripe-webhook] refund donor counters failed — refund IS recorded", { fundingId: refund.fundingId, err });
    }
  }
}
