import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// The money side of the Stripe webhook: recording each Stripe event exactly
// once, and applying payments and refunds to an item's funded total without
// losing an update when two land at once.
//
// ── Exactly once ────────────────────────────────────────────────────────────
// Every webhook event is handled inside withStripeEvent(), whose transaction
// writes the StripeEvent row FIRST and then does the event's work. The row and
// the work commit together or not at all:
//   - the work fails      → the row rolls back too, Stripe retries, and the
//                           retry processes it. (Previously the row was written
//                           before handling and committed on its own, so a
//                           failed handler's retry was skipped as "already
//                           processed" — the payment stayed PENDING while
//                           Stripe kept the money.)
//   - the same event is delivered twice at once → the second insert waits on
//                           the unique eventId until the first commits, then
//                           fails with P2002; isDuplicateStripeEvent() reports
//                           it and the caller acknowledges it without redoing
//                           the work.
//
// ── No lost updates ─────────────────────────────────────────────────────────
// A payment or refund changes RegisterItem.totalFundedCents. It used to be read
// outside any transaction, adjusted in code and written back, so two payments
// confirmed at the same moment both started from the same total and the second
// write erased the first. The item row is now locked (SELECT … FOR UPDATE)
// inside the transaction and the new total is computed from the locked value.

type Tx = Prisma.TransactionClient;

export async function withStripeEvent<T>(
  eventId: string,
  type: string,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.stripeEvent.create({ data: { eventId, type } });
    return work(tx);
  });
}

export function isDuplicateStripeEvent(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return false;
  return JSON.stringify(err.meta?.target ?? "").includes("eventId");
}

// ── Funding arithmetic (pure) ───────────────────────────────────────────────

// Statuses an item reaches only after it is fully funded. A later payment must
// not move it back to FULLY_FUNDED.
const PAST_FUNDED = new Set(["IN_FULFILLMENT", "FULFILLED"]);

export type ItemFundingState = {
  totalFundedCents:   number;
  standardPriceCents: number;
  fundingStatus:      string;
};

export type PaymentOutcome = {
  previousTotalCents: number;
  newTotalCents:      number;
  fundingStatus:      string;
  isFullyFunded:      boolean; // fully funded after this payment
  becameFullyFunded:  boolean; // this payment is the one that completed it
  isFullFundInOne:    boolean; // completed by a single payment from nothing
};

export function fundingAfterPayment(item: ItemFundingState, amountCents: number): PaymentOutcome {
  const price          = item.standardPriceCents;
  const previousTotal  = item.totalFundedCents;
  const newTotal       = previousTotal + amountCents;
  const isFullyFunded  = price > 0 && newTotal >= price;
  const wasFullyFunded = price > 0 && previousTotal >= price;
  const becameFullyFunded = isFullyFunded && !wasFullyFunded;

  const fundingStatus = PAST_FUNDED.has(item.fundingStatus)
    ? item.fundingStatus
    : isFullyFunded ? "FULLY_FUNDED" : newTotal > 0 ? "PARTIAL" : "UNFUNDED";

  return {
    previousTotalCents: previousTotal,
    newTotalCents:      newTotal,
    fundingStatus,
    isFullyFunded,
    becameFullyFunded,
    isFullFundInOne:    becameFullyFunded && previousTotal === 0,
  };
}

// Unchanged refund rule, now applied to the locked total.
export function fundingAfterRefund(item: ItemFundingState, amountCents: number) {
  const newTotal = Math.max(0, item.totalFundedCents - amountCents);
  const fundingStatus = newTotal >= (item.standardPriceCents || 1)
    ? "FULLY_FUNDED"
    : newTotal > 0 ? "PARTIAL" : "UNFUNDED";
  return { newTotalCents: newTotal, fundingStatus };
}

async function lockItem(tx: Tx, itemId: string): Promise<ItemFundingState | null> {
  const rows = await tx.$queryRaw<ItemFundingState[]>`
    SELECT "totalFundedCents", "standardPriceCents", "fundingStatus"::text AS "fundingStatus"
    FROM "RegisterItem" WHERE "id" = ${itemId}
    FOR UPDATE`;
  return rows[0] ?? null;
}

// ── Payment ─────────────────────────────────────────────────────────────────

export type AppliedPayment = PaymentOutcome & {
  fundingId:          string;
  itemId:             string;
  amountCents:        number;
  fundraisingEventId: string | null;
};

// Confirm a PENDING contribution and add it to its item. Returns null when the
// contribution is missing or no longer PENDING (already confirmed by an earlier
// delivery, or expired), so it is never counted twice. Run inside
// withStripeEvent.
export async function applyConfirmedPayment(
  tx: Tx,
  fundingId: string,
  paymentIntentId: string | null,
): Promise<AppliedPayment | null> {
  const claimed = await tx.registerItemFunding.updateMany({
    where: { id: fundingId, status: "PENDING" },
    data:  { status: "CONFIRMED", stripePaymentIntentId: paymentIntentId },
  });
  if (claimed.count !== 1) return null;

  const funding = await tx.registerItemFunding.findUniqueOrThrow({
    where:  { id: fundingId },
    select: { amountCents: true, registerItemId: true, fundraisingEventId: true },
  });

  // Deleting an item cascades to its contributions, so a confirmed contribution
  // always has its item. A miss here means something is badly wrong: throw, so
  // the whole transaction (StripeEvent included) rolls back and Stripe retries.
  const item = await lockItem(tx, funding.registerItemId);
  if (!item) throw new Error(`Item ${funding.registerItemId} missing for confirmed funding ${fundingId}`);

  const outcome = fundingAfterPayment(item, funding.amountCents);
  await tx.registerItem.update({
    where: { id: funding.registerItemId },
    data:  { totalFundedCents: outcome.newTotalCents, fundingStatus: outcome.fundingStatus as never },
  });

  return {
    ...outcome,
    fundingId,
    itemId:             funding.registerItemId,
    amountCents:        funding.amountCents,
    fundraisingEventId: funding.fundraisingEventId,
  };
}

// ── Refund ──────────────────────────────────────────────────────────────────

export type AppliedRefund = { fundingId: string; donorId: string | null; amountCents: number };

// Mark a CONFIRMED contribution refunded and take it off its item. Returns null
// when there is nothing confirmed to refund (already refunded, or unknown).
// Run inside withStripeEvent.
export async function applyRefund(tx: Tx, paymentIntentId: string): Promise<AppliedRefund | null> {
  const funding = await tx.registerItemFunding.findFirst({
    where:  { stripePaymentIntentId: paymentIntentId, status: "CONFIRMED" },
    select: { id: true, donorId: true, amountCents: true, registerItemId: true },
  });
  if (!funding) return null;

  const claimed = await tx.registerItemFunding.updateMany({
    where: { id: funding.id, status: "CONFIRMED" },
    data:  { status: "REFUNDED", refundedAt: new Date() },
  });
  if (claimed.count !== 1) return null;

  const item = await lockItem(tx, funding.registerItemId);
  if (!item) throw new Error(`Item ${funding.registerItemId} missing for refunded funding ${funding.id}`);

  const after = fundingAfterRefund(item, funding.amountCents);
  await tx.registerItem.update({
    where: { id: funding.registerItemId },
    data:  { totalFundedCents: after.newTotalCents, fundingStatus: after.fundingStatus as never },
  });

  return { fundingId: funding.id, donorId: funding.donorId, amountCents: funding.amountCents };
}
