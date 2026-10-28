// Run by hand against a throwaway local UTF-8 Postgres (UTC) with all migrations applied:
//   DATABASE_URL=postgresql://…@127.0.0.1:…/db DIRECT_URL=<same> JWT_SECRET=<any 16+ chars> npx tsx scripts/db-tests/addressConfirm.db-test.ts
//
// The address-confirmation bug: confirming queued only the item in the URL.
// Drives the real confirm-address route: one confirmation must move EVERY
// funded item of hers that is awaiting an address, across all her registers,
// to Queued, and touch nothing else. Writes test rows, so it refuses any
// non-local or non-UTF-8 database.
import { NextRequest } from "next/server";
import { prisma } from "../../src/lib/prisma";
import { signToken } from "../../src/lib/auth";
import { POST as confirmAddress } from "../../src/app/api/registers/[id]/items/[itemId]/confirm-address/route";

const dbUrl = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(dbUrl)) {
  console.error("Refusing to run: DATABASE_URL must point at a local throwaway Postgres (127.0.0.1 or localhost).");
  process.exit(1);
}
async function requireUtf8() {
  const [{ enc }] = await prisma.$queryRawUnsafe<{ enc: string }[]>(`SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = current_database()`);
  if (enc !== "UTF8") { console.error(`Refusing to run: the database encoding is ${enc}; it must be UTF8, like prod.`); process.exit(1); }
}

let fails = 0;
const check = (label: string, ok: boolean, detail = "") => { if (!ok) fails++; console.log(ok ? "pass" : "FAIL", label, detail); };
let n = 0;
const uid = () => `${Date.now()}-${n++}`;

const address = { fullName: "Amina Bello", streetAddress: "12 Close", unit: "", city: "Toronto", province: "ON", postalCode: "M5V 1A1", phone: "+14165550100" };
const confirm = (registerId: string, itemId: string, token: string, body: Record<string, unknown> = address) =>
  confirmAddress(new NextRequest("http://localhost/x", {
    method: "POST", body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  }), { params: Promise.resolve({ id: registerId, itemId }) });

async function mother(name: string) {
  const u = await prisma.user.create({ data: { name, email: `m${uid()}@t.test`, password: "x", identityVerified: true } });
  return { u, token: await signToken({ userId: u.id, role: "MOTHER", name }) };
}
async function register(creatorId: string) {
  return prisma.register.create({ data: { title: `R ${uid()}`, city: "Toronto", dueDate: new Date(), creatorId, status: "ACTIVE", addressMode: "ASK_PER_SHIPMENT" } });
}
// A funded item waiting for an address, as the webhook leaves it.
const awaiting = (registerId: string, name: string, cents = 1000) => prisma.registerItem.create({ data: {
  name, registerId, standardPriceCents: cents, totalFundedCents: cents, fundingStatus: "FULLY_FUNDED", status: "AWAITING_ADDRESS",
} });

(async () => {
  await requireUtf8();
  if (!process.env.JWT_SECRET) { console.error("Set JWT_SECRET (any 16+ chars)."); process.exit(1); }

  // ── The bug: three items waiting across two registers ────────────────────
  const A = await mother("Amina Bello");
  const r1 = await register(A.u.id), r2 = await register(A.u.id);
  const a1 = await awaiting(r1.id, "Diapers"), a2 = await awaiting(r1.id, "Wipes"), a3 = await awaiting(r2.id, "Car seat", 9000);
  const notFunded = await prisma.registerItem.create({ data: { name: "Bottles", registerId: r1.id, standardPriceCents: 1500, totalFundedCents: 500, fundingStatus: "PARTIAL", status: "AVAILABLE" } });
  // An admin already entered an address for one item (admin shipment-address route).
  await prisma.shipmentAddress.create({ data: { registerItemId: a2.id, ...address, unit: null, streetAddress: "Old street" } });

  // Another mother's waiting item must not move.
  const B = await mother("Bisi Ade");
  const rb = await register(B.u.id);
  const b1 = await awaiting(rb.id, "Diapers");

  const res = await confirm(r1.id, a1.id, A.token);
  const body = await res.json();
  check("confirm: 200, three items", res.status === 200 && body.confirmedCount === 3, JSON.stringify(body));

  const items = await prisma.registerItem.findMany({
    where: { id: { in: [a1.id, a2.id, a3.id] } },
    include: { fulfillmentQueue: true, shipmentAddress: true },
  });
  check("every waiting item moved out of Awaiting address", items.every((i) => i.status === "AWAITING_PURCHASE" && i.fundingStatus === "IN_FULFILLMENT"),
    JSON.stringify(items.map((i) => [i.name, i.status])));
  check("every one queued, once", items.every((i) => i.fulfillmentQueue?.status === "QUEUED")
    && (await prisma.fulfillmentQueue.count({ where: { registerItemId: { in: [a1.id, a2.id, a3.id] } } })) === 3);
  check("queued with each item's funded amount", items.find((i) => i.id === a3.id)?.fulfillmentQueue?.totalFundedCents === 9000);
  check("each has the confirmed address (an earlier one is replaced)", items.every((i) => i.shipmentAddress?.streetAddress === "12 Close" && i.shipmentAddress.city === "Toronto"));
  check("the register in the URL and her other register both covered", new Set(items.map((i) => i.registerId)).size === 2);
  check("an unfunded item is untouched", (await prisma.registerItem.findUniqueOrThrow({ where: { id: notFunded.id } })).status === "AVAILABLE"
    && (await prisma.fulfillmentQueue.count({ where: { registerItemId: notFunded.id } })) === 0);
  check("another mother's item is untouched", (await prisma.registerItem.findUniqueOrThrow({ where: { id: b1.id } })).status === "AWAITING_ADDRESS"
    && (await prisma.shipmentAddress.count({ where: { registerItemId: b1.id } })) === 0);
  const notes = await prisma.notification.findMany({ where: { userId: A.u.id, type: "ITEM_FULLY_FUNDED" } });
  check("one notification naming all three", notes.length === 1 && /3 items/.test(notes[0].message)
    && ["Diapers", "Wipes", "Car seat"].every((nm) => notes[0].message.includes(nm)), notes.map((x) => x.message).join(" | "));

  check("confirming again: nothing left, 400", (await confirm(r1.id, a1.id, A.token)).status === 400);
  check("another mother can't confirm hers", (await confirm(rb.id, b1.id, A.token)).status === 403);

  // ── A single item still works ────────────────────────────────────────────
  const single = await confirm(rb.id, b1.id, B.token);
  check("single item: 200, one item", single.status === 200 && (await single.json()).confirmedCount === 1);
  check("single item: queued", (await prisma.fulfillmentQueue.findUnique({ where: { registerItemId: b1.id } }))?.status === "QUEUED");

  // ── Two confirmations at once queue each item once ───────────────────────
  const C = await mother("Chi Okeke");
  const rc = await register(C.u.id);
  const c = [await awaiting(rc.id, "A"), await awaiting(rc.id, "B")];
  const both = await Promise.all([confirm(rc.id, c[0].id, C.token), confirm(rc.id, c[1].id, C.token)]);
  check("race: one confirmation wins", both.filter((r) => r.status === 200).length === 1, both.map((r) => r.status).join(","));
  check("race: each item queued exactly once", (await prisma.fulfillmentQueue.count({ where: { registerItemId: { in: c.map((x) => x.id) } } })) === 2
    && (await prisma.registerItem.count({ where: { id: { in: c.map((x) => x.id) }, status: "AWAITING_PURCHASE" } })) === 2);

  // ── The identity gate still applies ──────────────────────────────────────
  const D = await mother("Dee Unverified");
  await prisma.user.update({ where: { id: D.u.id }, data: { identityVerified: false } });
  const rd = await register(D.u.id);
  const d1 = await awaiting(rd.id, "Diapers");
  check("unverified: refused, nothing moves", (await confirm(rd.id, d1.id, D.token)).status === 403
    && (await prisma.registerItem.findUniqueOrThrow({ where: { id: d1.id } })).status === "AWAITING_ADDRESS");
  check("missing field: refused", (await confirm(rd.id, d1.id, D.token, { ...address, phone: "" })).status === 400);

  console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILED`);
  await prisma.$disconnect();
  process.exit(fails === 0 ? 0 : 1);
})();
