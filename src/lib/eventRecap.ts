import { prisma } from "@/lib/prisma";
import { isItemFunded, type ProgressItem } from "@/lib/eventProgress";
import { firstNameOnly } from "@/lib/eventEffects";

// The live fulfilment layer: registers completed in this event, and how far
// each has got since. One read (fetchEventCompletions) feeds two views:
//   - the overlay's recap line (publicRecap): first name and one status, in
//     lib/publicCelebration's public shape — no ids, no dates, no places
//   - the host dashboard's panel (hostCompletions): per-item states and
//     quiet flags for anything delayed. Problems go here, never on air.
//
// ONLY WHAT IS LITERALLY TRUE. An item is FUNDED (paid for), ORDERED (a
// purchase is recorded: FulfillmentQueue PURCHASED or DISPATCHED) or
// DELIVERED (an admin marked it delivered — the mother does not confirm
// receipt). The item's IN_FULFILLMENT status is not an order: the webhook sets
// it at funding when an address is on file. A register's status is that of its
// LEAST advanced item, so it is true of every item: "Order placed" only when
// every item has been ordered. "Fulfilled" is never said.
//
// Nothing here records a failed order (the queue has no such state), so only
// delays can be detected, from timestamps.

export type ItemStage = "NEEDED" | "FUNDED" | "ORDERED" | "DELIVERED";
export type RecapStatus = "FUNDED" | "ORDERED" | "DELIVERED";

const RANK: Record<ItemStage, number> = { NEEDED: 0, FUNDED: 1, ORDERED: 2, DELIVERED: 3 };

// Host flags: how long each stage may take before the host is told.
export const FLAG_NO_ORDER_HOURS          = 48;   // fully funded, not every item ordered
export const FLAG_ORDERED_NOT_SENT_DAYS   = 7;    // purchased, not dispatched
export const FLAG_SENT_NOT_DELIVERED_DAYS = 14;   // dispatched, not marked delivered

// The overlay shows at most this many; the rest are counted.
export const RECAP_MAX = 5;

export type CompletionItem = ProgressItem & {
  name:          string;
  queueStatus:   "QUEUED" | "PURCHASED" | "DISPATCHED" | "DELIVERED" | null;
  purchasedAt:   Date | null;
  dispatchedAt:  Date | null;
};

export type CompletionRow = {
  registerId:     string;          // server-side only
  motherName:     string | null;   // as stored; only a valid first name is used
  featureConsent: boolean;
  completedAt:    Date;
  items:          CompletionItem[];
};

export function itemStage(i: CompletionItem): ItemStage {
  if (i.queueStatus === "DELIVERED") return "DELIVERED";
  if (i.queueStatus === "PURCHASED" || i.queueStatus === "DISPATCHED") return "ORDERED";
  return isItemFunded(i) ? "FUNDED" : "NEEDED";
}

// The least advanced item's stage. null when an item is no longer funded (one
// added after completion, say): no allowed status would be true, so the
// register is left out of the recap rather than shown as "Funded ✓".
export function registerStatus(items: CompletionItem[]): RecapStatus | null {
  if (items.length === 0) return null;
  const least = items.map(itemStage).reduce((a, b) => (RANK[b] < RANK[a] ? b : a));
  return least === "NEEDED" ? null : least;
}

// Every register completed in this event, oldest first, with the items a
// donor can see and their purchase records.
export async function fetchEventCompletions(eventId: string): Promise<CompletionRow[]> {
  const rows = await prisma.eventRegisterCompletion.findMany({
    where:   { eventId },
    orderBy: [{ completedAt: "asc" }, { id: "asc" }],
    select: {
      completedAt: true,
      register: {
        select: {
          id: true, featureConsent: true,
          creator: { select: { name: true } },
          items: {
            where:   { status: { notIn: ["PENDING_APPROVAL", "CANCELLED"] } },
            orderBy: { createdAt: "asc" },
            select: {
              name: true, standardPriceCents: true, totalFundedCents: true, fundingStatus: true,
              fulfillmentQueue: { select: { status: true, purchasedAt: true, dispatchedAt: true } },
            },
          },
        },
      },
    },
  });
  return rows.map((c) => ({
    registerId:     c.register.id,
    motherName:     c.register.creator.name,
    featureConsent: c.register.featureConsent,
    completedAt:    c.completedAt,
    items: c.register.items.map((i) => ({
      name: i.name, standardPriceCents: i.standardPriceCents, totalFundedCents: i.totalFundedCents,
      fundingStatus: i.fundingStatus,
      queueStatus:  i.fulfillmentQueue?.status ?? null,
      purchasedAt:  i.fulfillmentQueue?.purchasedAt ?? null,
      dispatchedAt: i.fulfillmentQueue?.dispatchedAt ?? null,
    })),
  }));
}

// What the overlay may show: registers completed in this event, except the
// one on screen (it is the active register, shown in full) and any whose
// mother has since withdrawn feature consent — the recap is a fresh
// appearance on air. A name that fails the rule becomes null, shown as
// "A mother". The most recent RECAP_MAX, in completion order; the rest counted.
export function publicRecap(rows: CompletionRow[], onScreenRegisterId: string | null): {
  entries: { firstName: string | null; status: RecapStatus }[];
  more: number;
} {
  const all = rows
    .filter((r) => r.registerId !== onScreenRegisterId && r.featureConsent)
    .map((r) => ({ firstName: firstNameOnly(r.motherName), status: registerStatus(r.items) }))
    .filter((e): e is { firstName: string | null; status: RecapStatus } => e.status !== null);
  const entries = all.slice(-RECAP_MAX);
  return { entries, more: all.length - entries.length };
}

// ── Host dashboard ──────────────────────────────────────────────────────────

export type HostCompletion = {
  firstName:   string | null;
  completedAt: string;
  status:      RecapStatus | null;
  items:       { name: string; stage: ItemStage }[];
  flags:       string[];
};

const ago = (ms: number) => {
  const h = Math.floor(ms / 3_600_000);
  return h < 48 ? `${h} hour${h === 1 ? "" : "s"}` : `${Math.floor(h / 24)} days`;
};

// Per-item states and delay flags, for the host only. Withdrawn consent drops
// her here too: the host no longer needs her, and she asked not to be shown.
export function hostCompletions(rows: CompletionRow[], now = new Date()): HostCompletion[] {
  return rows.filter((r) => r.featureConsent).map((r) => {
    const flags: string[] = [];
    const sinceComplete = now.getTime() - r.completedAt.getTime();
    const notOrdered = r.items.filter((i) => RANK[itemStage(i)] < RANK.ORDERED).length;
    if (notOrdered > 0 && sinceComplete > FLAG_NO_ORDER_HOURS * 3_600_000) {
      flags.push(`${notOrdered} item${notOrdered === 1 ? "" : "s"} not ordered yet — fully funded ${ago(sinceComplete)} ago`);
    }
    for (const i of r.items) {
      if (i.queueStatus === "PURCHASED" && i.purchasedAt && now.getTime() - i.purchasedAt.getTime() > FLAG_ORDERED_NOT_SENT_DAYS * 86_400_000) {
        flags.push(`${i.name}: ordered ${ago(now.getTime() - i.purchasedAt.getTime())} ago, not dispatched`);
      }
      if (i.queueStatus === "DISPATCHED" && i.dispatchedAt && now.getTime() - i.dispatchedAt.getTime() > FLAG_SENT_NOT_DELIVERED_DAYS * 86_400_000) {
        flags.push(`${i.name}: dispatched ${ago(now.getTime() - i.dispatchedAt.getTime())} ago, not marked delivered`);
      }
    }
    return {
      firstName:   firstNameOnly(r.motherName),
      completedAt: r.completedAt.toISOString(),
      status:      registerStatus(r.items),
      items:       r.items.map((i) => ({ name: i.name, stage: itemStage(i) })),
      flags,
    };
  });
}

// ── The goal ────────────────────────────────────────────────────────────────

export const MAX_GOAL_REGISTERS = 1000;

// The host may raise the goal during an event, never lower it, and never set
// it below the registers already fully funded in this event.
export function checkGoalRaise(next: unknown, current: number, funded: number): string | null {
  if (typeof next !== "number" || !Number.isInteger(next) || next < 0 || next > MAX_GOAL_REGISTERS) {
    return `The goal must be a whole number from 0 to ${MAX_GOAL_REGISTERS}.`;
  }
  if (next < current) return `The goal can only be raised (it is ${current}).`;
  if (next < funded)  return `The goal can't be below the ${funded} Registers already fully funded.`;
  return null;
}

// Apply a raise atomically: the same rules re-checked in the UPDATE itself,
// against the live counts, so a concurrent completion or a second host tab
// can't slip it below either.
export async function raiseGoal(eventId: string, next: unknown):
  Promise<{ ok: true; goalRegisters: number } | { ok: false; error: string }> {
  const ev = await prisma.fundraisingEvent.findUnique({ where: { id: eventId }, select: { goalRegisters: true } });
  if (!ev) return { ok: false, error: "Not found" };
  const funded = await prisma.eventRegisterCompletion.count({ where: { eventId } });
  const err = checkGoalRaise(next, ev.goalRegisters, funded);
  if (err) return { ok: false, error: err };
  const n = next as number;
  const rows = await prisma.$queryRaw<{ goalRegisters: number }[]>`
    UPDATE "FundraisingEvent" SET "goalRegisters" = ${n}
    WHERE "id" = ${eventId} AND "goalRegisters" <= ${n}
      AND ${n} >= (SELECT count(*) FROM "EventRegisterCompletion" WHERE "eventId" = ${eventId})
    RETURNING "goalRegisters"`;
  if (rows.length === 0) return { ok: false, error: "The goal changed meanwhile; reload and try again." };
  return { ok: true, goalRegisters: rows[0].goalRegisters };
}
