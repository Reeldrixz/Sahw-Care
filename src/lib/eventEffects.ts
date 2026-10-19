import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { isItemFunded } from "@/lib/eventProgress";

// What a payment does to a live fundraising event: celebrations, completions
// and sponsor bundle unlocks. Runs INSIDE the payment transaction
// (lib/stripeLedger recordPayment), after the contribution is confirmed and
// its item total updated, with the item and register rows locked.
//
// ── Which event ─────────────────────────────────────────────────────────────
// Effects are written only for a LIVE event that has this register ON SCREEN
// at this moment (FundraisingEvent.currentRegisterId), not for every event a
// contribution is attributed to. Attribution needs only the event's link
// (?e=slug); it doesn't check the register was featured, so keying effects on
// attribution alone could put a mother who never consented on air. A register
// is only on screen because a host picked it, and picking requires her
// current consent (lib/registers). "While featured" is the literal moment.
//
// ── Never abort the payment ─────────────────────────────────────────────────
// A unique-key violation aborts a Postgres transaction, which here would roll
// back the payment. Every insert that can collide (a webhook retry, a second
// completion, a register that already has an unlock) is
// INSERT ... ON CONFLICT DO NOTHING, so a duplicate is a no-op, not an error.
// The dedupe keys are what make a retry harmless:
//   item:<eventId>:<itemId>:<type>     ITEM_FUNDED / ITEM_FUNDED_BY_ONE
//   complete:<eventId>:<registerId>    REGISTER_COMPLETE
//   bundle:<registerId>                BUNDLE_UNLOCKED (once per register, ever)
//
// ── Lock order ──────────────────────────────────────────────────────────────
// item → register (both locked by recordPayment) → event (by the conditional
// bundle-counter update). Always the same order, so payments can't deadlock.
// The register lock is what makes completion detection safe: two payments
// finishing the last two items of one register run one after the other, and
// the second sees the first's committed item.

type Tx = Prisma.TransactionClient;

export type EventEffects = {
  celebrations: string[];     // dedupe keys of celebrations written
  completions:  string[];     // event ids the register completed in
  bundleUnlockedFor: string[];// event ids that unlocked a bundle
};

// First name only, from what someone typed: the first word, taken as it is or
// not at all. It must be made only of letters from any language (Unicode
// letters, with their combining accents — "Ọlábísí", "Zoë", "محمد"),
// apostrophes and hyphens ("O'Neil", "Anne-Marie"), and contain at least one
// letter. Anything else — digits, symbols, markup — means NO name: a garbled
// name is never shown, so "<b>Sarah</b>", "123" and "Sa$rah" give null.
// Normalised to NFC, then capped at 20 characters (whole characters, so an
// accent is never cut from its letter).
const NAME_WORD = /^[\p{L}\p{M}'’\-‐]+$/u;
const HAS_LETTER = /\p{L}/u;

export function firstNameOnly(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const word = (raw.normalize("NFC").trim().split(/\s+/u)[0] ?? "");
  if (!word || !NAME_WORD.test(word) || !HAS_LETTER.test(word)) return null;
  const chars = Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(word), (s) => s.segment);
  return chars.slice(0, 20).join("");
}

// A donor, for "one donor covered it all": the account, or for a guest the
// email she paid with.
function donorKey(f: { donorId: string | null; guestEmail: string | null }): string | null {
  if (f.donorId) return `u:${f.donorId}`;
  if (f.guestEmail) return `g:${f.guestEmail.trim().toLowerCase()}`;
  return null;
}

async function insertCelebration(
  tx: Tx,
  row: {
    eventId: string; type: string; dedupeKey: string;
    registerId?: string | null; registerItemId?: string | null;
    bundleUnlockId?: string | null; donorDisplayName?: string | null;
  },
): Promise<boolean> {
  const inserted = await tx.$executeRaw`
    INSERT INTO "EventCelebration"
      ("id", "eventId", "type", "dedupeKey", "registerId", "registerItemId", "bundleUnlockId", "donorDisplayName")
    VALUES (${randomUUID()}, ${row.eventId}, ${row.type}::"EventCelebrationType", ${row.dedupeKey},
            ${row.registerId ?? null}, ${row.registerItemId ?? null}, ${row.bundleUnlockId ?? null}, ${row.donorDisplayName ?? null})
    ON CONFLICT DO NOTHING`;
  return inserted === 1;
}

// Called once per confirmed payment that brought its item to full funding.
export async function applyEventEffects(
  tx: Tx,
  p: { fundingId: string; itemId: string; registerId: string },
): Promise<EventEffects> {
  const out: EventEffects = { celebrations: [], completions: [], bundleUnlockedFor: [] };

  const events = await tx.fundraisingEvent.findMany({
    where:  { status: "LIVE", currentRegisterId: p.registerId },
    select: {
      id: true, hideDonorNames: true, sponsorConfirmedAt: true,
      sponsorName: true, sponsorBundleValueCents: true,
    },
  });
  if (events.length === 0) return out;

  // ── Item funded ─────────────────────────────────────────────────────────
  const contributions = await tx.registerItemFunding.findMany({
    where:   { registerItemId: p.itemId, status: "CONFIRMED" },
    select:  { id: true, donorId: true, guestEmail: true, displayName: true, showNameConsent: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const donors = new Set(contributions.map(donorKey));
  const byOne = donors.size === 1 && !donors.has(null);
  const type = byOne ? "ITEM_FUNDED_BY_ONE" : "ITEM_FUNDED";

  // Her name only if she covered it alone, EVERY one of her payments on this
  // item had the box ticked, and the host hasn't hidden names. Taken from the
  // payment that completed it (her latest). First name only.
  const current = contributions.find((c) => c.id === p.fundingId) ?? contributions[contributions.length - 1];
  const allConsented = contributions.every((c) => c.showNameConsent);

  for (const ev of events) {
    const name = byOne && allConsented && !ev.hideDonorNames ? firstNameOnly(current?.displayName) : null;
    const key = `item:${ev.id}:${p.itemId}:${type}`;
    if (await insertCelebration(tx, {
      eventId: ev.id, type, dedupeKey: key,
      registerId: p.registerId, registerItemId: p.itemId,
      donorDisplayName: type === "ITEM_FUNDED_BY_ONE" ? name : null,
    })) out.celebrations.push(key);
  }

  // ── Register complete ───────────────────────────────────────────────────
  // Every item a donor can see is funded, read after this payment's update
  // and under the register lock.
  const items = await tx.registerItem.findMany({
    where:  { registerId: p.registerId, status: { notIn: ["PENDING_APPROVAL", "CANCELLED"] } },
    select: { standardPriceCents: true, totalFundedCents: true, fundingStatus: true },
  });
  const complete = items.length > 0 && items.every((i) => isItemFunded(i));
  if (!complete) return out;

  for (const ev of events) {
    // Counts only with at least one contribution to this register attributed
    // to this event.
    const attributed = await tx.registerItemFunding.count({
      where: { fundraisingEventId: ev.id, status: "CONFIRMED", registerItem: { registerId: p.registerId } },
    });
    if (attributed === 0) continue;

    const newCompletion = await tx.$executeRaw`
      INSERT INTO "EventRegisterCompletion" ("id", "eventId", "registerId")
      VALUES (${randomUUID()}, ${ev.id}, ${p.registerId})
      ON CONFLICT DO NOTHING`;
    if (newCompletion !== 1) continue;   // already completed in this event
    out.completions.push(ev.id);

    const completeKey = `complete:${ev.id}:${p.registerId}`;
    if (await insertCelebration(tx, {
      eventId: ev.id, type: "REGISTER_COMPLETE", dedupeKey: completeKey, registerId: p.registerId,
    })) out.celebrations.push(completeKey);

    // ── Bundle unlock ─────────────────────────────────────────────────────
    // All three must hold: sponsor confirmed; a bundle left in the
    // reservation (conditional update, which also takes the event row lock,
    // so two registers completing at once can't both take the last one); the
    // register has never had an unlock, on any event (unique registerId).
    if (!ev.sponsorConfirmedAt || !ev.sponsorName || ev.sponsorBundleValueCents == null) continue;

    const unlockId = randomUUID();
    const claimedRegister = await tx.$executeRaw`
      INSERT INTO "EventBundleUnlock" ("id", "eventId", "registerId", "valueCents", "sponsorName")
      VALUES (${unlockId}, ${ev.id}, ${p.registerId}, ${ev.sponsorBundleValueCents}, ${ev.sponsorName})
      ON CONFLICT DO NOTHING`;
    if (claimedRegister !== 1) continue;   // this register already had an unlock

    const tookBundle = await tx.$executeRaw`
      UPDATE "FundraisingEvent"
      SET "sponsorBundlesUnlocked" = "sponsorBundlesUnlocked" + 1
      WHERE "id" = ${ev.id}
        AND "sponsorConfirmedAt" IS NOT NULL
        AND "sponsorBundlesUnlocked" < "sponsorBundlesReserved"`;
    if (tookBundle !== 1) {
      // None left (or the sponsor was unconfirmed since this read): give the
      // register its claim back, so a later event can still unlock for it.
      await tx.$executeRaw`DELETE FROM "EventBundleUnlock" WHERE "id" = ${unlockId}`;
      continue;
    }
    out.bundleUnlockedFor.push(ev.id);

    // Names no mother: no register or item on the celebration.
    const bundleKey = `bundle:${p.registerId}`;
    if (await insertCelebration(tx, {
      eventId: ev.id, type: "BUNDLE_UNLOCKED", dedupeKey: bundleKey, bundleUnlockId: unlockId,
    })) out.celebrations.push(bundleKey);
  }

  return out;
}
