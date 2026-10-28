// Unit tests for lib/featureConsent. Run: npx tsx --test src/lib/featureConsent.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FEATURE_CONSENT_COPY, FEATURE_CONSENT_VERSION, CURRENT_FEATURE_CONSENT, hasCurrentFeatureConsent } from "./featureConsent";

// A published version's text is never edited. This is the version 2 block
// exactly as it was published; any change to it fails here.
const V2_SHA256 = "e510109d452e7e3b9bd1b70ebbe07ccf047b90ec0e29cad3a0eb707a4da141f0";

test("version 2's text is unchanged", () => {
  const src = readFileSync(join(__dirname, "featureConsent.ts"), "utf8").replace(/\r\n/g, "\n");
  const block = src.match(/\n  2: \{[\s\S]*?\n  \},\n/);
  assert.ok(block, "version 2 block not found");
  assert.equal(createHash("sha256").update(block[0]).digest("hex"), V2_SHA256);
});

test("version 3 is current; earlier consent no longer lets a host pick her", () => {
  assert.equal(FEATURE_CONSENT_VERSION, 3);
  assert.equal(CURRENT_FEATURE_CONSENT.version, 3);
  assert.equal(hasCurrentFeatureConsent({ featureConsent: true, featureConsentVersion: 3 }), true);
  assert.equal(hasCurrentFeatureConsent({ featureConsent: true, featureConsentVersion: 2 }), false);
  assert.equal(hasCurrentFeatureConsent({ featureConsent: false, featureConsentVersion: 3 }), false);
});

test("version 3 covers the recap line after her turn on screen", () => {
  const all = JSON.stringify(FEATURE_CONSENT_COPY[3].mayShow);
  for (const s of ["Funded ✓", "Order placed ✓", "Delivered ✓", "rest of the event", "Only your first name and the status"]) {
    assert.ok(all.includes(s), `missing: ${s}`);
  }
});

test("version 3 says what the host sees, word for word", () => {
  const h = FEATURE_CONSENT_COPY[3].hostSees;
  assert.ok(h);
  assert.equal(`${h.lead} ${h.text}`,
    "The host also sees, on a separate host page: your first name, the items in each order we place for you, " +
    "the order total including tax, and the delivery status and date.");
  // No link, and nothing about whether the page is shown on stream.
  assert.doesNotMatch(`${h.lead} ${h.text}`, /link|tracking|stream|on screen|private|shown/i);
});

test("version 3 keeps version 2's other promises word for word", () => {
  const [v2, v3] = [FEATURE_CONSENT_COPY[2], FEATURE_CONSENT_COPY[3]];
  assert.deepEqual(v3.neverShow, v2.neverShow);
  assert.deepEqual(v3.changingMind, v2.changingMind);
  assert.deepEqual(v3.mayShow.slice(0, 4), v2.mayShow.slice(0, 4));
  for (const k of ["heading", "intro", "mayShowHeading", "yes", "no", "footer"] as const) assert.equal(v3[k], v2[k]);
});
