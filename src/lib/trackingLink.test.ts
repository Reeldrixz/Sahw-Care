// Unit tests for lib/trackingLink. Run: npx tsx --test src/lib/trackingLink.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateTrackingUrl } from "./trackingLink";

const ok = (u: string) => assert.equal(validateTrackingUrl(u).ok, true, `expected accept: ${u}`);
const no = (u: unknown) => assert.equal(validateTrackingUrl(u).ok, false, `expected refuse: ${String(u)}`);

const SHARE = "/progress-tracker/package/share?_encoding=UTF8&itemId=abc&orderId=123&shipmentId=xyz";

test("a.co: accepted only when the path starts with /d/", () => {
  ok("https://a.co/d/0aBcDeF");
  ok("  https://a.co/d/0aBcDeF  ");
  ok("https://A.CO/d/0aBcDeF");
  no("https://a.co/");
  no("https://a.co/d/");
  no("https://a.co/x/0aBcDeF");
  no("https://a.co/D/0aBcDeF");
  no("https://a.co/dd/0aBcDeF");
});

test("amazon.ca: accepted only on the share path with giftView=1", () => {
  ok(`https://www.amazon.ca${SHARE}&giftView=1`);
  ok(`https://amazon.ca${SHARE}&giftView=1`);
  ok("https://www.amazon.ca/progress-tracker/package/share?giftView=1");
  no(`https://www.amazon.ca${SHARE}`);                   // no giftView
  no(`https://www.amazon.ca${SHARE}&giftView=0`);
  no(`https://www.amazon.ca${SHARE}&giftview=1`);        // param name is case-sensitive
  no("https://www.amazon.ca/progress-tracker/package?giftView=1");
  no("https://www.amazon.ca/progress-tracker/package/shared?giftView=1");
  no("https://www.amazon.ca/gp/your-account/order-details?orderID=123&giftView=1");
  no("https://www.amazon.ca/x/progress-tracker/package/share?giftView=1");
  no("https://www.amazon.ca/?q=/progress-tracker/package/share&giftView=1");
});

test("shapes don't cross hosts", () => {
  no("https://amazon.ca/d/0aBcDeF");
  no("https://a.co/progress-tracker/package/share?giftView=1");
  no(`https://www.amazon.com${SHARE}&giftView=1`);       // .com isn't on the list
  no(`https://smile.amazon.ca${SHARE}&giftView=1`);      // subdomains aren't matched
});

test("lookalike and look-through domains are refused", () => {
  no("https://a.co.evil.com/d/0aBcDeF");
  no("https://evil-a.co/d/0aBcDeF");
  no("https://xa.co/d/0aBcDeF");
  no("https://sub.a.co/d/0aBcDeF");
  no("https://a.com/d/0aBcDeF");
  no("https://a.co./d/0aBcDeF");                         // trailing dot
  no(`https://amazon.ca.evil.com${SHARE}&giftView=1`);
  no(`https://www.amazon.ca.evil.com${SHARE}&giftView=1`);
  no(`https://evilamazon.ca${SHARE}&giftView=1`);
  no(`https://amazon-ca.com${SHARE}&giftView=1`);
  no(`https://amazon.co${SHARE}&giftView=1`);
  no(`https://www.amaz0n.ca${SHARE}&giftView=1`);
  no(`https://www.аmazon.ca${SHARE}&giftView=1`);        // Cyrillic "а"
  no("https://а.co/d/0aBcDeF");                          // Cyrillic "а"
  no(`https://evil.com/?u=https://a.co/d/0aBcDeF`);
  no(`https://evil.com/a.co/d/0aBcDeF`);
});

test("credentials, ports and non-https schemes are refused", () => {
  no("https://a.co@evil.com/d/0aBcDeF");
  no("https://user:pass@a.co/d/0aBcDeF");
  no("https://a.co:8443/d/0aBcDeF");
  no("http://a.co/d/0aBcDeF");
  no(`http://www.amazon.ca${SHARE}&giftView=1`);
  no("javascript:alert(1)//a.co/d/x");
  no("data:text/html,https://a.co/d/x");
  no("//a.co/d/0aBcDeF");
  no("a.co/d/0aBcDeF");
});

test("raw carrier tracking pages are refused", () => {
  no("https://www.ups.com/track?tracknum=1Z999AA10123456784");
  no("https://tools.usps.com/go/TrackConfirmAction?tLabels=9400100000000000000000");
  no("https://www.fedex.com/fedextrack/?trknbr=123456789012");
  no("https://www.canadapost-postescanada.ca/track-reperage/en#/details/1234567890123456");
  no("https://track.amazon.ca/tracking/TBA123456789000");
});

test("empty, non-string and oversized input is refused", () => {
  no("");
  no("   ");
  no(undefined);
  no(null);
  no(42);
  no(`https://a.co/d/${"x".repeat(2100)}`);
});

test("the stored URL is the parsed, normalised form", () => {
  const r = validateTrackingUrl("HTTPS://A.CO/d/0aBcDeF");
  assert.deepEqual(r, { ok: true, url: "https://a.co/d/0aBcDeF" });
});
