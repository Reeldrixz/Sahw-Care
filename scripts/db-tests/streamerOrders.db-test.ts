// Run by hand against a throwaway local UTF-8 Postgres (UTC) with all migrations applied:
//   DATABASE_URL=postgresql://…@127.0.0.1:…/db JWT_SECRET=<any 16+ chars> npx tsx scripts/db-tests/streamerOrders.db-test.ts
//
// Step 9: fulfilment evidence. Drives the real route handlers: Record order
// and its refusals, purchases without a tracking link (Funded on air at every
// stage), edits recording who and when, the host-only difference line,
// deleting a register or user (never blocked; the order stays without her),
// and the streamer route. That route's
// response must never contain the order number or any admin field, even with
// all of them stored. Writes test rows, so it refuses any non-local or
// non-UTF-8 database.
import { NextRequest } from "next/server";
import { prisma } from "../../src/lib/prisma";
import { FEATURE_CONSENT_VERSION } from "../../src/lib/featureConsent";
import { signToken } from "../../src/lib/auth";
import { withStripeEvent, recordPayment } from "../../src/lib/stripeLedger";
import { buildOverlayFrame } from "../../src/lib/overlayFrame";
import { generateEventToken } from "../../src/lib/fundraisingEvent";
import { POST as recordOrder } from "../../src/app/api/admin/fulfillment-orders/route";
import { PATCH as editOrder } from "../../src/app/api/admin/fulfillment-orders/[id]/route";
import { PATCH as setStatus } from "../../src/app/api/admin/fulfillment-queue/[id]/route";
import { GET as streamerOrders } from "../../src/app/api/host/[token]/orders/route";
import { GET as hostDashboard } from "../../src/app/api/host/[token]/route";
import { DELETE as deleteRegister } from "../../src/app/api/registers/[id]/route";
import { DELETE as deleteUser } from "../../src/app/api/admin/users/[id]/route";

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
const secrets: string[] = [];

const req = (url: string, method: string, body?: unknown, bearer?: string) => new NextRequest(`http://localhost${url}`, {
  method, body: body === undefined ? undefined : JSON.stringify(body),
  headers: { "Content-Type": "application/json", ...(bearer && { Authorization: `Bearer ${bearer}` }), "x-forwarded-for": `10.0.${n % 250}.${n++ % 250}` },
});
const p = <T extends Record<string, string>>(o: T) => ({ params: Promise.resolve(o) });

async function register(motherName: string, prices: number[]) {
  const mom = await prisma.user.create({ data: { name: motherName, email: `m${uid()}@t.test`, phone: `+1555${String(n).padStart(7, "0")}`, password: "x" } });
  const r = await prisma.register.create({ data: {
    title: `SECRET_TITLE ${uid()}`, city: "Ikeja", dueDate: new Date(), creatorId: mom.id, status: "ACTIVE",
    featureConsent: true, featureConsentAt: new Date(), featureConsentVersion: FEATURE_CONSENT_VERSION,
  } });
  await prisma.registerAddress.create({ data: { registerId: r.id, fullName: motherName, streetAddress: "12 Secret Close", city: "Ikeja", province: "LA", postalCode: "SECRET1", phone: "+15550009999" } });
  const items = [];
  for (const price of prices) items.push(await prisma.registerItem.create({ data: { name: `Item ${items.length}`, registerId: r.id, standardPriceCents: price } }));
  secrets.push(mom.id, r.id, ...items.map((i) => i.id), motherName.split(" ").slice(1).join(" "), r.title, mom.email!, mom.phone!, "Ikeja", "12 Secret Close", "SECRET1");
  return { mom, r, items };
}
async function pay(itemId: string, eventId: string, cents: number) {
  const f = await prisma.registerItemFunding.create({ data: {
    registerItemId: itemId, amountCents: cents, status: "PENDING", fundraisingEventId: eventId, guestEmail: `g${uid()}@t.test`,
  } });
  await withStripeEvent(`evt_${uid()}`, "checkout.session.completed", (tx) =>
    recordPayment(tx, f.id, `pi_${f.id}`, { showNameConsent: false, displayName: null }));
}
const enqueue = async (itemId: string) => {
  const q = await prisma.fulfillmentQueue.upsert({ where: { registerItemId: itemId }, create: { registerItemId: itemId, totalFundedCents: 1000 }, update: {} });
  secrets.push(q.id);
  return q;
};

const ORDER_NUMBER = "702-5551234-9876543";
const EDITED_NUMBER = "702-0000000-1111111";
const soon = new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10);
const link = "https://a.co/d/0aBcDeF";

(async () => {
  await requireUtf8();
  if (!process.env.JWT_SECRET) { console.error("Set JWT_SECRET (any 16+ chars) for the admin token."); process.exit(1); }

  const adminUser = await prisma.user.create({ data: { name: "Ada Admin", email: `a${uid()}@t.test`, password: "x", role: "ADMIN" } });
  const admin = await signToken({ userId: adminUser.id, role: "ADMIN", name: "Ada Admin" });
  secrets.push(adminUser.id, "Ada Admin");

  const A = await register("Maryam Okafor", [1000, 2000, 3000]);
  const B = await register("Zoë Lindqvist", [1500]);
  const C = await register("Chioma Eze", [1000, 1000]);   // bought without tracking links
  const token = generateEventToken();
  const ev = await prisma.fundraisingEvent.create({ data: { title: "E", slug: `e-${uid()}`, hostName: "H", status: "LIVE", accessToken: token, currentRegisterId: A.r.id } });
  secrets.push(ev.id, ev.slug);

  // Completions count only for the register on screen.
  const onScreen = (id: string) => prisma.fundraisingEvent.update({ where: { id: ev.id }, data: { currentRegisterId: id } });
  for (const [i, it] of A.items.entries()) await pay(it.id, ev.id, [1000, 2000, 3000][i]);
  await onScreen(B.r.id); await pay(B.items[0].id, ev.id, 1500);
  await onScreen(C.r.id); for (const it of C.items) await pay(it.id, ev.id, 1000);
  await onScreen(A.r.id);
  const qA = await Promise.all(A.items.map((i) => enqueue(i.id)));
  const [qB] = await Promise.all(B.items.map((i) => enqueue(i.id)));
  const qC = await Promise.all(C.items.map((i) => enqueue(i.id)));

  // ── Record order: refusals ───────────────────────────────────────────────
  const rec = (body: Record<string, unknown>, who = admin) => recordOrder(req("/api/admin/fulfillment-orders", "POST", body, who));
  const base = { total: "62.15", tax: "7.15", trackingUrl: link, estimatedDeliveryOn: soon, orderNumber: ORDER_NUMBER };
  check("record: no admin → 403", (await rec({ queueIds: [qA[0].id], ...base }, "nope")).status === 403);
  check("record: carrier link refused", (await rec({ queueIds: [qA[0].id], ...base, trackingUrl: "https://www.ups.com/track?tracknum=1Z" })).status === 400);
  check("record: amazon.ca without giftView refused", (await rec({ queueIds: [qA[0].id], ...base, trackingUrl: "https://www.amazon.ca/progress-tracker/package/share?itemId=1" })).status === 400);
  check("record: lookalike refused", (await rec({ queueIds: [qA[0].id], ...base, trackingUrl: "https://a.co.evil.com/d/x" })).status === 400);
  check("record: two registers refused", (await rec({ queueIds: [qA[0].id, qB.id], ...base })).status === 400);
  check("record: missing total refused", (await rec({ queueIds: [qA[0].id], ...base, total: "" })).status === 400);
  check("record: tax over total refused", (await rec({ queueIds: [qA[0].id], ...base, tax: "62.16" })).status === 400);
  check("nothing recorded by refusals", (await prisma.fulfillmentOrder.count()) === 0);

  const status = (id: string, body: Record<string, unknown>) => setStatus(req("", "PATCH", body, admin), p({ id }));
  check("status: QUEUED → DELIVERED refused", (await status(qA[0].id, { status: "DELIVERED" })).status === 400);
  check("status: QUEUED → DISPATCHED refused", (await status(qA[0].id, { status: "DISPATCHED" })).status === 400);

  // ── Purchased with no tracking link: note required, Funded on air ────────
  check("no link: note required", (await status(qC[0].id, { status: "PURCHASED" })).status === 400
    && (await status(qC[0].id, { status: "PURCHASED", notes: "   " })).status === 400);
  check("no link: with a note", (await status(qC[0].id, { status: "PURCHASED", notes: "Bought in store, SECRET_NOTE" })).status === 200);
  const c0 = await prisma.fulfillmentQueue.findUniqueOrThrow({ where: { id: qC[0].id } });
  check("no link: purchased, no order, note kept", c0.status === "PURCHASED" && c0.orderId === null && !!c0.purchasedAt && c0.notes?.startsWith("Bought in store") === true);
  check("no link: mother notified", (await prisma.notification.count({ where: { userId: C.mom.id, type: "ITEM_PURCHASED" } })) === 1);
  check("no link: purchased twice refused", (await status(qC[0].id, { status: "PURCHASED", notes: "again" })).status === 400);

  await onScreen(C.r.id);
  const cStates = async () => (await buildOverlayFrame(ev.id, { claim: false }))!.register!.items.map((i) => i.state).join(",");
  const neverOrdered: string[] = [];
  neverOrdered.push(await cStates());
  check("no link: purchased reads Funded on the overlay", neverOrdered[0] === "FUNDED,FUNDED", neverOrdered[0]);
  const hc0 = (await (await hostDashboard(req("/x", "GET"), p({ token }))).json()).completions.find((c: { firstName: string }) => c.firstName === "Chioma");
  check("host: told it was bought without a tracking link", hc0?.items[0].noTrackingLink === true && hc0.items[0].stage === "FUNDED" && hc0.items[1].noTrackingLink === false,
    JSON.stringify(hc0?.items));
  check("no link: dispatched works", (await status(qC[0].id, { status: "DISPATCHED", trackingRef: "REF1" })).status === 200);
  neverOrdered.push(await cStates());
  check("no link: dispatched still reads Funded", neverOrdered[1] === "FUNDED,FUNDED", neverOrdered[1]);
  check("no link: delivered from dispatched works", (await status(qC[0].id, { status: "DELIVERED" })).status === 200);
  check("no link: second item purchased", (await status(qC[1].id, { status: "PURCHASED", notes: "Bought locally" })).status === 200);
  check("no link: delivered straight from purchased works", (await status(qC[1].id, { status: "DELIVERED" })).status === 200);
  neverOrdered.push(await cStates());
  check("no link: never Order placed at any stage", neverOrdered.every((s) => !s.includes("ORDERED")), neverOrdered.join(" | "));
  check("no link: delivered still reads Funded on the overlay", neverOrdered[2] === "FUNDED,FUNDED", neverOrdered[2]);
  const hcd = (await (await hostDashboard(req("/x", "GET"), p({ token }))).json()).completions.find((c: { firstName: string }) => c.firstName === "Chioma");
  check("host: no-link items shown as delivered", hcd?.items.every((i: { noTrackingLink: boolean; delivered: boolean; stage: string }) => i.noTrackingLink && i.delivered && i.stage === "FUNDED")
    && hcd.status === "FUNDED", JSON.stringify(hcd?.items));
  await onScreen(A.r.id);

  // ── Record order: success ────────────────────────────────────────────────
  const ok = await rec({ queueIds: [qA[0].id, qA[1].id], ...base, purchasedFrom: "SECRET_SUPPLIER", notes: "SECRET_NOTE" });
  const okBody = await ok.json();
  check("record: two items of one register", ok.status === 200, JSON.stringify(okBody));
  const order = await prisma.fulfillmentOrder.findFirstOrThrow({ include: { items: true } });
  secrets.push(order.id);
  check("order stored with number, total and tax", order.orderNumber === ORDER_NUMBER && order.totalCents === 6215 && order.taxCents === 715
    && order.createdById === adminUser.id && order.updatedById === null);
  check("items purchased, order attached", order.items.length === 2 && order.items.every((i) => i.status === "PURCHASED" && i.purchasedAt));
  check("mother notified per item", (await prisma.notification.count({ where: { userId: A.mom.id, type: "ITEM_PURCHASED" } })) === 2);
  check("record: already ordered items refused", (await rec({ queueIds: [qA[0].id], ...base })).status === 400);

  // Two admins ordering the same item at once: one order, not two. No tax recorded on this one.
  const race = await Promise.all([1, 2].map(() => rec({ queueIds: [qA[2].id], ...base, tax: "" })));
  check("race: one of two concurrent orders wins", race.filter((r) => r.status === 200).length === 1 && (await prisma.fulfillmentOrder.count()) === 2,
    race.map((r) => r.status).join(","));

  const fa = (await buildOverlayFrame(ev.id, { claim: false }))!;
  check("overlay: ordered items read Order placed", fa.register?.items.every((i) => i.state === "ORDERED") === true);

  // ── Edit: every edit records who and when ────────────────────────────────
  const editor = await prisma.user.create({ data: { name: "Eve Editor", email: `e${uid()}@t.test`, password: "x", role: "ADMIN" } });
  const editorToken = await signToken({ userId: editor.id, role: "ADMIN", name: "Eve Editor" });
  secrets.push(editor.id, "Eve Editor");
  const edit = (body: Record<string, unknown>, who = editorToken) => editOrder(req("", "PATCH", body, who), p({ id: order.id }));
  const before = (await prisma.fulfillmentOrder.findUniqueOrThrow({ where: { id: order.id } })).updatedAt;
  await new Promise((r) => setTimeout(r, 20));
  check("edit: carrier link refused", (await edit({ trackingUrl: "https://www.fedex.com/x" })).status === 400);
  check("edit: tax over the stored total refused", (await edit({ tax: "62.16" })).status === 400);
  check("edit: total below the stored tax refused", (await edit({ total: "7.14" })).status === 400);
  check("edit: order number", (await edit({ orderNumber: EDITED_NUMBER })).status === 200);
  const edited = await prisma.fulfillmentOrder.findUniqueOrThrow({ where: { id: order.id } });
  check("edit: number saved, updatedById and updatedAt set", edited.orderNumber === EDITED_NUMBER && edited.updatedById === editor.id
    && edited.updatedAt.getTime() > before.getTime() && edited.createdById === adminUser.id);
  check("edit: tax cleared to not recorded", (await edit({ tax: "" }, admin)).status === 200
    && (await prisma.fulfillmentOrder.findUniqueOrThrow({ where: { id: order.id } })).taxCents === null
    && (await prisma.fulfillmentOrder.findUniqueOrThrow({ where: { id: order.id } })).updatedById === adminUser.id);
  check("edit: tax set again", (await edit({ tax: "7.15" })).status === 200);

  // ── Delivered: from Purchased; once only ─────────────────────────────────
  const del = await Promise.all([1, 2].map(() => status(qA[0].id, { status: "DELIVERED" })));
  check("delivered: double click delivers once", del.filter((r) => r.status === 200).length === 1, del.map((r) => r.status).join(","));

  // ── Host dashboard: the difference, host side only ───────────────────────
  const hostRes = await (await hostDashboard(req("/x", "GET"), p({ token }))).json();
  const hm = hostRes.completions.find((c: { firstName: string }) => c.firstName === "Maryam");
  // Order 1 covers $10 + $20 funded = $30.00; total $62.15 → +$32.15, past max($5, $4.50).
  check("host: difference line, neutral wording, highlighted", hm?.orders?.[0]?.text === "Funded for these items: $30.00 · Order total $62.15 · Difference +$32.15"
    && hm.orders[0].highlight === true, JSON.stringify(hm?.orders));
  const hc = hostRes.completions.find((c: { firstName: string }) => c.firstName === "Chioma");
  check("host: no difference line without an order", hc?.orders.length === 0, JSON.stringify(hc));
  check("host: no order id in the dashboard payload", !JSON.stringify(hostRes).includes(order.id));
  const overlayText = JSON.stringify(await buildOverlayFrame(ev.id, { claim: false }));
  check("overlay: no difference, total or tax", !/Difference|Funded for these items|6215|62\.15|715/.test(overlayText));

  // ── The streamer route ───────────────────────────────────────────────────
  check("streamer: bad token → 404", (await streamerOrders(req("/x", "GET"), p({ token: generateEventToken() }))).status === 404);
  const res = await streamerOrders(req("/x", "GET"), p({ token }));
  const text = await res.text();
  const body = JSON.parse(text);
  check("streamer: 200", res.status === 200);
  check("streamer: no-referrer, no-store", res.headers.get("referrer-policy") === "no-referrer" && res.headers.get("cache-control") === "no-store");
  const leaked = [ORDER_NUMBER, EDITED_NUMBER, "SECRET_SUPPLIER", "SECRET_NOTE", "REF1", "Bought in store", ...secrets].filter((s) => s && text.includes(s));
  check("streamer: no order number, editor, id, surname, title, address, contact or note", leaked.length === 0, leaked.join(" | "));
  check("streamer: no difference line", !/Difference|Funded for these items|highlight/.test(text));
  const keys = new Set<string>();
  JSON.parse(text, (k, v) => { if (k && Number.isNaN(Number(k))) keys.add(k); return v; });
  check("streamer: only the page's fields", JSON.stringify([...keys].sort()) === JSON.stringify(
    ["estimatedDelivery", "fetchedAt", "firstName", "fundedNoRecord", "items", "orders", "registers", "status", "taxCents", "title", "totalCents", "trackingUrl"]),
    [...keys].sort().join(","));
  const byName = (n: string) => body.registers.find((r: { firstName: string }) => r.firstName === n);
  const a = byName("Maryam");
  check("streamer: Maryam's two orders, tax on the first only", a?.orders.length === 2
    && a.orders[0].items.join() === "Item 0,Item 1" && a.orders[0].totalCents === 6215 && a.orders[0].taxCents === 715
    && a.orders[1].taxCents === null && a.orders[0].trackingUrl === link
    && a.orders[0].estimatedDelivery === soon && a.orders[0].status === "ORDERED", JSON.stringify(a));
  check("streamer: Zoë funded, no order record", byName("Zoë")?.orders.length === 0 && byName("Zoë")?.fundedNoRecord.join() === "Item 0", JSON.stringify(byName("Zoë")));
  check("streamer: Chioma's no-link purchases read Funded only", byName("Chioma")?.orders.length === 0
    && byName("Chioma")?.fundedNoRecord.join() === "Item 0,Item 1", JSON.stringify(byName("Chioma")));

  await prisma.register.update({ where: { id: B.r.id }, data: { featureConsent: false, featureConsentAt: null, featureConsentVersion: null } });
  const after = await (await streamerOrders(req("/x", "GET"), p({ token }))).json();
  check("streamer: withdrawn consent drops her", after.registers.length === 2 && !after.registers.some((r: { firstName: string }) => r.firstName === "Zoë"));

  // ── Deleting is never blocked; the order stays without her ───────────────
  const trail = await prisma.fulfillmentOrder.findMany({ where: { registerId: A.r.id }, orderBy: { createdAt: "asc" } });
  const momToken = await signToken({ userId: A.mom.id, role: "MOTHER", name: "Maryam Okafor" });
  const dr = await deleteRegister(req("", "DELETE", undefined, momToken), p({ id: A.r.id }));
  check("delete register with orders: allowed", dr.status === 200, String(dr.status));
  const kept = await prisma.fulfillmentOrder.findMany({ where: { id: { in: [order.id] } }, include: { items: true } });
  check("order kept, no longer pointing at her", kept.length === 1 && kept[0].registerId === null && kept[0].items.length === 0
    && kept[0].totalCents === 6215 && kept[0].orderNumber === null && kept[0].trackingUrl === null);
  check("both of her orders kept", (await prisma.fulfillmentOrder.count({ where: { registerId: null } })) === 2);
  const afterDel = await prisma.fulfillmentOrder.findMany({ where: { id: { in: trail.map((o) => o.id) } }, orderBy: { createdAt: "asc" } });
  check("delete: tracking link and order number cleared", afterDel.length === 2 && afterDel.every((o) => o.trackingUrl === null && o.orderNumber === null),
    JSON.stringify(afterDel.map((o) => [o.trackingUrl, o.orderNumber])));
  check("delete: totals, tax, dates and the edit trail kept", afterDel.every((o, i) =>
    o.totalCents === trail[i].totalCents && o.taxCents === trail[i].taxCents
    && o.estimatedDeliveryOn.getTime() === trail[i].estimatedDeliveryOn.getTime()
    && o.createdAt.getTime() === trail[i].createdAt.getTime() && o.updatedAt.getTime() === trail[i].updatedAt.getTime()
    && o.createdById === trail[i].createdById && o.updatedById === trail[i].updatedById)
    && afterDel[0].updatedById === editor.id && afterDel[0].taxCents === 715);
  const orphanText = JSON.stringify(afterDel);
  check("delete: nothing in the kept orders points back at her", ![A.r.id, A.mom.id, link, ORDER_NUMBER, EDITED_NUMBER].some((x) => orphanText.includes(x)));
  const gone = await (await streamerOrders(req("/x", "GET"), p({ token }))).json();
  check("streamer: her register is gone from the page", !gone.registers.some((r: { firstName: string }) => r.firstName === "Maryam"), JSON.stringify(gone));

  check("record: Zoë's order", (await rec({ queueIds: [qB.id], ...base, total: "15.00", tax: "", orderNumber: "702-ZOE" })).status === 200);
  const zoeOrderId = (await prisma.fulfillmentOrder.findFirstOrThrow({ where: { registerId: B.r.id } })).id;
  const zoeBefore = await prisma.fulfillmentOrder.findUniqueOrThrow({ where: { id: zoeOrderId } });
  const du = await deleteUser(req("", "DELETE", undefined, admin), p({ id: B.mom.id }));
  check("delete user with an order: allowed", du.status === 200, String(du.status));
  check("her order kept without her", (await prisma.fulfillmentOrder.count({ where: { registerId: null } })) === 3
    && !(await prisma.register.findUnique({ where: { id: B.r.id } })));
  const zoeAfter = await prisma.fulfillmentOrder.findUniqueOrThrow({ where: { id: zoeOrderId } });
  check("user delete: link and number cleared, total and trail kept", zoeAfter.trackingUrl === null && zoeAfter.orderNumber === null
    && zoeAfter.totalCents === 1500 && zoeAfter.updatedAt.getTime() === zoeBefore.updatedAt.getTime() && zoeAfter.createdById === adminUser.id);
  // Chioma's register has no orders: deleting her is unaffected.
  check("user delete without orders: allowed", (await deleteUser(req("", "DELETE", undefined, admin), p({ id: C.mom.id }))).status === 200);

  console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILED`);
  await prisma.$disconnect();
  process.exit(fails === 0 ? 0 : 1);
})();
