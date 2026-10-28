// Unit tests for lib/eventRecap (the live fulfilment layer). Run: npx tsx --test src/lib/eventRecap.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  registerStatus, publicRecap, hostCompletions, checkGoalRaise, RECAP_MAX,
  type CompletionItem, type CompletionRow,
} from "./eventRecap";
import { recapText } from "./publicCelebration";

const item = (o: Partial<CompletionItem> = {}): CompletionItem => ({
  name: "Diapers", standardPriceCents: 1000, totalFundedCents: 1000, fundingStatus: "FULLY_FUNDED",
  queueStatus: null, hasOrder: false, purchasedAt: null, dispatchedAt: null, ...o,
});
const row = (o: Partial<CompletionRow> = {}): CompletionRow => ({
  registerId: "reg_1", motherName: "Maryam Okafor", featureConsent: true,
  completedAt: new Date("2026-10-22T18:00:00Z"), items: [item()], ...o,
});

test("status comes from the least advanced item", () => {
  const delivered = item({ queueStatus: "DELIVERED", hasOrder: true });
  const ordered   = item({ queueStatus: "PURCHASED", hasOrder: true });
  const sent      = item({ queueStatus: "DISPATCHED", hasOrder: true });
  assert.equal(registerStatus([delivered, delivered]), "DELIVERED");
  assert.equal(registerStatus([delivered, ordered]), "ORDERED");
  assert.equal(registerStatus([delivered, sent]), "ORDERED");
  assert.equal(registerStatus([delivered, ordered, item()]), "FUNDED");
  // QUEUED is waiting to be bought, and IN_FULFILLMENT is set at funding: neither is an order.
  assert.equal(registerStatus([ordered, item({ queueStatus: "QUEUED", fundingStatus: "IN_FULFILLMENT" })]), "FUNDED");
  // An item no longer funded (added after completion): no true status, so none.
  assert.equal(registerStatus([delivered, item({ totalFundedCents: 0, fundingStatus: "UNFUNDED" })]), null);
});

test("\"Order placed\" needs an order attached (the evidence)", () => {
  const delivered = item({ queueStatus: "DELIVERED", hasOrder: true });
  assert.equal(registerStatus([item({ queueStatus: "PURCHASED" })]), "FUNDED");
  assert.equal(registerStatus([item({ queueStatus: "DISPATCHED" })]), "FUNDED");
  assert.equal(registerStatus([delivered, item({ queueStatus: "PURCHASED" })]), "FUNDED");
  assert.equal(registerStatus([delivered, item({ queueStatus: "PURCHASED", hasOrder: true })]), "ORDERED");
  // Bought without a tracking link: Funded on air, but the host is told it
  // was bought and isn't flagged "not ordered yet".
  const now = new Date("2026-10-25T18:00:00Z");
  const [h] = hostCompletions([row({ items: [item({ queueStatus: "PURCHASED", purchasedAt: new Date("2026-10-24T00:00:00Z") }), item({ name: "Car seat" })] })], now);
  assert.equal(h.items[0].stage, "FUNDED");
  assert.equal(h.items[0].noTrackingLink, true);
  assert.equal(h.items[1].noTrackingLink, false);
  assert.deepEqual(h.flags, ["1 item not ordered yet — fully funded 3 days ago"]);
});

test("bought without a tracking link stays Funded on air even when delivered; the host sees delivered", () => {
  const noLinkDelivered = item({ queueStatus: "DELIVERED" });
  assert.equal(registerStatus([noLinkDelivered]), "FUNDED");
  assert.equal(registerStatus([noLinkDelivered, item({ queueStatus: "DELIVERED", hasOrder: true })]), "FUNDED");
  assert.deepEqual(publicRecap([row({ items: [noLinkDelivered] })], null).entries, [{ firstName: "Maryam", status: "FUNDED" }]);
  const [h] = hostCompletions([row({ items: [noLinkDelivered, item({ name: "Wipes", queueStatus: "DELIVERED", hasOrder: true })] })]);
  assert.deepEqual(h.items.map((i) => [i.stage, i.noTrackingLink, i.delivered]), [["FUNDED", true, true], ["DELIVERED", false, true]]);
  assert.equal(h.status, "FUNDED");
});

test("host panel: how many items have an order, of all her items", () => {
  const rows = [row({ items: [
    item({ queueStatus: "PURCHASED", hasOrder: true }), item({ queueStatus: "QUEUED" }),
    item({ queueStatus: "PURCHASED" }), item({ queueStatus: "DELIVERED", hasOrder: true }),
  ] })];
  const [h] = hostCompletions(rows);
  assert.deepEqual(h.orderPlaced, { withOrder: 2, total: 4, text: "Order placed for 2 of 4 items" });
  assert.equal(hostCompletions([row({ items: [item({ queueStatus: "PURCHASED", hasOrder: true })] })])[0].orderPlaced.text, "Order placed for 1 of 1 item");
  assert.equal(hostCompletions([row({ items: [item(), item()] })])[0].orderPlaced.text, "Order placed for 0 of 2 items");
  // The overlay rule is unchanged: the least advanced item still decides.
  assert.deepEqual(publicRecap(rows, null).entries, [{ firstName: "Maryam", status: "FUNDED" }]);
  assert.doesNotMatch(JSON.stringify(publicRecap(rows, null)), /Order placed for/);
});

test("the order-total difference is on the host panel only, per order", () => {
  const rows = [row({
    orders: [{ id: "ord_1", totalCents: 5437 }, { id: "ord_gone", totalCents: 999 }],
    items: [
      item({ name: "Diapers", standardPriceCents: 2000, totalFundedCents: 2000, queueStatus: "PURCHASED", hasOrder: true, orderId: "ord_1" }),
      item({ name: "Wipes", standardPriceCents: 3000, totalFundedCents: 3000, queueStatus: "PURCHASED", hasOrder: true, orderId: "ord_1" }),
    ],
  })];
  const [h] = hostCompletions(rows);
  assert.equal(h.orders.length, 1);   // an order covering none of her items isn't shown
  assert.deepEqual(h.orders[0].items, ["Diapers", "Wipes"]);
  assert.equal(h.orders[0].text, "Funded for these items: $50.00 · Order total $54.37 · Difference +$4.37");
  assert.equal(h.orders[0].highlight, false);
  assert.ok(!JSON.stringify(h).includes("ord_1"), "an order id reached the host payload");
  // The overlay's recap carries no money at all.
  assert.doesNotMatch(JSON.stringify(publicRecap(rows, null)), /54|50\.00|Difference|ord_/);
});

test("recap text uses only funded, order placed and delivered", () => {
  assert.equal(recapText({ firstName: "Maryam", status: "FUNDED" }), "Maryam — Funded ✓");
  assert.equal(recapText({ firstName: "Maryam", status: "ORDERED" }), "Maryam — Order placed ✓");
  assert.equal(recapText({ firstName: "Maryam", status: "DELIVERED" }), "Maryam — Delivered ✓");
  for (const status of ["FUNDED", "ORDERED", "DELIVERED"] as const) {
    assert.doesNotMatch(recapText({ firstName: "M", status }), /fulfil/i);
  }
});

test("a name that fails the rule gives the generic line", () => {
  const r = publicRecap([row({ motherName: "Ma$ryam" })], null);
  assert.deepEqual(r.entries, [{ firstName: null, status: "FUNDED" }]);
  assert.equal(recapText(r.entries[0]), "A mother — Funded ✓");
});

test("the register on screen is excluded from the recap", () => {
  const r = publicRecap([row({ registerId: "a", motherName: "Ada" }), row({ registerId: "b", motherName: "Zoë" })], "b");
  assert.deepEqual(r.entries.map((e) => e.firstName), ["Ada"]);
});

test("withdrawn consent drops the entry, on air and on the host dashboard", () => {
  const rows = [row({ registerId: "a", motherName: "Ada" }), row({ registerId: "b", motherName: "Zoë", featureConsent: false })];
  assert.deepEqual(publicRecap(rows, null).entries.map((e) => e.firstName), ["Ada"]);
  assert.deepEqual(hostCompletions(rows).map((h) => h.firstName), ["Ada"]);
});

test("no ids, dates or places in a recap", () => {
  const r = publicRecap([row({ motherName: "Maryam Okafor" })], null);
  assert.deepEqual(Object.keys(r).sort(), ["entries", "more"]);
  assert.deepEqual(Object.keys(r.entries[0]).sort(), ["firstName", "status"]);
  assert.doesNotMatch(JSON.stringify(r), /reg_1|Okafor|2026|T\d\d:/);
});

test("the overlay shows the latest few and counts the rest", () => {
  const rows = Array.from({ length: RECAP_MAX + 2 }, (_, k) => row({ registerId: `r${k}`, motherName: `Name${String.fromCharCode(65 + k)}` }));
  const r = publicRecap(rows, null);
  assert.equal(r.entries.length, RECAP_MAX);
  assert.equal(r.more, 2);
  assert.equal(r.entries[0].firstName, "NameC");   // oldest shown
});

test("host flags delays; the overlay status stays true and positive", () => {
  const now = new Date("2026-10-25T18:00:00Z");   // 3 days after completion
  const rows = [row({ items: [item(), item({ name: "Car seat", queueStatus: "DISPATCHED", hasOrder: true, dispatchedAt: new Date("2026-10-01T00:00:00Z") })] })];
  const [h] = hostCompletions(rows, now);
  assert.equal(h.flags.length, 2);
  assert.match(h.flags[0], /1 item not ordered yet — fully funded 3 days ago/);
  assert.match(h.flags[1], /Car seat: dispatched \d+ days ago, not marked delivered/);
  assert.deepEqual(publicRecap(rows, null).entries, [{ firstName: "Maryam", status: "FUNDED" }]);
});

test("the goal can be raised, never lowered, never below the funded count", () => {
  assert.equal(checkGoalRaise(7, 5, 3), null);          // raise
  assert.equal(checkGoalRaise(5, 5, 3), null);          // unchanged
  assert.match(checkGoalRaise(4, 5, 3)!, /only be raised/);
  assert.match(checkGoalRaise(2, 0, 3)!, /below the 3 Registers already fully funded/);
  assert.equal(checkGoalRaise(3, 0, 3), null);          // first set, equal to funded
  for (const bad of [-1, 2.5, "7", null, 1001]) assert.ok(checkGoalRaise(bad, 0, 0));
});
