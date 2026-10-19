// Unit tests for lib/publicCelebration and lib/donorName. Run: npx tsx --test src/lib/publicCelebration.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { toPublicCelebration, type CelebrationRow } from "./publicCelebration";
import { donorNameMetadata, donorNameFromMetadata } from "./donorName";

const row = (o: Partial<CelebrationRow>): CelebrationRow => ({
  id: "cel_1", type: "ITEM_FUNDED", donorDisplayName: null, motherName: "Aisha Bello",
  itemName: "Diapers", bundle: null, ...o,
});

// Any key that could point back to a register, item or unlock.
const ID_KEYS = /^(registerId|registerItemId|bundleUnlockId|itemId|unlockId|eventId)$/;
const keysDeep = (v: unknown): string[] =>
  v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => [k, ...keysDeep(x)]) : [];

test("a bundle celebration carries only id, type, value and sponsor", () => {
  const p = toPublicCelebration(row({ type: "BUNDLE_UNLOCKED", motherName: "Aisha Bello", itemName: "Diapers", bundle: { valueCents: 20000, sponsorName: "Acme" } }));
  assert.deepEqual(p, { id: "cel_1", type: "BUNDLE_UNLOCKED", valueCents: 20000, sponsorName: "Acme" });
  assert.ok(!JSON.stringify(p).includes("Aisha"), "names no mother");
});

test("no public celebration of any type has a register, item or unlock id", () => {
  for (const type of ["ITEM_FUNDED", "ITEM_FUNDED_BY_ONE", "REGISTER_COMPLETE", "BUNDLE_UNLOCKED"] as const) {
    const p = toPublicCelebration(row({ type, donorDisplayName: "Sarah", bundle: { valueCents: 1, sponsorName: "S" } }));
    assert.deepEqual(keysDeep(p).filter((k) => ID_KEYS.test(k)), [], type);
  }
});

test("mother and donor are first names only", () => {
  const p = toPublicCelebration(row({ type: "ITEM_FUNDED_BY_ONE", motherName: "Aisha Bello Okafor", donorDisplayName: "Sarah Jane Smith" }));
  assert.deepEqual(p, { id: "cel_1", type: "ITEM_FUNDED_BY_ONE", motherFirstName: "Aisha", itemName: "Diapers", donorFirstName: "Sarah" });
  assert.ok(!JSON.stringify(p).includes("Bello") && !JSON.stringify(p).includes("Smith"));
});

test("nothing shown when the row can't be shown safely", () => {
  assert.equal(toPublicCelebration(row({ type: "BUNDLE_UNLOCKED", bundle: null })), null);
  assert.equal(toPublicCelebration(row({ motherName: null })), null);
  assert.equal(toPublicCelebration(row({ itemName: null })), null);
});

test("checkout metadata: raw name only when ticked", () => {
  assert.deepEqual(donorNameMetadata({ displayName: "  Sarah Jane ", showName: true }), { showName: "1", displayName: "Sarah Jane" });
  assert.deepEqual(donorNameMetadata({ displayName: "Sarah", showName: false }), { showName: "0", displayName: "" });
  assert.deepEqual(donorNameMetadata({ displayName: "Sarah", showName: "true" }), { showName: "0", displayName: "" }, "only a real boolean ticks it");
  assert.equal(donorNameMetadata({ displayName: "x".repeat(500), showName: true }).displayName.length, 100);
});

test("webhook metadata is untrusted: consent only for exactly \"1\", first name only", () => {
  assert.deepEqual(donorNameFromMetadata({ showName: "1", displayName: "Sarah Jane Smith" }), { showNameConsent: true, displayName: "Sarah" });
  assert.deepEqual(donorNameFromMetadata({ showName: "0", displayName: "Sarah" }), { showNameConsent: false, displayName: null });
  assert.deepEqual(donorNameFromMetadata({ showName: "1", displayName: "   " }), { showNameConsent: true, displayName: null });
  assert.deepEqual(donorNameFromMetadata({ showName: "1", displayName: "<b>" }), { showNameConsent: true, displayName: "b" });
  assert.deepEqual(donorNameFromMetadata({ showName: "yes", displayName: "Sarah" }), { showNameConsent: false, displayName: null });
  assert.deepEqual(donorNameFromMetadata({}), { showNameConsent: false, displayName: null });
  assert.deepEqual(donorNameFromMetadata(null), { showNameConsent: false, displayName: null });
});
