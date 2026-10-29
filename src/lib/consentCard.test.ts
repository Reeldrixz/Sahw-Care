// Unit tests for lib/consentCard. Run: npx tsx --test src/lib/consentCard.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { consentButtons } from "./consentCard";

const every = [true, false].flatMap((consentCurrent) => [true, false].map((liveAddressReady) => ({ consentCurrent, liveAddressReady })));

test("No can be tapped in every state, address ready or not, consented or not", () => {
  for (const s of every) assert.equal(consentButtons({ saving: false, ...s }).noEnabled, true, JSON.stringify(s));
});

test("No waits only while a save is in flight", () => {
  for (const s of every) assert.equal(consentButtons({ saving: true, ...s }).noEnabled, false);
});

test("Yes needs a ready address and isn't repeated", () => {
  assert.equal(consentButtons({ saving: false, consentCurrent: false, liveAddressReady: true }).yesEnabled, true);
  assert.equal(consentButtons({ saving: false, consentCurrent: false, liveAddressReady: false }).yesEnabled, false);
  assert.equal(consentButtons({ saving: false, consentCurrent: true, liveAddressReady: true }).yesEnabled, false);
  assert.equal(consentButtons({ saving: false, consentCurrent: false, liveAddressReady: false }).showConfirmAddress, true);
});
