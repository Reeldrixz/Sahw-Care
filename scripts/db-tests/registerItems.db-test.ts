// Run by hand against a throwaway local UTF-8 Postgres with all migrations applied:
//   DATABASE_URL=postgresql://…@127.0.0.1:…/db DIRECT_URL=<same> JWT_SECRET=<16+ chars> npx tsx scripts/db-tests/registerItems.db-test.ts
//
// Locking a live register's items (lib/registerItemRules). Drives the real
// routes: items are added only to drafts; publishing is its own step (owner
// only, needs an item); the create flow (create, add one by one, publish)
// works and resumes after a failure; removal refuses anything with a payment
// row (drafts too) and, on a live register, anything reserved, being ordered,
// on screen in a live event, celebrated in one, or on a register that unlocked
// a bundle, each with its own message; a clean removal works; a draft can't
// be funded; admins are unchanged; live registers otherwise behave as before.
// Writes test rows, so it refuses any non-local or non-UTF-8 database.
import { NextRequest } from "next/server";
import { prisma } from "../../src/lib/prisma";
import { signToken } from "../../src/lib/auth";
import { REMOVAL_REFUSED, ADD_TO_LIVE_ERROR, PUBLISH_REFUSED } from "../../src/lib/registerItemRules";
import { POST as createRegister } from "../../src/app/api/registers/route";
import { POST as addItem } from "../../src/app/api/registers/[id]/items/route";
import { DELETE as removeItem, PATCH as editItem } from "../../src/app/api/registers/[id]/items/[itemId]/route";
import { POST as publish } from "../../src/app/api/registers/[id]/publish/route";
import { POST as fund } from "../../src/app/api/registers/[id]/items/[itemId]/fund/route";
import { PATCH as approve } from "../../src/app/api/admin/register-items/[itemId]/approve/route";

const dbUrl = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(dbUrl)) {
  console.error("Refusing to run: DATABASE_URL must point at a local throwaway Postgres (127.0.0.1 or localhost).");
  process.exit(1);
}
if (!process.env.JWT_SECRET) { console.error("Set JWT_SECRET."); process.exit(1); }
async function requireUtf8() {
  const [{ enc }] = await prisma.$queryRawUnsafe<{ enc: string }[]>(`SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = current_database()`);
  if (enc !== "UTF8") { console.error(`Refusing to run: the database encoding is ${enc}; it must be UTF8, like prod.`); process.exit(1); }
}

let fails = 0;
const check = (label: string, ok: boolean, detail = "") => { if (!ok) fails++; console.log(ok ? "pass" : "FAIL", label, detail); };
let n = 0;
const uid = () => `${Date.now()}-${n++}`;
const req = (method: string, body?: unknown, bearer?: string) => new NextRequest("http://localhost/x", {
  method, body: body === undefined ? undefined : JSON.stringify(body),
  headers: { "Content-Type": "application/json", "x-forwarded-for": `10.3.${n % 250}.${n++ % 250}`, ...(bearer && { Authorization: `Bearer ${bearer}` }) },
});
const p = <T extends Record<string, string>>(o: T) => ({ params: Promise.resolve(o) });

async function user(name: string, role: "RECIPIENT" | "DONOR" | "ADMIN" = "RECIPIENT") {
  const u = await prisma.user.create({ data: { name, email: `u${uid()}@t.test`, password: "x", role, manualReviewStatus: "APPROVED" } });
  return { u, token: await signToken({ userId: u.id, role, name }) };
}
const add = (registerId: string, token: string, body: Record<string, unknown> = { name: `Custom ${uid()}` }) =>
  addItem(req("POST", body, token), p({ id: registerId }));
const del = (registerId: string, itemId: string, token: string) => removeItem(req("DELETE", undefined, token), p({ id: registerId, itemId }));
const body = async (r: Response) => r.json().catch(() => ({}));
async function liveRegister(creatorId: string) {
  const r = await prisma.register.create({ data: { title: `Live ${uid()}`, city: "C", dueDate: new Date("2027-03-01"), creatorId, status: "ACTIVE" } });
  const item = await prisma.registerItem.create({ data: { name: "Diapers", registerId: r.id, standardPriceCents: 2000 } });
  return { r, item };
}

(async () => {
  await requireUtf8();
  const mom = await user("Amina Okafor");
  const other = await user("Bisi Other");
  const donor = await user("Dayo Donor", "DONOR");
  const admin = await user("Ada Admin", "ADMIN");
  const catalog = await prisma.itemCatalog.create({ data: { sku: `CRIB-${uid()}`, name: "Crib", category: "Sleep", standardPriceCents: 9000, isActive: true } });

  // ── Drafts: add freely; adding doesn't publish ───────────────────────────
  const created = await createRegister(req("POST", { title: "My list", city: "Toronto", dueDate: "2027-03-01" }, mom.token));
  const draftId = (await body(created)).register?.id as string;
  check("create: a new register is a draft", created.status === 201 && (await prisma.register.findUniqueOrThrow({ where: { id: draftId } })).status === "DRAFT");
  const a1 = await add(draftId, mom.token, { catalogItemId: catalog.id });
  check("draft add: ok", a1.status === 201);
  check("draft add: the register is still a draft (adding no longer publishes)", (await prisma.register.findUniqueOrThrow({ where: { id: draftId } })).status === "DRAFT");
  check("draft add: another user can't", (await add(draftId, other.token)).status === 403);

  // ── Publish ──────────────────────────────────────────────────────────────
  const empty = await prisma.register.create({ data: { title: "Empty", city: "C", dueDate: new Date("2027-03-01"), creatorId: mom.u.id } });
  const pubEmpty = await publish(req("POST", undefined, mom.token), p({ id: empty.id }));
  check("publish: refused with no items", pubEmpty.status === 400 && (await body(pubEmpty)).error === PUBLISH_REFUSED.NO_ITEMS);
  const cancelledOnly = await prisma.register.create({ data: { title: "Cancelled only", city: "C", dueDate: new Date("2027-03-01"), creatorId: mom.u.id } });
  await prisma.registerItem.create({ data: { name: "Gone", registerId: cancelledOnly.id, status: "CANCELLED" } });
  check("publish: a cancelled item doesn't count", (await publish(req("POST", undefined, mom.token), p({ id: cancelledOnly.id }))).status === 400);
  check("publish: owner only (another user)", (await publish(req("POST", undefined, other.token), p({ id: draftId }))).status === 403);
  check("publish: owner only (an admin)", (await publish(req("POST", undefined, admin.token), p({ id: draftId }))).status === 403);
  check("publish: signed out", (await publish(req("POST"), p({ id: draftId }))).status === 401);
  check("publish: still a draft after refusals", (await prisma.register.findUniqueOrThrow({ where: { id: draftId } })).status === "DRAFT");
  const pubOk = await publish(req("POST", undefined, mom.token), p({ id: draftId }));
  check("publish: the owner publishes a draft with an item", pubOk.status === 200 && (await prisma.register.findUniqueOrThrow({ where: { id: draftId } })).status === "ACTIVE");
  const again = await publish(req("POST", undefined, mom.token), p({ id: draftId }));
  check("publish: refused when already live", again.status === 400 && (await body(again)).error === PUBLISH_REFUSED.NOT_DRAFT);
  // A custom item still awaiting approval doesn't block publishing.
  const pendingOnly = await prisma.register.create({ data: { title: "Pending only", city: "C", dueDate: new Date("2027-03-01"), creatorId: mom.u.id } });
  const pa = await add(pendingOnly.id, mom.token, { name: "Special pram" });
  check("custom item goes in awaiting approval", (await body(pa)).item?.status === "PENDING_APPROVAL");
  check("publish: an item awaiting approval doesn't block it", (await publish(req("POST", undefined, mom.token), p({ id: pendingOnly.id }))).status === 200);

  // ── Live: adding refused ─────────────────────────────────────────────────
  const live = await add(draftId, mom.token, { catalogItemId: catalog.id });
  const liveB = await body(live);
  check("live add: refused with the clear message", live.status === 400 && liveB.error === ADD_TO_LIVE_ERROR && liveB.code === "REGISTER_LIVE", JSON.stringify(liveB));
  check("live add: nothing was added", (await prisma.registerItem.count({ where: { registerId: draftId } })) === 1);
  for (const status of ["COMPLETED", "CLOSED"] as const) {
    const r = await prisma.register.create({ data: { title: status, city: "C", dueDate: new Date("2027-03-01"), creatorId: mom.u.id, status } });
    check(`add to a ${status.toLowerCase()} register: refused`, (await add(r.id, mom.token)).status === 400);
  }

  // ── The create flow, end to end, with a failure and a retry ──────────────
  // As /registers/new does it: create, add one by one, publish.
  const flow = await body(await createRegister(req("POST", { title: "Flow", city: "Toronto", dueDate: "2027-03-01" }, mom.token)));
  const fid = flow.register.id as string;
  const plan: Record<string, unknown>[] = [{ catalogItemId: catalog.id }, { catalogItemId: "missing-catalog-id" }, { name: "Baby bath" }];
  let added = 0;
  for (; added < plan.length; added++) if ((await add(fid, mom.token, plan[added])).status !== 201) break;
  check("create flow: a failing item stops it", added === 1);
  check("create flow: after a failure the register stays a draft", (await prisma.register.findUniqueOrThrow({ where: { id: fid } })).status === "DRAFT");
  plan[1] = { catalogItemId: catalog.id };   // she fixes it and taps Try again: resume from item 2
  for (; added < plan.length; added++) if ((await add(fid, mom.token, plan[added])).status !== 201) break;
  const fpub = await publish(req("POST", undefined, mom.token), p({ id: fid }));
  check("create flow: retry resumes, then publishes", added === 3 && fpub.status === 200);
  check("create flow: every item in once, live", (await prisma.registerItem.count({ where: { registerId: fid } })) === 3
    && (await prisma.register.findUniqueOrThrow({ where: { id: fid } })).status === "ACTIVE");

  // ── Removal on a live register ───────────────────────────────────────────
  const refuse = async (label: string, code: keyof typeof REMOVAL_REFUSED, setup: (item: { id: string }, registerId: string) => Promise<unknown>) => {
    const { r, item } = await liveRegister(mom.u.id);
    await setup(item, r.id);
    const res = await del(r.id, item.id, mom.token);
    const b = await body(res);
    check(`live remove: ${label} → refused`, res.status === 400 && b.code === code && b.error === REMOVAL_REFUSED[code], JSON.stringify(b));
    check(`live remove: ${label} → nothing deleted`, !!(await prisma.registerItem.findUnique({ where: { id: item.id } })));
    return { r, item };
  };
  const pendingCase = await refuse("pending payment row", "PAYMENT_PENDING", (i) =>
    prisma.registerItemFunding.create({ data: { registerItemId: i.id, amountCents: 1000, status: "PENDING", guestEmail: "g@t.test", stripeSessionId: `cs_${uid()}` } }));
  check("live remove: the pending payment row is still there", (await prisma.registerItemFunding.count({ where: { registerItemId: pendingCase.item.id } })) === 1);
  await refuse("refunded row", "PAYMENT_RECORD", (i) =>
    prisma.registerItemFunding.create({ data: { registerItemId: i.id, amountCents: 1000, status: "REFUNDED", guestEmail: "g@t.test" } }));
  await refuse("contributions", "CONTRIBUTIONS", async (i) => {
    await prisma.registerItemFunding.create({ data: { registerItemId: i.id, amountCents: 1000, status: "CONFIRMED", guestEmail: "g@t.test" } });
    await prisma.registerItem.update({ where: { id: i.id }, data: { totalFundedCents: 1000, fundingStatus: "PARTIAL" } });
  });
  await refuse("reservation", "RESERVED", (i) => prisma.itemAssignment.create({ data: { itemId: i.id, donorId: donor.u.id } }));
  await refuse("queue row", "BEING_ORDERED", (i) => prisma.fulfillmentQueue.create({ data: { registerItemId: i.id, totalFundedCents: 0 } }));
  await refuse("item already on its way", "IN_PROGRESS", (i) => prisma.registerItem.update({ where: { id: i.id }, data: { status: "AWAITING_PURCHASE" } }));
  await refuse("on screen in a live event", "ON_SCREEN", (_i, rid) =>
    prisma.fundraisingEvent.create({ data: { title: "E", slug: `e-${uid()}`, hostName: "H", status: "LIVE", currentRegisterId: rid } }));
  await refuse("celebrated in a live event", "IN_LIVE_EVENT", async (i, rid) => {
    const ev = await prisma.fundraisingEvent.create({ data: { title: "E", slug: `e-${uid()}`, hostName: "H", status: "LIVE" } });
    await prisma.eventCelebration.create({ data: { eventId: ev.id, type: "ITEM_FUNDED", dedupeKey: `k-${uid()}`, registerId: rid, registerItemId: i.id } });
  });
  await refuse("unlocked bundle", "BUNDLE_UNLOCKED", async (_i, rid) => {
    const ev = await prisma.fundraisingEvent.create({ data: { title: "E", slug: `e-${uid()}`, hostName: "H", status: "ENDED" } });
    await prisma.eventBundleUnlock.create({ data: { eventId: ev.id, registerId: rid, valueCents: 20000, sponsorName: "Acme" } });
  });
  // An ended event doesn't block: on screen in an ENDED event, celebrated in an ENDED event.
  {
    const { r, item } = await liveRegister(mom.u.id);
    const ended = await prisma.fundraisingEvent.create({ data: { title: "E", slug: `e-${uid()}`, hostName: "H", status: "ENDED", currentRegisterId: r.id } });
    await prisma.eventCelebration.create({ data: { eventId: ended.id, type: "ITEM_FUNDED", dedupeKey: `k-${uid()}`, registerId: r.id, registerItemId: item.id } });
    check("live remove: an ended event doesn't block it", (await del(r.id, item.id, mom.token)).status === 200);
  }
  // Clean removal.
  {
    const { r, item } = await liveRegister(mom.u.id);
    const res = await del(r.id, item.id, mom.token);
    check("live remove: $0, nothing attached → removed", res.status === 200 && !(await prisma.registerItem.findUnique({ where: { id: item.id } })));
    check("live remove: another user can't", (await del(r.id, (await prisma.registerItem.create({ data: { name: "X", registerId: r.id } })).id, other.token)).status === 403);
  }
  // Two removals at once: one deletes, the other finds it gone.
  {
    const { r, item } = await liveRegister(mom.u.id);
    const both = await Promise.all([del(r.id, item.id, mom.token), del(r.id, item.id, mom.token)]);
    check("live remove: twice at once → one removes, one not found", both.map((x) => x.status).sort().join(",") === "200,404", both.map((x) => x.status).join(","));
  }

  // ── Removal on a draft: the payment-row rule still applies ───────────────
  {
    const d = await prisma.register.create({ data: { title: "Draft", city: "C", dueDate: new Date("2027-03-01"), creatorId: mom.u.id } });
    const withPending = await prisma.registerItem.create({ data: { name: "P", registerId: d.id } });
    await prisma.registerItemFunding.create({ data: { registerItemId: withPending.id, amountCents: 500, status: "PENDING", guestEmail: "g@t.test" } });
    const rp = await del(d.id, withPending.id, mom.token);
    check("draft remove: a pending payment row → refused", rp.status === 400 && (await body(rp)).code === "PAYMENT_PENDING");
    const plain = await prisma.registerItem.create({ data: { name: "Q", registerId: d.id } });
    check("draft remove: nothing attached → removed", (await del(d.id, plain.id, mom.token)).status === 200);
  }

  // ── A draft can't be funded ──────────────────────────────────────────────
  {
    const d = await prisma.register.create({ data: { title: "Draft", city: "C", dueDate: new Date("2027-03-01"), creatorId: mom.u.id } });
    const it = await prisma.registerItem.create({ data: { name: "P", registerId: d.id, standardPriceCents: 1000 } });
    const f = await fund(req("POST", { amountCents: 500 }, donor.token), p({ id: d.id, itemId: it.id }));
    check("fund: a draft's item can't be funded", f.status === 409 && (await prisma.registerItemFunding.count({ where: { registerItemId: it.id } })) === 0);
  }

  // ── Admins unchanged; live registers otherwise as before ─────────────────
  {
    const { r, item } = await liveRegister(mom.u.id);
    check("admin: still can't add through her route (as before)", (await add(r.id, admin.token)).status === 403);
    check("admin: still can't remove through her route (as before)", (await del(r.id, item.id, admin.token)).status === 403);
    const pend = await prisma.registerItem.create({ data: { name: "Needs approval", registerId: r.id, status: "PENDING_APPROVAL" } });
    const ap = await approve(req("PATCH", {}, admin.token), p({ itemId: pend.id }));
    check("admin: approving an item on a live register works", ap.status === 200 && (await prisma.registerItem.findUniqueOrThrow({ where: { id: pend.id } })).status === "AVAILABLE");
    const ed = await editItem(req("PATCH", { note: "size 2" }, mom.token), p({ id: r.id, itemId: item.id }));
    check("live: editing an item's details works as before", ed.status === 200 && (await prisma.registerItem.findUniqueOrThrow({ where: { id: item.id } })).note === "size 2");
  }

  console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILED`);
  await prisma.$disconnect();
  process.exit(fails === 0 ? 0 : 1);
})();
