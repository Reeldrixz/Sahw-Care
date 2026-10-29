// Unit tests for lib/addressRedaction and lib/liveAddress readiness.
// Run: npx tsx --test src/lib/addressRedaction.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { savedAddressDecision, waitingToShip, type BlankItem, type SavedAddressCase } from "./addressRedaction";
import { liveReadiness, LIVE_ADDRESS_MAX_AGE_DAYS, type LiveAddressState } from "./liveAddress";

const NOW = new Date("2026-10-29T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

const item = (o: Partial<BlankItem> = {}): BlankItem => ({
  status: "AVAILABLE", standardPriceCents: 1000, totalFundedCents: 0, fundingStatus: "UNFUNDED", fulfillmentQueue: null, ...o,
});
const deliveredItem = (at: Date) => item({ status: "FULFILLED", totalFundedCents: 1000, fundingStatus: "FULFILLED", fulfillmentQueue: { status: "DELIVERED", deliveredAt: at } });
const waitingItem = (q: string | null = "QUEUED") => item({
  status: "AWAITING_PURCHASE", totalFundedCents: 1000, fundingStatus: "IN_FULFILLMENT", fulfillmentQueue: q ? { status: q, deliveredAt: null } : null,
});
const kase = (items: BlankItem[], o: Partial<SavedAddressCase["register"]> & { confirmedAt?: Date | null; createdAt?: Date } = {}): SavedAddressCase => ({
  confirmedAt: o.confirmedAt === undefined ? daysAgo(10) : o.confirmedAt, createdAt: o.createdAt ?? daysAgo(10),
  register: { status: o.status ?? "ACTIVE", closedAt: o.closedAt ?? null, updatedAt: o.updatedAt ?? daysAgo(1), items },
});

test("waiting to ship: funded and not delivered, fulfilled or cancelled", () => {
  assert.equal(waitingToShip(waitingItem("QUEUED")), true);
  assert.equal(waitingToShip(waitingItem("PURCHASED")), true);
  assert.equal(waitingToShip(waitingItem("DISPATCHED")), true);
  assert.equal(waitingToShip(item({ status: "AWAITING_ADDRESS", totalFundedCents: 1000, fundingStatus: "FULLY_FUNDED" })), true);
  assert.equal(waitingToShip(deliveredItem(daysAgo(3))), false);
  assert.equal(waitingToShip(item()), false);                                         // not funded
  assert.equal(waitingToShip(item({ status: "CANCELLED", totalFundedCents: 0 })), false); // refunded
});

test("one delivered item and one waiting: never blanked", () => {
  assert.deepEqual(savedAddressDecision(kase([deliveredItem(daysAgo(5)), waitingItem()]), NOW), { blank: false, why: "WAITING" });
  // Not even when closed long ago, or confirmed long ago.
  assert.deepEqual(savedAddressDecision(kase([deliveredItem(daysAgo(5)), waitingItem("DISPATCHED")], { status: "CLOSED", closedAt: daysAgo(30), confirmedAt: daysAgo(200) }), NOW),
    { blank: false, why: "WAITING" });
});

test("every funded item delivered: blanked 24 hours after the last delivery", () => {
  assert.deepEqual(savedAddressDecision(kase([deliveredItem(daysAgo(5)), deliveredItem(hoursAgo(25)), item()]), NOW), { blank: true, why: "ALL_DELIVERED" });
  assert.deepEqual(savedAddressDecision(kase([deliveredItem(daysAgo(5)), deliveredItem(hoursAgo(23))]), NOW), { blank: false, why: "NOT_YET" });
});

test("closed: blanked 24 hours after closing, once nothing is waiting", () => {
  assert.deepEqual(savedAddressDecision(kase([item()], { status: "CLOSED", closedAt: hoursAgo(25) }), NOW), { blank: true, why: "CLOSED" });
  assert.deepEqual(savedAddressDecision(kase([item()], { status: "CLOSED", closedAt: hoursAgo(2) }), NOW), { blank: false, why: "NOT_YET" });
});

test("nothing funded: blanked 90 days after she confirmed it", () => {
  assert.deepEqual(savedAddressDecision(kase([item(), item()], { confirmedAt: daysAgo(91) }), NOW), { blank: true, why: "UNFUNDED_90_DAYS" });
  assert.deepEqual(savedAddressDecision(kase([item()], { confirmedAt: daysAgo(89) }), NOW), { blank: false, why: "NOT_YET" });
  assert.deepEqual(savedAddressDecision(kase([], { confirmedAt: daysAgo(91) }), NOW), { blank: true, why: "UNFUNDED_90_DAYS" });
  // Never confirmed by her (an admin entered it): counted from when it was created.
  assert.deepEqual(savedAddressDecision(kase([item()], { confirmedAt: null, createdAt: daysAgo(95) }), NOW), { blank: true, why: "UNFUNDED_90_DAYS" });
  // A re-confirmation restarts the 90 days.
  assert.deepEqual(savedAddressDecision(kase([item()], { confirmedAt: daysAgo(3), createdAt: daysAgo(400) }), NOW), { blank: false, why: "NOT_YET" });
});

test("a refunded (cancelled) item doesn't count as funded or waiting", () => {
  assert.deepEqual(savedAddressDecision(kase([item({ status: "CANCELLED" })], { confirmedAt: daysAgo(91) }), NOW), { blank: true, why: "UNFUNDED_90_DAYS" });
});

// ── Readiness for live features ─────────────────────────────────────────────

const verified = { identityVerified: true, accountHold: false, manualReviewStatus: "NONE" as const, referralCodeId: null };
const state = (o: Partial<LiveAddressState> = {}): LiveAddressState => ({
  addressMode: "SAVED_PER_REGISTER", savedAddress: { redactedAt: null, confirmedAt: daysAgo(10) }, creator: verified, ...o,
});

test("ready: saved mode, confirmed in the last 90 days, not blanked, identity passes", () => {
  assert.equal(liveReadiness(state(), NOW).ready, true);
  assert.equal(LIVE_ADDRESS_MAX_AGE_DAYS, 90);
  assert.equal(liveReadiness(state({ savedAddress: { redactedAt: null, confirmedAt: daysAgo(89.9) } }), NOW).ready, true);
});

test("not ready, with the reason", () => {
  const reason = (s: LiveAddressState) => { const r = liveReadiness(s, NOW); return r.ready ? "READY" : r.reason; };
  assert.equal(reason(state({ addressMode: "ASK_PER_SHIPMENT" })), "NO_ADDRESS");
  assert.equal(reason(state({ savedAddress: null })), "NO_ADDRESS");
  assert.equal(reason(state({ savedAddress: { redactedAt: daysAgo(1), confirmedAt: daysAgo(10) } })), "NO_ADDRESS");
  assert.equal(reason(state({ savedAddress: { redactedAt: null, confirmedAt: daysAgo(91) } })), "STALE_ADDRESS");
  assert.equal(reason(state({ savedAddress: { redactedAt: null, confirmedAt: null } })), "STALE_ADDRESS");
  assert.equal(reason(state({ creator: { ...verified, identityVerified: false } })), "NEEDS_IDENTITY");
  assert.equal(reason(state({ creator: { ...verified, accountHold: true } })), "ACCOUNT_HOLD");
  // A partner referral passes the identity check, as for the per-item confirm.
  assert.equal(reason(state({ creator: { ...verified, identityVerified: false, referralCodeId: "ref_1" } })), "READY");
});
