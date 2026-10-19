// Unit tests for lib/publicCelebration and lib/donorName. Run: npx tsx --test src/lib/publicCelebration.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { toPublicCelebration, celebrationText, type CelebrationRow } from "./publicCelebration";
import { donorNameMetadata, donorNameFromMetadata } from "./donorName";
import { firstNameOnly } from "./eventEffects";

const row = (o: Partial<CelebrationRow>): CelebrationRow => ({
  type: "ITEM_FUNDED", donorDisplayName: null, motherName: "Aisha Bello",
  itemName: "Diapers", bundle: null, ...o,
});
const SHOW = { hideDonorNames: false, sponsorConfirmed: true };

// Any key that could identify a register, item, unlock, event or celebration.
const ID_KEYS = /(^id$|Id$)/;
const keysDeep = (v: unknown): string[] =>
  v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => [k, ...keysDeep(x)]) : [];

test("a bundle celebration carries only its type and the sponsor line — no mother", () => {
  const p = toPublicCelebration(row({ type: "BUNDLE_UNLOCKED", motherName: "Aisha Bello", itemName: "Diapers", bundle: { valueCents: 20000, sponsorName: "Acme" } }), SHOW);
  assert.deepEqual(p, { type: "BUNDLE_UNLOCKED", sponsorLine: { valueCents: 20000, sponsorName: "Acme" } });
  assert.ok(!JSON.stringify(p).includes("Aisha") && !JSON.stringify(p).includes("Diapers"));
  assert.deepEqual(celebrationText(p), { headline: "Sponsor bundle unlocked", line: "~$200 additional support from Acme" });
});

test("sponsor line only while the sponsor is confirmed", () => {
  const p = toPublicCelebration(row({ type: "BUNDLE_UNLOCKED", bundle: { valueCents: 20000, sponsorName: "Acme" } }), { ...SHOW, sponsorConfirmed: false });
  assert.deepEqual(p, { type: "BUNDLE_UNLOCKED", sponsorLine: null });
  assert.deepEqual(celebrationText(p), { headline: "Sponsor bundle unlocked", line: null });
});

test("no public celebration of any type has an id", () => {
  for (const type of ["ITEM_FUNDED", "ITEM_FUNDED_BY_ONE", "REGISTER_COMPLETE", "BUNDLE_UNLOCKED"] as const) {
    const p = toPublicCelebration(row({ type, donorDisplayName: "Sarah", bundle: { valueCents: 1, sponsorName: "S" } }), SHOW);
    assert.deepEqual(keysDeep(p).filter((k) => ID_KEYS.test(k)), [], type);
  }
});

test("mother and donor are first names only", () => {
  const p = toPublicCelebration(row({ type: "ITEM_FUNDED_BY_ONE", motherName: "Aisha Bello Okafor", donorDisplayName: "Sarah Jane Smith" }), SHOW);
  assert.deepEqual(p, { type: "ITEM_FUNDED_BY_ONE", motherFirstName: "Aisha", itemName: "Diapers", donorFirstName: "Sarah" });
  assert.equal(celebrationText(p).headline, "Sarah funded Aisha's diapers ✓");
  assert.ok(!JSON.stringify(p).includes("Bello") && !JSON.stringify(p).includes("Smith"));
});

test("the host switch removes the donor name at show time", () => {
  const p = toPublicCelebration(row({ type: "ITEM_FUNDED_BY_ONE", donorDisplayName: "Sarah" }), { ...SHOW, hideDonorNames: true });
  assert.equal((p as { donorFirstName: string | null }).donorFirstName, null);
  assert.equal(celebrationText(p).headline, "Aisha's diapers funded ✓");
});

test("a mother whose first name fails the rule still gets her celebration, with no name", () => {
  const item = toPublicCelebration(row({ motherName: "Ai$ha Bello" }), SHOW);
  assert.deepEqual(item, { type: "ITEM_FUNDED", motherFirstName: null, itemName: "Diapers" });
  assert.equal(celebrationText(item).headline, "Diapers funded ✓");
  const done = toPublicCelebration(row({ type: "REGISTER_COMPLETE", motherName: "123" }), SHOW);
  assert.deepEqual(celebrationText(done), { headline: "A Register is fully funded", line: "Fully funded ✓" });
  const missing = toPublicCelebration(row({ motherName: null, itemName: null }), SHOW);
  assert.equal(celebrationText(missing).headline, "An item funded ✓");
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
  assert.deepEqual(donorNameFromMetadata({ showName: "1", displayName: "<b>" }), { showNameConsent: true, displayName: null });
  assert.deepEqual(donorNameFromMetadata({ showName: "yes", displayName: "Sarah" }), { showNameConsent: false, displayName: null });
  assert.deepEqual(donorNameFromMetadata({}), { showNameConsent: false, displayName: null });
  assert.deepEqual(donorNameFromMetadata(null), { showNameConsent: false, displayName: null });
});

test("first-name rule: letters from any language, apostrophes, hyphens — kept as typed", () => {
  assert.equal(firstNameOnly("Ọlábísí"), "Ọlábísí");
  assert.equal(firstNameOnly("O\u0323la\u0301bi\u0301si\u0301"), "Ọlábísí", "decomposed input is normalised to NFC");
  assert.equal(firstNameOnly("Zoë Smith"), "Zoë");
  assert.equal(firstNameOnly("O'Neil"), "O'Neil");
  assert.equal(firstNameOnly("Anne-Marie Jones"), "Anne-Marie");
  assert.equal(firstNameOnly("فاطمة الزهراء"), "فاطمة");
  assert.equal(firstNameOnly("Abcdefghijklmnopqrstuvwxyz"), "Abcdefghijklmnopqrst", "20-character cap");
});

test("first-name rule: anything else in the first word means no name", () => {
  assert.equal(firstNameOnly("<b>Sarah</b>"), null);
  assert.equal(firstNameOnly("<b>"), null);
  assert.equal(firstNameOnly("123"), null);
  assert.equal(firstNameOnly("Sa$rah"), null);
  assert.equal(firstNameOnly("Sarah2"), null);
  assert.equal(firstNameOnly("'-"), null, "punctuation alone is not a name");
  assert.equal(firstNameOnly("   "), null);
  assert.equal(firstNameOnly(null), null);
});
