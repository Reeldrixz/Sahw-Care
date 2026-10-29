// Unit tests for lib/registerItemRules. Run: npx tsx --test src/lib/registerItemRules.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { removalRefusal, REMOVAL_REFUSED, ADD_TO_LIVE_ERROR, PUBLISH_REFUSED, type RemovalFacts } from "./registerItemRules";

const clean = (o: Partial<RemovalFacts> = {}): RemovalFacts => ({
  registerStatus: "ACTIVE", totalFundedCents: 0, itemStatus: "AVAILABLE", fundingStatuses: [],
  hasAssignment: false, hasQueueRow: false, onScreenInOpenEvent: false, celebrationInOpenEvent: false, bundleUnlocked: false, ...o,
});

test("a live item with nothing attached may be removed", () => {
  assert.equal(removalRefusal(clean()), null);
  assert.equal(removalRefusal(clean({ itemStatus: "PENDING_APPROVAL" })), null);
});

test("each refusal on a live register, in order", () => {
  assert.equal(removalRefusal(clean({ totalFundedCents: 500 })), "CONTRIBUTIONS");
  assert.equal(removalRefusal(clean({ fundingStatuses: ["CONFIRMED"] })), "CONTRIBUTIONS");
  assert.equal(removalRefusal(clean({ fundingStatuses: ["PENDING"] })), "PAYMENT_PENDING");
  assert.equal(removalRefusal(clean({ fundingStatuses: ["REFUNDED"] })), "PAYMENT_RECORD");
  assert.equal(removalRefusal(clean({ hasAssignment: true })), "RESERVED");
  assert.equal(removalRefusal(clean({ hasQueueRow: true })), "BEING_ORDERED");
  for (const s of ["RESERVED", "FULFILLED", "DELIVERED", "AWAITING_ADDRESS", "AWAITING_PURCHASE", "CANCELLED"]) {
    assert.equal(removalRefusal(clean({ itemStatus: s })), "IN_PROGRESS", s);
  }
  assert.equal(removalRefusal(clean({ onScreenInOpenEvent: true })), "ON_SCREEN");
  assert.equal(removalRefusal(clean({ celebrationInOpenEvent: true })), "IN_LIVE_EVENT");
  assert.equal(removalRefusal(clean({ bundleUnlocked: true })), "BUNDLE_UNLOCKED");
});

test("drafts: only the payment-row rule applies", () => {
  const draft = (o: Partial<RemovalFacts>) => removalRefusal(clean({ registerStatus: "DRAFT", ...o }));
  assert.equal(draft({}), null);
  assert.equal(draft({ fundingStatuses: ["PENDING"] }), "PAYMENT_PENDING");
  assert.equal(draft({ fundingStatuses: ["REFUNDED"] }), "PAYMENT_RECORD");
  assert.equal(draft({ totalFundedCents: 1 }), "CONTRIBUTIONS");
  assert.equal(draft({ onScreenInOpenEvent: true }), null);
});

test("every refusal has its own plain-language message, and none names the brand", () => {
  const msgs = Object.values(REMOVAL_REFUSED);
  assert.equal(new Set(msgs).size, msgs.length);
  for (const m of [...msgs, ADD_TO_LIVE_ERROR, ...Object.values(PUBLISH_REFUSED)]) assert.doesNotMatch(m, /kradel/i, m);
  assert.equal(ADD_TO_LIVE_ERROR, "This register is live, so items can't be added. Contact us if you need a change.");
});
