import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateTrackingUrl } from "@/lib/trackingLink";
import { firstNameOnly } from "@/lib/eventEffects";
import { isItemFunded, itemCappedFundedCents, type ProgressItem } from "@/lib/eventProgress";
import { liveRegisterTitle } from "@/lib/publicCelebration";

// Fulfilment evidence (step 9): the admin records a retailer order covering
// one or more queued items of one register; the streamer sees it on
// /host/<token>/orders.
//
// TWO AUDIENCES, TWO READS. The admin queue reads everything, including the
// order number. The streamer's read is STREAMER_ORDER_SELECT below and
// nothing else. It names only the columns the streamer page shows, so the
// order number, who recorded or edited it, supplier, cost, notes and every id
// are never read from the database at all. toStreamerOrders then builds the
// response field by field (never by spreading a row), so a column added to
// the select by mistake still can't reach the response.
// lib/fulfillmentOrder.test.ts checks both.
//
// A purchase recorded WITHOUT a tracking link (admin, with a required note)
// has no order here at all: it is a FulfillmentQueue row with orderId null.
// It reads "Funded ✓" everywhere, never "Order placed ✓".

// ── Admin input ─────────────────────────────────────────────────────────────

export const MAX_ORDER_TOTAL_CENTS = 1_000_000; // $10,000: well above any register
const MAX_ORDER_NUMBER_LEN = 64;

export type OrderFields = {
  totalCents:          number;
  taxCents:            number | null;
  trackingUrl:         string;
  estimatedDeliveryOn: Date;
  orderNumber:         string | null;
};

// "54.37" → 5437. Dollars with at most two decimals; nothing else.
function parseCents(raw: unknown, min: number): number | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const s = String(raw).trim().replace(/^\$/, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  const [d, c = ""] = s.split(".");
  const cents = Number(d) * 100 + Number(c.padEnd(2, "0"));
  return cents >= min && cents <= MAX_ORDER_TOTAL_CENTS ? cents : null;
}
export const parseTotalCents = (raw: unknown): number | null => parseCents(raw, 1);

// Tax is optional: blank means not recorded (null); 0 is a recorded zero.
export function parseTaxCents(raw: unknown): { ok: true; value: number | null } | { ok: false } {
  if (raw === undefined || raw === null || (typeof raw === "string" && !raw.trim())) return { ok: true, value: null };
  const c = parseCents(raw, 0);
  return c === null ? { ok: false } : { ok: true, value: c };
}

// "2026-10-28" → that calendar date (stored as DATE, so UTC midnight). Not in
// the past by more than a month, not more than a year ahead.
export function parseDeliveryDate(raw: unknown, now = new Date()): Date | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return null;
  const d = new Date(`${raw.trim()}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw.trim()) return null;
  const day = 86_400_000;
  if (d.getTime() < now.getTime() - 31 * day || d.getTime() > now.getTime() + 366 * day) return null;
  return d;
}

export function parseOrderNumber(raw: unknown): { ok: true; value: string | null } | { ok: false } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false };
  const s = raw.trim();
  if (!s) return { ok: true, value: null };
  if (s.length > MAX_ORDER_NUMBER_LEN || !/^[\w\-# ]+$/.test(s)) return { ok: false };
  return { ok: true, value: s };
}

export const TAX_OVER_TOTAL_ERROR = "The tax can't be more than the order total.";

// Every field required except the order number and tax. `partial` is for an
// edit: only the fields present are checked and returned (the route checks
// tax against the stored total when only one of them is sent).
export function validateOrderFields(body: Record<string, unknown>, partial = false):
  { ok: true; fields: Partial<OrderFields> } | { ok: false; error: string } {
  const fields: Partial<OrderFields> = {};
  const has = (k: string) => !partial || body[k] !== undefined;

  if (has("total")) {
    const c = parseTotalCents(body.total);
    if (c === null) return { ok: false, error: "Enter the order total in dollars, e.g. 54.37, including tax and shipping." };
    fields.totalCents = c;
  }
  if (has("tax")) {
    const t = parseTaxCents(body.tax);
    if (!t.ok) return { ok: false, error: "Enter the tax in dollars, e.g. 6.12, or leave it blank." };
    fields.taxCents = t.value;
  }
  if (fields.totalCents !== undefined && fields.taxCents != null && fields.taxCents > fields.totalCents) {
    return { ok: false, error: TAX_OVER_TOTAL_ERROR };
  }
  if (has("trackingUrl")) {
    const t = validateTrackingUrl(body.trackingUrl);
    if (!t.ok) return { ok: false, error: t.error };
    fields.trackingUrl = t.url;
  }
  if (has("estimatedDeliveryOn")) {
    const d = parseDeliveryDate(body.estimatedDeliveryOn);
    if (!d) return { ok: false, error: "Enter the estimated delivery date (within the next year)." };
    fields.estimatedDeliveryOn = d;
  }
  if (has("orderNumber")) {
    const n = parseOrderNumber(body.orderNumber);
    if (!n.ok) return { ok: false, error: `The order number can be up to ${MAX_ORDER_NUMBER_LEN} letters, digits and dashes.` };
    fields.orderNumber = n.value;
  }
  return { ok: true, fields };
}

// ── Order total vs. funded amount (host dashboard only) ─────────────────────

// Highlighted when the difference is more than the larger of $5 or 15% of the
// funded amount. Neutral wording, and nothing about who covers a shortfall or
// where a surplus goes. Never shown on the overlay or the streamer page.
export const DIFF_MIN_CENTS = 500;
export const DIFF_SHARE     = 0.15;

export type OrderDifference = {
  fundedCents:     number; // the order's items, each counted up to its price
  totalCents:      number;
  differenceCents: number; // total − funded
  highlight:       boolean;
};

export function orderDifference(totalCents: number, items: ProgressItem[]): OrderDifference {
  const fundedCents = items.reduce((s, i) => s + itemCappedFundedCents(i), 0);
  const differenceCents = totalCents - fundedCents;
  const threshold = Math.max(DIFF_MIN_CENTS, fundedCents * DIFF_SHARE);
  return { fundedCents, totalCents, differenceCents, highlight: Math.abs(differenceCents) > threshold };
}

const usd = (c: number) => `$${(Math.abs(c) / 100).toFixed(2)}`;
export function differenceText(d: OrderDifference): string {
  const sign = d.differenceCents > 0 ? "+" : d.differenceCents < 0 ? "−" : "";
  return `Funded for these items: ${usd(d.fundedCents)} · Order total ${usd(d.totalCents)} · Difference ${sign}${usd(d.differenceCents)}`;
}

// ── The streamer's read ─────────────────────────────────────────────────────

// The ONLY columns the streamer route reads from an order.
export const STREAMER_ORDER_SELECT = Prisma.validator<Prisma.FulfillmentOrderSelect>()({
  totalCents:          true,
  taxCents:            true,
  trackingUrl:         true,
  estimatedDeliveryOn: true,
  items: {
    // The register's own item order. Items are often queued in the same instant.
    orderBy: [{ registerItem: { createdAt: "asc" } }, { registerItem: { id: "asc" } }],
    select:  { status: true, registerItem: { select: { name: true } } },
  },
});

// The ONLY columns the streamer route reads from a completion.
export const STREAMER_COMPLETION_SELECT = Prisma.validator<Prisma.EventRegisterCompletionSelect>()({
  register: {
    select: {
      featureConsent: true,
      // Inputs to liveRegisterTitle only: the title leaves as its result.
      featureConsentVersion: true,
      title: true,
      creator: { select: { name: true } },
      // Funded items with no order record, listed as "Funded ✓".
      items: {
        where:   { status: { notIn: ["PENDING_APPROVAL", "CANCELLED"] } },
        orderBy: { createdAt: "asc" },
        select: {
          name: true, standardPriceCents: true, totalFundedCents: true, fundingStatus: true,
          fulfillmentQueue: { select: { orderId: true } },
        },
      },
      fulfillmentOrders: { orderBy: { createdAt: "asc" }, select: STREAMER_ORDER_SELECT },
    },
  },
});

type StreamerOrderRow = {
  totalCents: number; taxCents: number | null; trackingUrl: string | null; estimatedDeliveryOn: Date;
  items: { status: string; registerItem: { name: string } }[];
};
export type StreamerCompletionRow = {
  register: {
    featureConsent: boolean;
    featureConsentVersion: number | null;
    title: string;
    creator: { name: string | null };
    items: {
      name: string; standardPriceCents: number; totalFundedCents: number; fundingStatus: string;
      fulfillmentQueue: { orderId: string | null } | null;
    }[];
    fulfillmentOrders: StreamerOrderRow[];
  };
};

export type StreamerOrder = {
  items:             string[];
  status:            "ORDERED" | "DELIVERED";
  trackingUrl:       string;
  estimatedDelivery: string;        // YYYY-MM-DD
  totalCents:        number;        // tax and shipping included
  taxCents:          number | null; // null when not recorded
};
export type StreamerRegister = {
  firstName:      string | null;    // null → "A mother"
  title:          string | null;    // checked and trimmed, or null (lib/publicCelebration)
  orders:         StreamerOrder[];
  // Funded items with no order record: not ordered yet, or bought without a
  // tracking link. Both read "Funded ✓"; the page doesn't say which.
  fundedNoRecord: string[];
};

// Field by field, never a spread. Same rules as the recap: strict first name,
// and a mother who withdrew consent is dropped. Registers are listed by
// position; no id leaves the server.
export function toStreamerOrders(rows: StreamerCompletionRow[]): StreamerRegister[] {
  return rows.filter((r) => r.register.featureConsent).map((r) => ({
    firstName: firstNameOnly(r.register.creator.name),
    title:     liveRegisterTitle({
      title: r.register.title, motherName: r.register.creator.name,
      featureConsent: r.register.featureConsent, featureConsentVersion: r.register.featureConsentVersion,
    }),
    // An order with no items or no link (her register was deleted) is not shown.
    orders: r.register.fulfillmentOrders.filter((o) => o.items.length > 0 && o.trackingUrl).map((o) => ({
      items:             o.items.map((i) => String(i.registerItem.name)),
      status:            o.items.every((i) => i.status === "DELIVERED") ? "DELIVERED" as const : "ORDERED" as const,
      trackingUrl:       String(o.trackingUrl),
      estimatedDelivery: o.estimatedDeliveryOn.toISOString().slice(0, 10),
      totalCents:        Number(o.totalCents),
      taxCents:          o.taxCents === null ? null : Number(o.taxCents),
    })),
    fundedNoRecord: r.register.items
      .filter((i) => !i.fulfillmentQueue?.orderId && isItemFunded(i))
      .map((i) => String(i.name)),
  }));
}

export async function fetchStreamerOrders(eventId: string): Promise<StreamerRegister[]> {
  const rows = await prisma.eventRegisterCompletion.findMany({
    where:   { eventId },
    orderBy: [{ completedAt: "asc" }, { id: "asc" }],
    select:  STREAMER_COMPLETION_SELECT,
  });
  return toStreamerOrders(rows);
}

// ── Deleting her register ───────────────────────────────────────────────────

// Run in the same transaction as the delete, before it. The order stays as a
// financial record (total, tax, dates, who recorded and edited it), but the
// tracking link (it leads to her package) and the order number are cleared,
// so nothing left points back at her. Raw SQL so updatedAt and updatedById,
// the edit trail, stay as the last admin edit left them.
export function scrubOrdersForRegister(tx: Prisma.TransactionClient, registerId: string) {
  return tx.$executeRaw`
    UPDATE "FulfillmentOrder" SET "trackingUrl" = NULL, "orderNumber" = NULL
    WHERE "registerId" = ${registerId}`;
}

// Every register she created (deleting a user cascades to them).
export function scrubOrdersForCreator(tx: Prisma.TransactionClient, userId: string) {
  return tx.$executeRaw`
    UPDATE "FulfillmentOrder" SET "trackingUrl" = NULL, "orderNumber" = NULL
    WHERE "registerId" IN (SELECT "id" FROM "Register" WHERE "creatorId" = ${userId})`;
}
