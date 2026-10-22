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
  queueStatus: null, purchasedAt: null, dispatchedAt: null, ...o,
});
const row = (o: Partial<CompletionRow> = {}): CompletionRow => ({
  registerId: "reg_1", motherName: "Maryam Okafor", featureConsent: true,
  completedAt: new Date("2026-10-22T18:00:00Z"), items: [item()], ...o,
});

test("status comes from the least advanced item", () => {
  const delivered = item({ queueStatus: "DELIVERED" });
  const ordered   = item({ queueStatus: "PURCHASED" });
  const sent      = item({ queueStatus: "DISPATCHED" });
  assert.equal(registerStatus([delivered, delivered]), "DELIVERED");
  assert.equal(registerStatus([delivered, ordered]), "ORDERED");
  assert.equal(registerStatus([delivered, sent]), "ORDERED");
  assert.equal(registerStatus([delivered, ordered, item()]), "FUNDED");
  // QUEUED is waiting to be bought, and IN_FULFILLMENT is set at funding: neither is an order.
  assert.equal(registerStatus([ordered, item({ queueStatus: "QUEUED", fundingStatus: "IN_FULFILLMENT" })]), "FUNDED");
  // An item no longer funded (added after completion): no true status, so none.
  assert.equal(registerStatus([delivered, item({ totalFundedCents: 0, fundingStatus: "UNFUNDED" })]), null);
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
  const rows = [row({ items: [item(), item({ name: "Car seat", queueStatus: "DISPATCHED", dispatchedAt: new Date("2026-10-01T00:00:00Z") })] })];
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
