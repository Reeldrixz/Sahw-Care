import { createHash } from "crypto";
import { isItemFunded } from "@/lib/eventProgress";

// When a mother's address is blanked (redacted), and what is kept. Used by the
// redact-addresses job and by the live-consent withdrawal (lib/liveAddress).
//
// PER-ITEM address (ShipmentAddress): 24 hours after that item is delivered
// (or cancelled), as before.
//
// SAVED address (RegisterAddress), checked in order:
//   1. NEVER while a funded item is still waiting to be ordered or shipped.
//   2. 24 hours after every funded item on the register is delivered.
//   3. 24 hours after the register is closed (or ended).
//   4. Nothing funded, and confirmed (or, if never confirmed, created) more
//      than 90 days ago. She can confirm again on the consent card.
//
// Blanking keeps an AddressAuditSnapshot first: city, province, country, the
// first three characters of the postal code and a hash of the full address.

export const BLANK_AFTER_HOURS = 24;
export const UNFUNDED_ADDRESS_MAX_DAYS = 90;

export function hashAddress(a: { streetAddress: string; unit: string | null; city: string; province: string; postalCode: string; country: string }): string {
  return createHash("sha256")
    .update(`${a.streetAddress}|${a.unit ?? ""}|${a.city}|${a.province}|${a.postalCode}|${a.country}`)
    .digest("hex");
}

type Addr = { streetAddress: string; unit: string | null; city: string; province: string; postalCode: string; country: string };
export function auditSnapshot(a: Addr, ids: { registerId: string | null; registerItemId: string | null }) {
  return {
    ...ids,
    city: a.city, province: a.province, country: a.country,
    postalCodeFirst3: a.postalCode.slice(0, 3).toUpperCase(),
    addressHash: hashAddress(a),
  };
}

export const BLANKED_FIELDS = {
  fullName: "[REDACTED]", streetAddress: "[REDACTED]", unit: null, postalCode: "", phone: "[REDACTED]",
} as const;

export const BLANK_ITEM_SELECT = {
  status: true, standardPriceCents: true, totalFundedCents: true, fundingStatus: true,
  fulfillmentQueue: { select: { status: true, deliveredAt: true } },
} as const;

export type BlankItem = {
  status: string; standardPriceCents: number; totalFundedCents: number; fundingStatus: string;
  fulfillmentQueue: { status: string; deliveredAt: Date | null } | null;
};
const ENDED_ITEM = new Set(["FULFILLED", "DELIVERED", "CANCELLED"]);

// Delivered: the queue says so, or the item reached FULFILLED (what the queue
// sets on delivery). Its time is the queue's deliveredAt.
const delivered = (i: BlankItem) => i.fulfillmentQueue?.status === "DELIVERED" || i.status === "FULFILLED" || i.status === "DELIVERED";
const counted = (i: BlankItem) => isItemFunded(i) || delivered(i);
export const waitingToShip = (i: BlankItem) => counted(i) && !ENDED_ITEM.has(i.status) && i.fulfillmentQueue?.status !== "DELIVERED";

export type SavedAddressCase = {
  confirmedAt: Date | null; createdAt: Date;
  register: { status: string; closedAt: Date | null; updatedAt: Date; items: BlankItem[] };
};
export type BlankDecision =
  | { blank: false; why: "WAITING" | "NOT_YET" }
  | { blank: true; why: "ALL_DELIVERED" | "CLOSED" | "UNFUNDED_90_DAYS" };

export function savedAddressDecision(c: SavedAddressCase, now = new Date()): BlankDecision {
  const items = c.register.items;
  if (items.some(waitingToShip)) return { blank: false, why: "WAITING" };

  const after = now.getTime() - BLANK_AFTER_HOURS * 3_600_000;
  // Funded items that ended delivered (a refunded, cancelled item isn't funded).
  const funded = items.filter((i) => i.status !== "CANCELLED" && counted(i));
  if (funded.length > 0) {
    const times = funded.map((i) => i.fulfillmentQueue?.deliveredAt?.getTime() ?? null);
    // Every funded item delivered (none is waiting, checked above): blank
    // 24 hours after the last delivery. A delivery with no time recorded
    // counts as long ago.
    const last = Math.max(...times.map((t) => t ?? 0));
    if (last <= after) return { blank: true, why: "ALL_DELIVERED" };
  }
  const ended = ["CLOSED", "COMPLETED", "ABANDONED"].includes(c.register.status);
  if (ended) {
    const at = (c.register.closedAt ?? c.register.updatedAt).getTime();
    if (at <= after) return { blank: true, why: "CLOSED" };
  }
  if (funded.length === 0) {
    const since = (c.confirmedAt ?? c.createdAt).getTime();
    if (since <= now.getTime() - UNFUNDED_ADDRESS_MAX_DAYS * 86_400_000) return { blank: true, why: "UNFUNDED_90_DAYS" };
  }
  return { blank: false, why: "NOT_YET" };
}
