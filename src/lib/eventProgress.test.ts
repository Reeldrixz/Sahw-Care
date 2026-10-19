// Unit tests for lib/eventProgress. Pure functions, no database.
// Run: npx tsx --test src/lib/eventProgress.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  itemRemainingCents, itemCappedFundedCents, isItemFunded, registerItemCounts, registerMoneyTotals,
  fundedFraction, fundedPercent, isPickableByProgress, type ProgressItem,
} from "./eventProgress";

const it = (price: number, funded: number, status?: string): ProgressItem => ({
  standardPriceCents: price,
  totalFundedCents:   funded,
  fundingStatus:      status ?? (price > 0 && funded >= price ? "FULLY_FUNDED" : funded > 0 ? "PARTIAL" : "UNFUNDED"),
});

test("remaining is price minus funded, never negative", () => {
  assert.equal(itemRemainingCents(it(3000, 1250)), 1750);
  assert.equal(itemRemainingCents(it(1000, 2000)), 0);
});

test("funded amount is capped at the price", () => {
  assert.equal(itemCappedFundedCents(it(1000, 2500)), 1000);
  assert.equal(itemCappedFundedCents(it(1000, 400)), 400);
});

test("an item is funded by amount or by a funded status", () => {
  assert.ok(isItemFunded(it(1000, 1000, "PARTIAL")));
  assert.ok(isItemFunded(it(1000, 1000, "IN_FULFILLMENT")));
  assert.ok(isItemFunded(it(1000, 1000, "FULFILLED")));
  assert.ok(!isItemFunded(it(1000, 999)));
  assert.ok(!isItemFunded(it(0, 0, "UNFUNDED")));
  assert.ok(isItemFunded(it(0, 0, "FULLY_FUNDED")));
});

test("funded N of M items, items in fulfilment counted as funded", () => {
  assert.deepEqual(registerItemCounts([it(1000, 1000), it(1000, 0), it(1000, 1000, "IN_FULFILLMENT")]), { funded: 2, total: 3 });
  assert.deepEqual(registerItemCounts([]), { funded: 0, total: 0 });
});

test("money totals cap each item and skip unpriced items", () => {
  assert.deepEqual(
    registerMoneyTotals([it(1000, 5000), it(2000, 500), it(0, 900, "PARTIAL")]),
    { fundedCents: 1500, targetCents: 3000 },
  );
});

test("fraction is null when nothing is priced", () => {
  assert.equal(fundedFraction([it(0, 0)]), null);
  assert.equal(fundedFraction([]), null);
});

test("percent rounds down and caps at 100", () => {
  assert.equal(fundedPercent([it(1000, 996)]), 99);
  assert.equal(fundedPercent([it(1000, 1000)]), 100);
  assert.equal(fundedPercent([it(1000, 3000)]), 100);
});

test("the 30% boundary: strictly under is pickable, exactly 30.0% is not", () => {
  assert.ok(!isPickableByProgress([it(10000, 3000)]));   // 30.00%
  assert.ok(isPickableByProgress([it(10000, 2999)]));    // 29.99%
  assert.ok(!isPickableByProgress([it(10000, 3001)]));   // 30.01%
  assert.ok(isPickableByProgress([it(10000, 0)]));       // 0%
});

test("an overfunded item can't push a register over by more than its price", () => {
  // Capped: 1000 of 10000 = 10%, not 9000 of 10000.
  assert.ok(isPickableByProgress([it(1000, 9000), it(9000, 0)]));
});

test("nothing priced, or no items, is not pickable", () => {
  assert.ok(!isPickableByProgress([it(0, 0), it(0, 0)]));
  assert.ok(!isPickableByProgress([]));
});

test("unpriced items don't count toward 30%", () => {
  assert.ok(isPickableByProgress([it(10000, 2000), it(0, 0, "FULLY_FUNDED")]));
});
