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

test("version 3 says what the host sees, and only that the tracking page shows delivery progress", () => {
  const h = FEATURE_CONSENT_COPY[3].hostSees;
  assert.ok(h);
  for (const s of ["first name", "items in each order", "order total including tax", "estimated delivery date", "tracking page", "it shows delivery progress", "never to show this page"]) {
    assert.ok(h.text.includes(s) || h.lead.includes(s), `missing: ${s}`);
  }
  assert.doesNotMatch(h.text, /address|price|city|photo/i);
});

test("version 3 keeps version 2's other promises word for word", () => {
  const [v2, v3] = [FEATURE_CONSENT_COPY[2], FEATURE_CONSENT_COPY[3]];
  assert.deepEqual(v3.neverShow, v2.neverShow);
  assert.deepEqual(v3.changingMind, v2.changingMind);
  assert.deepEqual(v3.mayShow.slice(0, 4), v2.mayShow.slice(0, 4));
  for (const k of ["heading", "intro", "mayShowHeading", "yes", "no", "footer"] as const) assert.equal(v3[k], v2[k]);
});
