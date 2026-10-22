import { prisma } from "@/lib/prisma";
import { fetchOnScreenRegister } from "@/lib/registers";
import { firstNameOnly } from "@/lib/eventEffects";
import { registerItemCounts, fundedPercent, itemRemainingCents, itemCappedFundedCents, isItemFunded } from "@/lib/eventProgress";
import { toPublicCelebration, type PublicCelebration } from "@/lib/publicCelebration";

// What the broadcast overlay receives on each poll (POST /api/overlay/[token]/frame).
//
// A frame is the CURRENT STATE plus, at most, one celebration the overlay has
// just been given to show:
//   event        goal progress (registers completed of goalRegisters) and the
//                event's totals (registers completed, items funded on screen)
//   register     the register on screen: her first name (or none, if it fails
//                the name rule), each item's price, funded and remaining
//                amounts (capped at the price, lib/eventProgress) and state,
//                and "funded N of M items" with the percent
//   celebration  one PublicCelebration (lib/publicCelebration), or null
//
// NO IDS, NO FULL NAMES, NO DOLLAR TOTAL. Nothing here carries a register,
// item, event, unlock or celebration id. The register title is not sent: it
// is the mother's own free text and could hold her full name. The event's
// dollar total stays on the host dashboard only.
//
// ── The queue ────────────────────────────────────────────────────────────────
// Celebrations are claimed one at a time, oldest first, by a single UPDATE
// that sets shownAt on the oldest eligible row it can lock (FOR UPDATE SKIP
// LOCKED), re-checking shownAt IS NULL. Two overlays polling one event at the
// same moment lock different rows or none: they can never both get the same
// celebration. A claimed celebration is never offered again, so a reload or a
// reconnect gets the current state and nothing that was already shown —
// hydrating needs no special case.
//
// Stale celebrations, never shown and now old, are not shown: a moment
// belongs to the stream as it happens.
//   - A register's celebrations (item funded, register complete) expire after
//     CELEBRATION_TTL_SECONDS. Shown minutes late, "Aisha's diapers funded"
//     would land while the screen shows someone else — confusing for viewers
//     and not what the mother agreed to see happen.
//   - A sponsor bundle waits for its own beat (below) and expires after
//     BUNDLE_TTL_SECONDS, much later: it names no mother and is still true
//     later, so it shouldn't be lost because the overlay was busy.
// Expired rows are left as they are (shownAt null), a record of what was
// never broadcast; nothing deletes them.
//
// ── The sponsor beat ─────────────────────────────────────────────────────────
// A bundle celebration is held until it is at least BUNDLE_MIN_AGE_SECONDS
// old — so at least that long after the register that produced it completed —
// and never within BUNDLE_AFTER_COMPLETE_GAP_SECONDS of any register-complete
// being shown. It appears as its own moment, apart from any mother's, so the
// audience can't tie the sponsor bundle to a particular register.

export const CELEBRATION_TTL_SECONDS          = 120;
export const BUNDLE_MIN_AGE_SECONDS           = 60;
export const BUNDLE_AFTER_COMPLETE_GAP_SECONDS = 30;
export const BUNDLE_TTL_SECONDS               = 15 * 60;

export type OverlayItem = {
  name:           string;
  priceCents:     number;
  fundedCents:    number;   // capped at the price
  remainingCents: number;
  state:          "NEEDED" | "FUNDED" | "ORDERED";
};

export type OverlayFrame = {
  event: {
    goal:   { completed: number; target: number };
    totals: { registersCompleted: number; itemsFunded: number };
  };
  register: {
    firstName: string | null;
    items:     OverlayItem[];
    counts:    { funded: number; total: number };
    percent:   number;
  } | null;
  celebration: PublicCelebration | null;
};

// Claim the oldest eligible celebration for the event, atomically. Returns its
// id (server-side only; never sent) or null.
export async function claimNextCelebration(eventId: string, now = new Date()): Promise<string | null> {
  const ttlCut       = new Date(now.getTime() - CELEBRATION_TTL_SECONDS * 1000);
  const bundleReady  = new Date(now.getTime() - BUNDLE_MIN_AGE_SECONDS * 1000);
  const bundleCut    = new Date(now.getTime() - BUNDLE_TTL_SECONDS * 1000);
  const completeGap  = new Date(now.getTime() - BUNDLE_AFTER_COMPLETE_GAP_SECONDS * 1000);

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "EventCelebration" SET "shownAt" = ${now}
    WHERE "shownAt" IS NULL AND "id" = (
      SELECT e."id" FROM "EventCelebration" e
      WHERE e."eventId" = ${eventId} AND e."shownAt" IS NULL
        AND (
          (e."type" <> 'BUNDLE_UNLOCKED' AND e."createdAt" > ${ttlCut})
          OR (
            e."type" = 'BUNDLE_UNLOCKED'
            AND e."createdAt" <= ${bundleReady}
            AND e."createdAt" > ${bundleCut}
            AND NOT EXISTS (
              SELECT 1 FROM "EventCelebration" r
              WHERE r."eventId" = ${eventId} AND r."type" = 'REGISTER_COMPLETE' AND r."shownAt" > ${completeGap}
            )
          )
        )
      -- One payment writes its item celebration, register-complete and bundle
      -- in one transaction, so they share createdAt (now() is the
      -- transaction's start) and their ids are random: rank by type within a
      -- timestamp so the item always goes on air before its register-complete.
      ORDER BY e."createdAt" ASC,
               CASE e."type" WHEN 'REGISTER_COMPLETE' THEN 1 WHEN 'BUNDLE_UNLOCKED' THEN 2 ELSE 0 END ASC,
               e."id" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"`;
  return rows[0]?.id ?? null;
}

// The public shape of a claimed celebration, with the event's settings read
// NOW: hideDonorNames and sponsorConfirmedAt apply at the moment of showing.
async function publicFor(celebrationId: string, eventId: string): Promise<PublicCelebration | null> {
  const [c, ev] = await Promise.all([
    prisma.eventCelebration.findUnique({
      where:  { id: celebrationId },
      select: {
        type: true, donorDisplayName: true,
        register:     { select: { creator: { select: { name: true } } } },
        registerItem: { select: { name: true } },
        bundleUnlock: { select: { valueCents: true, sponsorName: true } },
      },
    }),
    prisma.fundraisingEvent.findUnique({ where: { id: eventId }, select: { hideDonorNames: true, sponsorConfirmedAt: true } }),
  ]);
  if (!c || !ev) return null;
  return toPublicCelebration(
    {
      type: c.type,
      donorDisplayName: c.donorDisplayName,
      motherName: c.register?.creator.name ?? null,
      itemName: c.registerItem?.name ?? null,
      bundle: c.bundleUnlock,
    },
    { hideDonorNames: ev.hideDonorNames, sponsorConfirmed: ev.sponsorConfirmedAt !== null },
  );
}

export async function buildOverlayFrame(eventId: string, opts: { claim: boolean }): Promise<OverlayFrame | null> {
  const ev = await prisma.fundraisingEvent.findUnique({
    where:  { id: eventId },
    select: { currentRegisterId: true, goalRegisters: true },
  });
  if (!ev) return null;

  const [onScreen, completed, itemsFunded] = await Promise.all([
    fetchOnScreenRegister(ev.currentRegisterId),
    prisma.eventRegisterCompletion.count({ where: { eventId } }),
    prisma.eventCelebration.count({ where: { eventId, type: { in: ["ITEM_FUNDED", "ITEM_FUNDED_BY_ONE"] } } }),
  ]);

  let register: OverlayFrame["register"] = null;
  if (onScreen) {
    const ordered = new Set(
      (await prisma.fulfillmentQueue.findMany({
        where:  { registerItemId: { in: onScreen.items.map((i) => i.id) }, status: { in: ["PURCHASED", "DISPATCHED", "DELIVERED"] } },
        select: { registerItemId: true },
      })).map((q) => q.registerItemId),
    );
    const counts = registerItemCounts(onScreen.items);
    register = {
      firstName: firstNameOnly(onScreen.firstName),
      items: onScreen.items.map((i) => ({
        name:           i.name,
        priceCents:     i.standardPriceCents,
        fundedCents:    itemCappedFundedCents(i),
        remainingCents: itemRemainingCents(i),
        // ORDERED ("order placed ✓") only from a purchase record: "it's
        // funded" and "we bought it" are different statements.
        state: ordered.has(i.id) ? "ORDERED" : isItemFunded(i) ? "FUNDED" : "NEEDED",
      })),
      counts,
      percent: fundedPercent(onScreen.items),
    };
  }

  const claimed = opts.claim ? await claimNextCelebration(eventId) : null;
  const celebration = claimed ? await publicFor(claimed, eventId) : null;

  return {
    event: {
      goal:   { completed, target: ev.goalRegisters },
      totals: { registersCompleted: completed, itemsFunded },
    },
    register,
    celebration,
  };
}
