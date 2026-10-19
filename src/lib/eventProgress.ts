// Progress figures for live fundraising events, and the 30% featuring rule.
//
// Pure: no database access. Every figure is computed from the three item
// fields the event shape already carries — standardPriceCents (the item's
// price), totalFundedCents (the sum of its confirmed item amounts, never the
// fee-inclusive charge) and fundingStatus. Callers pass the items a donor can
// see; fetchPublicRegister already leaves out PENDING_APPROVAL and CANCELLED.
//
// Overfunding: two checkouts racing for an item's last dollars can leave it
// funded beyond its price, and it stays that way (no refunds). Every amount
// here caps each item at its price, so an overfunded item can never inflate a
// register's progress.

export type ProgressItem = {
  standardPriceCents: number;
  totalFundedCents:   number;
  fundingStatus:      string;
};

// Statuses an item only reaches once fully funded. They count as funded even
// for an item without a price, where the amount can't say.
const FUNDED_STATUSES = new Set(["FULLY_FUNDED", "IN_FULFILLMENT", "FULFILLED"]);

// The share of a register that must still be unfunded for a host to pick it:
// it is pickable only while strictly under this.
export const FEATURE_MAX_FUNDED_PERCENT = 30;

// What the item still needs. Never negative.
export function itemRemainingCents(item: ProgressItem): number {
  return Math.max(0, item.standardPriceCents - item.totalFundedCents);
}

// The item's funded amount, capped at its price.
export function itemCappedFundedCents(item: ProgressItem): number {
  return Math.min(Math.max(0, item.totalFundedCents), Math.max(0, item.standardPriceCents));
}

export function isItemFunded(item: ProgressItem): boolean {
  if (FUNDED_STATUSES.has(item.fundingStatus)) return true;
  return item.standardPriceCents > 0 && item.totalFundedCents >= item.standardPriceCents;
}

// "Funded N of M items". M counts every item passed in.
export function registerItemCounts(items: ProgressItem[]): { funded: number; total: number } {
  return { funded: items.filter(isItemFunded).length, total: items.length };
}

// Capped money totals over the PRICED items. Unpriced items have nothing to
// measure and are left out of both sums.
export function registerMoneyTotals(items: ProgressItem[]): { fundedCents: number; targetCents: number } {
  let fundedCents = 0;
  let targetCents = 0;
  for (const i of items) {
    if (i.standardPriceCents <= 0) continue;
    fundedCents += itemCappedFundedCents(i);
    targetCents += i.standardPriceCents;
  }
  return { fundedCents, targetCents };
}

// Funded share of the register, 0..1, or null when nothing is priced (then
// there is no share to speak of).
export function fundedFraction(items: ProgressItem[]): number | null {
  const { fundedCents, targetCents } = registerMoneyTotals(items);
  return targetCents > 0 ? fundedCents / targetCents : null;
}

// Whole percent for a progress bar, rounded down so 99.6% never shows as 100%.
export function fundedPercent(items: ProgressItem[]): number {
  const f = fundedFraction(items);
  return f === null ? 0 : Math.min(100, Math.floor(f * 100));
}

// The featuring rule: a host may pick a register only while it is STRICTLY
// under 30% funded. Compared in whole cents (funded × 100 < target × 30), so
// exactly 30.0% is not pickable and there is no rounding at the boundary. A
// register with nothing priced is not pickable.
export function isPickableByProgress(items: ProgressItem[]): boolean {
  const { fundedCents, targetCents } = registerMoneyTotals(items);
  if (targetCents <= 0) return false;
  return fundedCents * 100 < targetCents * FEATURE_MAX_FUNDED_PERCENT;
}
