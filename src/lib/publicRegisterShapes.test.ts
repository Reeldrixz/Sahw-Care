// Unit tests for lib/publicRegisterShapes and lib/registerTitle.
// Run: npx tsx --test src/lib/publicRegisterShapes.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLiveTitle, LIVE_TITLE_MAX } from "./registerTitle";
import {
  toSearchRegister, toSearchItem, toSharePageRegister, toPublicRegisterView, toPublicListRegister, toSavedRegister,
  stageLine, browseDueLabel, isDueSoon, searchRegisterLabel,
} from "./publicRegisterShapes";
import type { PublicRegister } from "./registers";

const NOW = new Date("2026-10-29T12:00:00Z");
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000);
const keys = (o: object) => Object.keys(o).sort();

test("title check: passes a plain title, withholds surname, contact details and dates, trims to 32", () => {
  assert.equal(checkLiveTitle("baby things for March", "Amina Okafor"), "baby things for March");
  for (const t of ["Okafor twins", "call 416 555 0100", "me@x.com", "Due March 14", "14/3", "M5V 2T6", "<b>x</b>", "no shit"]) {
    assert.equal(checkLiveTitle(t, "Amina Okafor"), null, t);
  }
  const long = checkLiveTitle("everything we need for our new little one arriving soon", "Amina Okafor")!;
  assert.ok(long.endsWith("…") && Array.from(long).length <= LIVE_TITLE_MAX);
});

test("search: only id, first name, checked title and city", () => {
  const r = toSearchRegister({ id: "r1", title: "baby things for March", city: "Toronto", creator: { name: "Amina Okafor" } }, "baby")!;
  assert.deepEqual(r, { id: "r1", firstName: "Amina", title: "baby things for March", city: "Toronto", label: "Amina · baby things for March" });
});

test("search: a withheld title can't be matched on, so her surname finds nothing", () => {
  const row = { id: "r2", title: "Okafor twins", city: "Toronto", creator: { name: "Amina Okafor" } };
  assert.equal(toSearchRegister(row, "okafor"), null);
  // Found by city instead, with the title withheld.
  assert.deepEqual(toSearchRegister(row, "toron"), { id: "r2", firstName: "Amina", title: null, city: "Toronto", label: "Amina's Register" });
  // And by her first name, never her surname.
  assert.equal(toSearchRegister(row, "amina")?.label, "Amina's Register");
  assert.equal(toSearchRegister({ ...row, title: "baby list" }, "okafor"), null);
});

test("search label: first name and title, or her Register when the title is withheld", () => {
  assert.equal(searchRegisterLabel("Amina", "baby things for March"), "Amina · baby things for March");
  assert.equal(searchRegisterLabel("Amina", null), "Amina's Register");
  const withheld = toSearchRegister({ id: "r3", title: "text me 416 555 0100", city: "Lagos", creator: { name: "Amina Okafor" } }, "lagos")!;
  assert.equal(withheld.label, "Amina's Register");
  assert.doesNotMatch(JSON.stringify(withheld), /Okafor|416/);
});

test("search items: the donor by first name only", () => {
  const it = toSearchItem({ id: "i1", title: "Crib", category: "Sleep", condition: "Good", location: "Lagos", images: [], createdAt: NOW,
    donor: { name: "Bisi Adeyemi", verificationLevel: 2 }, ...({ donorId: "SECRET_ID", email: "SECRET@x.com" } as object) } as Parameters<typeof toSearchItem>[0]);
  assert.deepEqual(it.donor, { firstName: "Bisi", verified: true });
  assert.deepEqual(keys(it), ["category", "condition", "createdAt", "donor", "id", "images", "location", "title"]);
  assert.doesNotMatch(JSON.stringify(it), /Adeyemi|SECRET/);
  assert.equal(toSearchItem({ ...it, donor: { name: "Bisi Adeyemi", verificationLevel: 0 } } as Parameters<typeof toSearchItem>[0]).donor.verified, false);
});

test("share page: only the fields it renders", () => {
  const pub: PublicRegister = {
    id: "r1", title: "SECRET_TITLE", city: "Toronto", dueDate: inDays(40).toISOString(), status: "ACTIVE", intro: null,
    firstName: "Amina", verificationBadge: "NONE" as PublicRegister["verificationBadge"],
    items: [{ id: "i1", name: "Diapers", category: "Diapering", quantity: "1", note: "SECRET_NOTE", status: "AVAILABLE",
      standardPriceCents: 2000, totalFundedCents: 0, fundingStatus: "UNFUNDED", contributorCount: 0, imageUrl: null }],
  };
  const s = toSharePageRegister(pub, NOW);
  assert.deepEqual(keys(s), ["city", "firstName", "id", "intro", "items", "stageLine", "status", "verificationBadge"]);
  assert.deepEqual(keys(s.items[0]), ["category", "contributorCount", "fundingStatus", "id", "imageUrl", "name", "quantity", "standardPriceCents", "totalFundedCents"]);
  assert.equal(s.stageLine, "Due in 6 weeks");
  assert.doesNotMatch(JSON.stringify(s), /SECRET_TITLE|SECRET_NOTE|dueDate|2026-12/);
});

test("register view for non-owners: first name only, no due date, title, consent or address mode", () => {
  const row = {
    id: "r1", title: "SECRET_TITLE", city: "Toronto", dueDate: inDays(-14), intro: "hi", status: "ACTIVE",
    addressMode: "ASK_PER_SHIPMENT", featureConsent: true, featureConsentVersion: 2, creatorId: "u1",
    creator: { id: "u1", name: "Amina Okafor", location: "SECRET_LOCATION", verificationBadge: "NONE" as never },
    items: [
      { id: "i1", name: "Diapers", category: "Diapering", quantity: "1", status: "AVAILABLE", note: "SECRET_NOTE",
        standardPriceCents: 2000, totalFundedCents: 0, fundingStatus: "UNFUNDED", _count: { funding: 0 },
        catalogItem: { imageUrl: null, sku: "SECRET_SKU" }, assignment: { donor: { id: "d1", name: "SECRET_DONOR" } } },
      { id: "i2", name: "Pending", category: "x", quantity: "1", status: "PENDING_APPROVAL",
        standardPriceCents: 1, totalFundedCents: 0, fundingStatus: "UNFUNDED", _count: { funding: 0 }, catalogItem: null },
    ],
  };
  const v = toPublicRegisterView(row, NOW);
  assert.deepEqual(keys(v), ["city", "creator", "id", "intro", "items", "stageLine", "status"]);
  assert.deepEqual(v.creator, { id: "u1", name: "Amina", verificationBadge: "NONE" });
  assert.equal(v.items.length, 1);
  assert.equal(v.stageLine, "Newborn · 2 weeks old");
  assert.doesNotMatch(JSON.stringify(v), /SECRET|Okafor|dueDate|addressMode|featureConsent|PENDING_APPROVAL/);
});

test("browse list: no title or raw due date; the label and due-soon flag as the page showed them", () => {
  const row = {
    id: "r1", title: "SECRET_TITLE", city: "Toronto", dueDate: new Date("2026-12-14T00:00:00Z"), status: "ACTIVE",
    creator: { id: "u1", name: "Amina Okafor" },
    items: [{ id: "i1", name: "Diapers", quantity: "1", status: "AVAILABLE", fundingStatus: "UNFUNDED",
      standardPriceCents: 2000, totalFundedCents: 0, _count: { funding: 0 }, catalogItem: null }],
  };
  const l = toPublicListRegister(row, new Set(["i1"]), NOW);
  assert.deepEqual(keys(l), ["city", "creator", "dueLabel", "dueSoon", "id", "items"]);
  assert.deepEqual(l.creator, { firstName: "Amina" });
  assert.equal(l.dueLabel, "Due in 7 weeks");   // 46 days
  assert.equal(l.dueSoon, false);
  assert.equal(l.items[0].savedByMe, true);
  assert.doesNotMatch(JSON.stringify(l), /SECRET_TITLE|Okafor|2026-12-14/);
});

test("saved list: a rough due label and first name only", () => {
  const sv = toSavedRegister({ id: "r1", city: "Toronto", dueDate: new Date("2026-12-14T00:00:00Z"), creator: { name: "Amina Okafor" } }, NOW);
  assert.deepEqual(sv, { id: "r1", city: "Toronto", dueLabel: "Due in 7 weeks", creator: { firstName: "Amina" } });
});

test("derived date labels: rough only, never a day or a month", () => {
  const months = /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i;
  for (let d = -400; d <= 400; d += 1) {
    const l = browseDueLabel(inDays(d), NOW);
    assert.doesNotMatch(l, months, l);
    assert.doesNotMatch(stageLine(inDays(d), NOW), months);
  }
  assert.equal(stageLine(inDays(3), NOW), "Due this week");
  assert.equal(stageLine(inDays(30), NOW), "Due in 4 weeks");
  assert.equal(stageLine(inDays(-21), NOW), "Newborn · 3 weeks old");
  assert.equal(browseDueLabel(inDays(-21), NOW), "Newborn · 3w old");
  assert.equal(browseDueLabel(inDays(5), NOW), "Due soon");
  assert.equal(browseDueLabel(inDays(42), NOW), "Due soon");
  assert.equal(browseDueLabel(inDays(63), NOW), "Due in 9 weeks");
  assert.equal(isDueSoon(inDays(42), NOW), true);
  assert.equal(isDueSoon(inDays(43), NOW), false);
});
