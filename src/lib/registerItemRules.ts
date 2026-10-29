import { Prisma } from "@prisma/client";

// What a mother may do to her register's items, and when.
//
// ADDING: only while the register is a DRAFT. A live register's list is what
// donors were shown and what events feature, so it doesn't grow. Adding no
// longer publishes the register: publishing is its own step
// (api/registers/[id]/publish).
//
// REMOVING: never anything with a payment attached, in any state (a funding
// row of any status: an open checkout, a confirmed contribution or a refund).
// On a live register, also nothing reserved by a giver, being ordered, already
// moving through fulfilment, in a live event, or on a register that unlocked
// a sponsor bundle. Each refusal says why, in plain words.
//
// The check runs inside the delete's transaction after locking the item row
// (FOR UPDATE). A payment starting at the same moment inserts a funding row
// that needs a key-share lock on the item, so it waits; either it got in first
// and the removal is refused, or the item is gone and its insert fails. A
// payment is never left without its item.
//
// Admins aren't covered here: their routes are separate and unchanged.

export const ADD_TO_LIVE_ERROR = "This register is live, so items can't be added. Contact us if you need a change.";

export const REMOVAL_REFUSED = {
  CONTRIBUTIONS:   "This item has contributions, so it can't be removed.",
  PAYMENT_PENDING: "Someone is paying for this item right now, so it can't be removed.",
  PAYMENT_RECORD:  "This item has a payment on record, so it can't be removed.",
  RESERVED:        "A giver has reserved this item, so it can't be removed.",
  BEING_ORDERED:   "This item is being ordered for you, so it can't be removed.",
  IN_PROGRESS:     "This item is already on its way or finished, so it can't be removed.",
  ON_SCREEN:       "Your register is on screen in a live event right now, so items can't be removed until the event ends.",
  IN_LIVE_EVENT:   "This item is part of a live event, so it can't be removed until the event ends.",
  BUNDLE_UNLOCKED: "Your register unlocked a sponsor bundle, so its items can't be removed.",
} as const;
export type RemovalRefusal = keyof typeof REMOVAL_REFUSED;

// Item statuses a live item may still be removed from: not yet reserved,
// ordered or delivered.
const REMOVABLE_STATUSES = new Set(["AVAILABLE", "PENDING_APPROVAL"]);

export type RemovalFacts = {
  registerStatus: string;
  totalFundedCents: number;
  itemStatus: string;
  fundingStatuses: string[];          // every funding row on the item
  hasAssignment: boolean;
  hasQueueRow: boolean;
  onScreenInOpenEvent: boolean;       // her register is an event's current register, event not ENDED
  celebrationInOpenEvent: boolean;    // the item has a celebration in an event not ENDED
  bundleUnlocked: boolean;            // her register unlocked a sponsor bundle
};

// Pure, so every rule is unit-tested. null = may remove.
export function removalRefusal(f: RemovalFacts): RemovalRefusal | null {
  // Payment rows: every register, drafts too.
  if (f.totalFundedCents > 0 || f.fundingStatuses.includes("CONFIRMED")) return "CONTRIBUTIONS";
  if (f.fundingStatuses.includes("PENDING")) return "PAYMENT_PENDING";
  if (f.fundingStatuses.length > 0) return "PAYMENT_RECORD";
  if (f.registerStatus === "DRAFT") return null;

  if (f.hasAssignment) return "RESERVED";
  if (f.hasQueueRow) return "BEING_ORDERED";
  if (!REMOVABLE_STATUSES.has(f.itemStatus)) return "IN_PROGRESS";
  if (f.onScreenInOpenEvent) return "ON_SCREEN";
  if (f.celebrationInOpenEvent) return "IN_LIVE_EVENT";
  if (f.bundleUnlocked) return "BUNDLE_UNLOCKED";
  return null;
}

// Gather the facts inside the transaction, after locking the item row.
export async function removalFactsLocked(tx: Prisma.TransactionClient, itemId: string): Promise<RemovalFacts | null> {
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "RegisterItem" WHERE "id" = ${itemId} FOR UPDATE`;
  if (locked.length === 0) return null;
  const item = await tx.registerItem.findUnique({
    where:  { id: itemId },
    select: {
      status: true, totalFundedCents: true, registerId: true,
      register:         { select: { status: true, eventBundleUnlock: { select: { id: true } } } },
      funding:          { select: { status: true } },
      assignment:       { select: { id: true } },
      fulfillmentQueue: { select: { id: true } },
      eventCelebrations: { where: { event: { status: { not: "ENDED" } } }, select: { id: true }, take: 1 },
    },
  });
  if (!item) return null;
  const onScreen = await tx.fundraisingEvent.count({
    where: { currentRegisterId: item.registerId, status: { not: "ENDED" } },
  });
  return {
    registerStatus:         item.register.status,
    totalFundedCents:       item.totalFundedCents,
    itemStatus:             item.status,
    fundingStatuses:        item.funding.map((f) => f.status),
    hasAssignment:          !!item.assignment,
    hasQueueRow:            !!item.fulfillmentQueue,
    onScreenInOpenEvent:    onScreen > 0,
    celebrationInOpenEvent: item.eventCelebrations.length > 0,
    bundleUnlocked:         !!item.register.eventBundleUnlock,
  };
}

// Publishing: a draft with at least one item (a custom item still awaiting
// approval counts; it stays hidden from donors until approved, as before).
export const PUBLISH_REFUSED = {
  NOT_DRAFT: "This register is already live.",
  NO_ITEMS:  "Add at least one item before publishing your register.",
} as const;
