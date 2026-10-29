// Unit tests for lib/fulfillmentOrder. Run: npx tsx --test src/lib/fulfillmentOrder.test.ts
// The same guarantee against a real database and the real route handler:
// scripts/db-tests/streamerOrders.db-test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FEATURE_CONSENT_VERSION } from "./featureConsent";
import {
  STREAMER_ORDER_SELECT, STREAMER_COMPLETION_SELECT, toStreamerOrders,
  parseTotalCents, parseTaxCents, parseDeliveryDate, parseOrderNumber, validateOrderFields,
  orderDifference, differenceText,
  type StreamerCompletionRow,
} from "./fulfillmentOrder";

// Every key a select names, at any depth (skipping where/orderBy, which filter
// and sort but return nothing).
function selectedKeys(sel: Record<string, unknown>, path = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(sel)) {
    if (k === "where" || k === "orderBy") continue;
    if (k === "select") { out.push(...selectedKeys(v as Record<string, unknown>, path)); continue; }
    const here = path ? `${path}.${k}` : k;
    out.push(here);
    if (v && typeof v === "object") out.push(...selectedKeys(v as Record<string, unknown>, here));
  }
  return out;
}

// Fields an admin can see that the streamer never may, and values to plant in them.
const ORDER_NUMBER = "702-5551234-9876543";
const ADMIN_FIELDS: Record<string, unknown> = {
  id: "ord_secret_id", orderNumber: ORDER_NUMBER, registerId: "reg_secret_id",
  createdById: "admin_secret_id", updatedById: "editor_secret_id", createdAt: new Date("2026-10-20T00:00:00Z"), updatedAt: new Date("2026-10-21T00:00:00Z"),
};
const QUEUE_ADMIN_FIELDS: Record<string, unknown> = {
  id: "q_secret_id", registerItemId: "item_secret_id", orderId: "ord_secret_id", totalFundedCents: 4321,
  purchasedFrom: "SECRET_SUPPLIER", actualCostCents: 9999, trackingRef: "SECRET_REF", notes: "SECRET_NOTE",
  queuedAt: new Date(), purchasedAt: new Date(), dispatchedAt: null, deliveredAt: null,
};
const FORBIDDEN_KEYS = [...new Set([
  ...Object.keys(ADMIN_FIELDS), ...Object.keys(QUEUE_ADMIN_FIELDS),
  // "title" is allowed as a key: it carries only liveRegisterTitle's result. The
  // raw stored title (SECRET_TITLE) stays forbidden below.
  "city", "email", "phone", "address", "shipmentAddress", "savedAddress", "creatorId", "dueDate",
])];
const FORBIDDEN_VALUES = [
  ORDER_NUMBER, "ord_secret_id", "reg_secret_id", "admin_secret_id", "editor_secret_id", "q_secret_id", "item_secret_id",
  "SECRET_SUPPLIER", "SECRET_REF", "SECRET_NOTE", "Okafor", "SECRET_TITLE", "secret@example.com", "Lagos",
];

test("the streamer's select names only the columns the page shows", () => {
  assert.deepEqual(selectedKeys(STREAMER_ORDER_SELECT).sort(), [
    "estimatedDeliveryOn", "items", "items.registerItem", "items.registerItem.name", "items.status",
    "taxCents", "totalCents", "trackingUrl",
  ]);
  // Exactly these, so adding a column fails here. The item's price, funded
  // amount, funding status and whether it has an order decide "funded, not
  // ordered yet"; they're read, never sent (checked by the next test).
  const all = selectedKeys(STREAMER_COMPLETION_SELECT);
  assert.deepEqual(all.filter((k) => !k.startsWith("register.fulfillmentOrders.")).sort(), [
    "register", "register.creator", "register.creator.name", "register.featureConsent", "register.featureConsentVersion",
    "register.fulfillmentOrders", "register.items", "register.items.fulfillmentQueue",
    "register.items.fulfillmentQueue.orderId", "register.items.fundingStatus", "register.items.name",
    "register.items.standardPriceCents", "register.items.totalFundedCents", "register.title",
  ]);
  assert.ok(!all.some((k) => k.endsWith("orderNumber")), "the streamer select reads the order number");
});

// A row as the database could return it if a select were ever widened: every
// admin field present and filled in.
function stuffedRow(o: Partial<{ featureConsent: boolean; name: string }> = {}): StreamerCompletionRow {
  return {
    ...ADMIN_FIELDS,
    register: {
      ...ADMIN_FIELDS, title: "SECRET_TITLE", city: "Lagos", creatorId: "admin_secret_id",
      featureConsent: o.featureConsent ?? true,
      creator: { name: o.name ?? "Maryam Okafor", email: "secret@example.com", phone: "+15550001111" },
      savedAddress: { streetAddress: "1 Secret St", city: "Lagos", phone: "+15550001111" },
      items: [
        { ...QUEUE_ADMIN_FIELDS, name: "Diapers", standardPriceCents: 2000, totalFundedCents: 2000, fundingStatus: "IN_FULFILLMENT",
          fulfillmentQueue: { ...QUEUE_ADMIN_FIELDS, orderId: "ord_secret_id" } },
        { ...QUEUE_ADMIN_FIELDS, name: "Car seat", standardPriceCents: 9000, totalFundedCents: 9000, fundingStatus: "FULLY_FUNDED",
          fulfillmentQueue: { ...QUEUE_ADMIN_FIELDS, orderId: null } },
        { name: "Bottles", standardPriceCents: 1500, totalFundedCents: 0, fundingStatus: "UNFUNDED", fulfillmentQueue: null },
      ],
      fulfillmentOrders: [{
        ...ADMIN_FIELDS,
        totalCents: 2437, taxCents: 281, trackingUrl: "https://a.co/d/0aBcDeF", estimatedDeliveryOn: new Date("2026-10-30T00:00:00Z"),
        items: [{ ...QUEUE_ADMIN_FIELDS, status: "PURCHASED", registerItem: { name: "Diapers", id: "item_secret_id" } }],
      }],
    },
  } as unknown as StreamerCompletionRow;
}

test("a streamer response can't contain the order number or any admin field, even when stored", () => {
  const out = toStreamerOrders([stuffedRow(), stuffedRow({ name: "<b>" })]);
  const json = JSON.stringify({ registers: out });

  for (const v of FORBIDDEN_VALUES) assert.ok(!json.includes(v), `response contains ${v}`);
  const keys = new Set<string>();
  JSON.parse(json, (k, v) => { if (k && Number.isNaN(Number(k))) keys.add(k); return v; });
  for (const k of FORBIDDEN_KEYS) assert.ok(!keys.has(k), `response has key ${k}`);
  assert.deepEqual([...keys].sort(), [
    "estimatedDelivery", "firstName", "fundedNoRecord", "items", "orders", "registers", "status", "taxCents", "title", "totalCents", "trackingUrl",
  ]);

  assert.deepEqual(out[0], {
    firstName: "Maryam",
    title: null,
    orders: [{ items: ["Diapers"], status: "ORDERED", trackingUrl: "https://a.co/d/0aBcDeF", estimatedDelivery: "2026-10-30", totalCents: 2437, taxCents: 281 }],
    fundedNoRecord: ["Car seat"],   // funded, no order; Bottles isn't funded
  });
  assert.equal(out[1].firstName, null); // fails the first-name rule → "A mother"
});

test("her register's title: shown only with current consent, and only if it passes the checks", () => {
  const withTitle = (title: string, v: number | null) => {
    const r = stuffedRow();
    (r.register as { title: string }).title = title;
    (r.register as { featureConsentVersion: number | null }).featureConsentVersion = v;
    return toStreamerOrders([r])[0].title;
  };
  assert.equal(withTitle("baby things for March", FEATURE_CONSENT_VERSION), "baby things for March");
  assert.equal(withTitle("baby things for March", 2), null);      // consent to an older wording
  assert.equal(withTitle("baby things for March", null), null);   // no current consent
  assert.equal(withTitle("Okafor family", FEATURE_CONSENT_VERSION), null);  // her surname
  assert.equal(withTitle("text me 416 555 0100", FEATURE_CONSENT_VERSION), null);
  assert.equal(withTitle("a very long register title that goes on and on", FEATURE_CONSENT_VERSION), "a very long register title…");
  // The stored row (SECRET_TITLE, no current consent) never reaches the page.
  assert.equal(toStreamerOrders([stuffedRow()])[0].title, null);
});

test("tax not recorded is null, not zero", () => {
  const r = stuffedRow();
  r.register.fulfillmentOrders[0].taxCents = null;
  assert.equal(toStreamerOrders([r])[0].orders[0].taxCents, null);
});

test("an order left with no items (her register was deleted) isn't listed", () => {
  const r = stuffedRow();
  r.register.fulfillmentOrders[0].items = [];
  assert.deepEqual(toStreamerOrders([r])[0].orders, []);
});

test("an order whose tracking link was cleared isn't listed", () => {
  const r = stuffedRow();
  r.register.fulfillmentOrders[0].trackingUrl = null;
  assert.deepEqual(toStreamerOrders([r])[0].orders, []);
});

test("a mother who withdrew consent is dropped", () => {
  assert.deepEqual(toStreamerOrders([stuffedRow({ featureConsent: false })]), []);
});

test("an order reads Delivered only when every item in it is delivered", () => {
  const r = stuffedRow();
  const o = r.register.fulfillmentOrders[0];
  o.items = [{ status: "DELIVERED", registerItem: { name: "A" } }, { status: "DISPATCHED", registerItem: { name: "B" } }];
  assert.equal(toStreamerOrders([r])[0].orders[0].status, "ORDERED");
  o.items = [{ status: "DELIVERED", registerItem: { name: "A" } }, { status: "DELIVERED", registerItem: { name: "B" } }];
  assert.equal(toStreamerOrders([r])[0].orders[0].status, "DELIVERED");
});

test("order total: dollars with at most two decimals", () => {
  assert.equal(parseTotalCents("54.37"), 5437);
  assert.equal(parseTotalCents("$54.3"), 5430);
  assert.equal(parseTotalCents("54"), 5400);
  assert.equal(parseTotalCents(" 0.01 "), 1);
  for (const bad of ["", "0", "0.00", "-5", "54.371", "5,437", "1e3", "abc", "10000.01", null, undefined]) {
    assert.equal(parseTotalCents(bad), null, `accepted ${String(bad)}`);
  }
});

test("tax: optional; blank is not recorded, 0 is a recorded zero", () => {
  assert.deepEqual(parseTaxCents(""), { ok: true, value: null });
  assert.deepEqual(parseTaxCents(undefined), { ok: true, value: null });
  assert.deepEqual(parseTaxCents("0"), { ok: true, value: 0 });
  assert.deepEqual(parseTaxCents("6.12"), { ok: true, value: 612 });
  assert.deepEqual(parseTaxCents("-1"), { ok: false });
  assert.deepEqual(parseTaxCents("6.123"), { ok: false });
});

test("difference: highlighted past the larger of $5 or 15%, neutral wording", () => {
  const it = (price: number, funded = price) => ({ standardPriceCents: price, totalFundedCents: funded, fundingStatus: "FULLY_FUNDED" });
  // $20 funded: the $5 floor applies (15% is $3).
  assert.equal(orderDifference(2500, [it(2000)]).highlight, false);   // +$5.00, not more than $5
  assert.equal(orderDifference(2501, [it(2000)]).highlight, true);    // +$5.01
  assert.equal(orderDifference(1499, [it(2000)]).highlight, true);    // −$5.01
  // $100 funded: 15% ($15) applies.
  assert.equal(orderDifference(11500, [it(10000)]).highlight, false);
  assert.equal(orderDifference(11501, [it(10000)]).highlight, true);
  assert.equal(orderDifference(8499, [it(10000)]).highlight, true);
  // Each item counts only up to its price.
  assert.equal(orderDifference(2000, [it(2000, 9000)]).fundedCents, 2000);
  const d = orderDifference(5437, [it(2000), it(3000)]);
  assert.equal(differenceText(d), "Funded for these items: $50.00 · Order total $54.37 · Difference +$4.37");
  assert.equal(differenceText(orderDifference(4000, [it(5000)])), "Funded for these items: $50.00 · Order total $40.00 · Difference −$10.00");
  for (const t of [differenceText(d), differenceText(orderDifference(1, [it(9000)]))]) {
    assert.doesNotMatch(t, /shortfall|surplus|refund|cover|owe|extra|donat|kradel/i);
  }
});

test("estimated delivery: a real calendar date within range", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  assert.equal(parseDeliveryDate("2026-11-02", now)?.toISOString(), "2026-11-02T00:00:00.000Z");
  for (const bad of ["2026-02-30", "2026-13-01", "02/11/2026", "2026-11-2", "2025-01-01", "2028-01-01", "", 5]) {
    assert.equal(parseDeliveryDate(bad, now), null, `accepted ${String(bad)}`);
  }
});

test("order number: optional, short, plain", () => {
  assert.deepEqual(parseOrderNumber(undefined), { ok: true, value: null });
  assert.deepEqual(parseOrderNumber("  "), { ok: true, value: null });
  assert.deepEqual(parseOrderNumber(" 702-5551234-9876543 "), { ok: true, value: "702-5551234-9876543" });
  assert.deepEqual(parseOrderNumber("<script>"), { ok: false });
  assert.deepEqual(parseOrderNumber("x".repeat(65)), { ok: false });
});

test("tax can't exceed the total", () => {
  const base = { total: "10.00", trackingUrl: "https://a.co/d/0aBcDeF", estimatedDeliveryOn: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) };
  assert.equal(validateOrderFields({ ...base, tax: "10.00" }).ok, true);
  assert.equal(validateOrderFields({ ...base, tax: "10.01" }).ok, false);
});

test("recording an order needs total, link and date; an edit checks only what's sent", () => {
  const good = { total: "54.37", trackingUrl: "https://a.co/d/0aBcDeF", estimatedDeliveryOn: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10) };
  assert.equal(validateOrderFields(good).ok, true);
  assert.equal(validateOrderFields({ ...good, trackingUrl: "https://www.ups.com/track?tracknum=1Z" }).ok, false);
  assert.equal(validateOrderFields({ total: "54.37" }).ok, false);
  const edit = validateOrderFields({ orderNumber: "702-1" }, true);
  assert.deepEqual(edit, { ok: true, fields: { orderNumber: "702-1" } });
});
