// Run by hand against a throwaway local UTF-8 Postgres (UTC) with all migrations applied:
//   DATABASE_URL=postgresql://…@127.0.0.1:…/db DIRECT_URL=<same> JWT_SECRET=<16+ chars> CRON_SECRET=<any> \
//     STRIPE_SECRET_KEY=sk_test_dummy npx tsx scripts/db-tests/liveAddress.db-test.ts
//
// Address before live-feature consent (lib/liveAddress, lib/addressRedaction).
// Drives the real routes: consent refused without an address, the identity
// gap closed, the card's mode switch and its revert on withdrawal, a stale
// address dropping her out of the pool, the blanking rules, the address
// timeout following the item (not the register's mode), and a privacy sweep of every public
// and event response. Writes test rows, so it refuses any non-local or
// non-UTF-8 database.
import { NextRequest } from "next/server";
import { prisma } from "../../src/lib/prisma";
import { signToken } from "../../src/lib/auth";
import { FEATURE_CONSENT_VERSION } from "../../src/lib/featureConsent";
import { generateEventToken } from "../../src/lib/fundraisingEvent";
import { fetchFeaturableRegisters, isRegisterPickable, fetchOnScreenRegister, fetchPublicRegister } from "../../src/lib/registers";
import { buildOverlayFrame } from "../../src/lib/overlayFrame";
import { runAddressRedaction } from "../../src/lib/addressRedactionJob";
import { GET as getRegister, PATCH as patchRegister } from "../../src/app/api/registers/[id]/route";
import { GET as listRegisters, POST as createRegister } from "../../src/app/api/registers/route";
import { POST as liveAddress } from "../../src/app/api/registers/[id]/live-address/route";
import { POST as addressTimeout } from "../../src/app/api/cron/address-timeout/route";
import { POST as redactCron } from "../../src/app/api/cron/redact-addresses/route";
import { GET as hostDashboard } from "../../src/app/api/host/[token]/route";
import { GET as streamerOrders } from "../../src/app/api/host/[token]/orders/route";
import { POST as overlayFrame } from "../../src/app/api/overlay/[token]/frame/route";

const dbUrl = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(dbUrl)) {
  console.error("Refusing to run: DATABASE_URL must point at a local throwaway Postgres (127.0.0.1 or localhost).");
  process.exit(1);
}
for (const k of ["JWT_SECRET", "CRON_SECRET", "STRIPE_SECRET_KEY"]) {
  if (!process.env[k]) { console.error(`Set ${k}.`); process.exit(1); }
}
async function requireUtf8() {
  const [{ enc }] = await prisma.$queryRawUnsafe<{ enc: string }[]>(`SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = current_database()`);
  if (enc !== "UTF8") { console.error(`Refusing to run: the database encoding is ${enc}; it must be UTF8, like prod.`); process.exit(1); }
}

let fails = 0;
const check = (label: string, ok: boolean, detail = "") => { if (!ok) fails++; console.log(ok ? "pass" : "FAIL", label, detail); };
let n = 0;
const uid = () => `${Date.now()}-${n++}`;
const DAY = 86_400_000;

// Every address string written, for the privacy sweep.
const secrets: string[] = [];
const addressFor = (tag: string) => {
  const a = {
    fullName: `Full ${tag} Surname`, streetAddress: `${100 + n} Secretstreet ${tag}`, unit: `Unit ${tag}Q`,
    city: `Cityville${tag}`, province: "ON", postalCode: `Z${n % 10}Z ${tag}X9`, phone: `+1416555${String(1000 + n).slice(-4)}`,
  };
  secrets.push(a.streetAddress, a.unit, a.city, a.postalCode, a.phone, `Full ${tag} Surname`);
  return a;
};

const req = (method: string, body?: unknown, bearer?: string, headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/x", {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "Content-Type": "application/json", "x-forwarded-for": `10.1.${n % 250}.${n++ % 250}`, ...(bearer && { Authorization: `Bearer ${bearer}` }), ...headers },
  });
const p = <T extends Record<string, string>>(o: T) => ({ params: Promise.resolve(o) });

async function mother(name: string, verified = true) {
  const u = await prisma.user.create({ data: { name, email: `m${uid()}@t.test`, password: "x", identityVerified: verified, manualReviewStatus: "APPROVED", role: "RECIPIENT" } });
  secrets.push(u.email!);
  return { u, token: await signToken({ userId: u.id, role: "RECIPIENT", name }) };
}
async function askRegister(creatorId: string, prices = [5000, 5000]) {
  const r = await prisma.register.create({ data: { title: `R ${uid()}`, city: "Somewhere", dueDate: new Date(), creatorId, status: "ACTIVE" } });
  const items = [];
  for (const c of prices) items.push(await prisma.registerItem.create({ data: { name: `Item ${items.length}`, registerId: r.id, standardPriceCents: c } }));
  return { r, items };
}
const consent = (id: string, token: string, value: boolean) => patchRegister(req("PATCH", { featureConsent: value }, token), p({ id }));
const confirmLive = (id: string, token: string, a: Record<string, unknown>) => liveAddress(req("POST", a, token), p({ id }));
const inPool = async (id: string) => (await fetchFeaturableRegisters()).some((r) => r.id === id);
const reg = (id: string) => prisma.register.findUniqueOrThrow({ where: { id }, include: { savedAddress: true } });
// A funded item queued for fulfilment, as the webhook leaves it in saved mode.
const fundAndQueue = async (itemId: string, cents = 5000) => {
  await prisma.registerItem.update({ where: { id: itemId }, data: { totalFundedCents: cents, fundingStatus: "IN_FULFILLMENT", status: "AWAITING_PURCHASE" } });
  return prisma.fulfillmentQueue.create({ data: { registerItemId: itemId, totalFundedCents: cents, status: "QUEUED" } });
};
const deliver = async (itemId: string, at: Date) => {
  await prisma.fulfillmentQueue.update({ where: { registerItemId: itemId }, data: { status: "DELIVERED", deliveredAt: at } });
  await prisma.registerItem.update({ where: { id: itemId }, data: { status: "FULFILLED", fundingStatus: "FULFILLED" } });
};
const setConfirmedAt = (registerId: string, at: Date) => prisma.registerAddress.update({ where: { registerId }, data: { confirmedAt: at } });

(async () => {
  await requireUtf8();

  // ── 1. Consent refused without an address ────────────────────────────────
  const A = await mother("Amina Bello");
  const RA = await askRegister(A.u.id);
  const refused = await consent(RA.r.id, A.token, true);
  const refusedBody = await refused.json();
  check("consent: yes refused without an address", refused.status === 400 && refusedBody.code === "NEEDS_LIVE_ADDRESS" && refusedBody.reason === "NO_ADDRESS", JSON.stringify(refusedBody));
  check("consent: nothing recorded", (await reg(RA.r.id)).featureConsent === false);
  const own = await (await getRegister(req("GET", undefined, A.token), p({ id: RA.r.id }))).json();
  check("card: told no address yet", own.liveAddress?.ready === false && own.liveAddress.reason === "NO_ADDRESS");

  // ── 2. The identity gap closed ───────────────────────────────────────────
  const U = await mother("Uche Unverified", false);
  const savedBody = (a: Record<string, unknown>) => ({ title: `Saved ${uid()}`, city: "C", dueDate: "2027-01-01", addressMode: "SAVED_PER_REGISTER", savedAddress: a });
  const cr = await createRegister(req("POST", savedBody(addressFor("unv")), U.token));
  check("identity: saved-address register refused for an unverified mother", cr.status === 403 && (await cr.json()).code === "NEEDS_IDENTITY_VERIFICATION");
  check("identity: and nothing created", (await prisma.register.count({ where: { creatorId: U.u.id } })) === 0
    && (await prisma.registerAddress.count({ where: { register: { creatorId: U.u.id } } })) === 0);
  const crAsk = await createRegister(req("POST", { title: "Ask", city: "C", dueDate: "2027-01-01" }, U.token));
  check("identity: ask-per-shipment still allowed (checked later, at confirm)", crAsk.status === 201);
  const askId = (await crAsk.json()).register.id;
  const lu = await confirmLive(askId, U.token, addressFor("unv2"));
  check("identity: card address refused for an unverified mother", lu.status === 403 && (await lu.json()).code === "NEEDS_IDENTITY_VERIFICATION");
  check("identity: no address saved, mode unchanged", !(await reg(askId)).savedAddress && (await reg(askId)).addressMode === "ASK_PER_SHIPMENT");

  const S = await mother("Sade Saved");
  const crS = await createRegister(req("POST", savedBody(addressFor("sav")), S.token));
  const sId = crS.status === 201 ? (await crS.json()).register.id as string : "";
  check("identity: verified mother creates a saved-address register", crS.status === 201);
  const sReg = await reg(sId);
  check("saved at creation: confirmedAt stamped, not marked as switched by the card", !!sReg.savedAddress?.confirmedAt && sReg.liveAddressSwitchedAt === null);

  // ── 3. The card's mode switch ────────────────────────────────────────────
  const live = await confirmLive(RA.r.id, A.token, addressFor("amina"));
  const liveBody = await live.json();
  check("switch: card address saved", live.status === 200 && liveBody.switched === true, JSON.stringify(liveBody));
  check("switch: response carries no address", !secrets.some((s) => JSON.stringify(liveBody).includes(s)));
  let ra = await reg(RA.r.id);
  check("switch: now saved-address mode, remembered as switched by the card", ra.addressMode === "SAVED_PER_REGISTER" && !!ra.liveAddressSwitchedAt
    && !!ra.savedAddress?.confirmedAt && ra.savedAddress.redactedAt === null);
  check("switch: consent now accepted", (await consent(RA.r.id, A.token, true)).status === 200
    && (await reg(RA.r.id)).featureConsentVersion === FEATURE_CONSENT_VERSION);
  check("pool: she is pickable", await inPool(RA.r.id) && await isRegisterPickable(RA.r.id));

  // A mother who doesn't consent keeps her option: nothing changes for her.
  const K = await mother("Kemi Keeps");
  const RK = await askRegister(K.u.id);
  check("no consent: her ask-per-shipment register is untouched", (await reg(RK.r.id)).addressMode === "ASK_PER_SHIPMENT" && !(await reg(RK.r.id)).savedAddress);

  // ── 4. A stale address drops her out of the pool ─────────────────────────
  await setConfirmedAt(RA.r.id, new Date(Date.now() - 91 * DAY));
  check("stale: out of the pool, not pickable", !(await inPool(RA.r.id)) && !(await isRegisterPickable(RA.r.id)));
  check("stale: her consent stays", (await reg(RA.r.id)).featureConsent === true);
  const ownStale = await (await getRegister(req("GET", undefined, A.token), p({ id: RA.r.id }))).json();
  check("stale: card told to confirm again", ownStale.liveAddress?.ready === false && ownStale.liveAddress.reason === "STALE_ADDRESS");
  check("stale: a new yes is refused too", (await (await consent(RA.r.id, A.token, true)).json()).reason === "STALE_ADDRESS");
  await setConfirmedAt(RA.r.id, new Date(Date.now() - 89 * DAY));
  check("89 days: still pickable", await inPool(RA.r.id));
  check("re-confirm: back in the pool", (await confirmLive(RA.r.id, A.token, addressFor("amina2"))).status === 200 && await inPool(RA.r.id));
  check("re-confirm: not a second switch", (await (await confirmLive(RA.r.id, A.token, addressFor("amina3"))).json()).switched === false);

  // Identity lost after consenting: out of the pool too.
  await prisma.user.update({ where: { id: A.u.id }, data: { accountHold: true } });
  check("identity lost: out of the pool", !(await inPool(RA.r.id)) && !(await isRegisterPickable(RA.r.id)));
  await prisma.user.update({ where: { id: A.u.id }, data: { accountHold: false } });
  // A blanked address: out of the pool.
  await prisma.registerAddress.update({ where: { registerId: RA.r.id }, data: { redactedAt: new Date() } });
  check("blanked address: out of the pool", !(await inPool(RA.r.id)));
  await confirmLive(RA.r.id, A.token, addressFor("amina4"));
  check("confirming again clears the blank", (await reg(RA.r.id)).savedAddress?.redactedAt === null && await inPool(RA.r.id));

  // ── 5. Withdrawal reverts the card's switch ──────────────────────────────
  const w1 = await consent(RA.r.id, A.token, false);
  const w1b = await w1.json();
  ra = await reg(RA.r.id);
  check("withdraw, nothing waiting: back to ask-per-shipment, address deleted", w1.status === 200 && w1b.liveAddressReverted === true
    && ra.addressMode === "ASK_PER_SHIPMENT" && !ra.savedAddress && ra.liveAddressSwitchedAt === null, JSON.stringify({ w1b, mode: ra.addressMode }));
  check("withdraw: no audit snapshot (nothing was ever shipped to it)", (await prisma.addressAuditSnapshot.count({ where: { registerId: RA.r.id } })) === 0);

  // Withdrawing with a funded item still waiting: stays until it ships.
  const B = await mother("Bisi Ade");
  const RB = await askRegister(B.u.id);
  await confirmLive(RB.r.id, B.token, addressFor("bisi"));
  await consent(RB.r.id, B.token, true);
  await fundAndQueue(RB.items[0].id);
  const w2 = await (await consent(RB.r.id, B.token, false)).json();
  let rb = await reg(RB.r.id);
  check("withdraw, item waiting: stays in saved mode with its address", w2.liveAddressReverted === false && rb.addressMode === "SAVED_PER_REGISTER"
    && !!rb.savedAddress && rb.savedAddress.redactedAt === null && !!rb.liveAddressSwitchedAt);
  check("withdraw, item waiting: revert marked pending", !!rb.liveAddressRevertPendingAt);
  // Saying yes again before it ran cancels the pending revert.
  await consent(RB.r.id, B.token, true);
  check("re-consent: pending revert cancelled", (await reg(RB.r.id)).liveAddressRevertPendingAt === null);
  await consent(RB.r.id, B.token, false);
  check("withdraw again: pending again", !!(await reg(RB.r.id)).liveAddressRevertPendingAt);
  await runAddressRedaction(new Date());
  check("job, item still waiting: nothing reverted or blanked", (await reg(RB.r.id)).addressMode === "SAVED_PER_REGISTER" && (await reg(RB.r.id)).savedAddress?.redactedAt === null);
  await deliver(RB.items[0].id, new Date());
  const jr = await runAddressRedaction(new Date());
  rb = await reg(RB.r.id);
  check("job, once delivered: reverted and the address deleted", jr.counts.liveReverted === 1 && rb.addressMode === "ASK_PER_SHIPMENT" && !rb.savedAddress
    && rb.liveAddressSwitchedAt === null && rb.liveAddressRevertPendingAt === null, JSON.stringify(jr.counts));
  check("revert after shipping: audit snapshot kept", (await prisma.addressAuditSnapshot.count({ where: { registerId: RB.r.id } })) === 1);

  // A mother in saved mode before the card stays in it.
  check("saved by her own choice: consent accepted", (await consent(sId, S.token, true)).status === 200);
  await consent(sId, S.token, false);
  const sAfter = await reg(sId);
  check("saved by her own choice: withdrawing keeps saved mode and the address", sAfter.addressMode === "SAVED_PER_REGISTER" && !!sAfter.savedAddress && sAfter.savedAddress.redactedAt === null);
  await runAddressRedaction(new Date());
  check("saved by her own choice: the job doesn't revert it either", (await reg(sId)).addressMode === "SAVED_PER_REGISTER");

  // ── 6. Blanking ──────────────────────────────────────────────────────────
  const now = new Date();
  // One delivered item and one waiting: kept.
  const C = await mother("Chi Okeke");
  const RC = await askRegister(C.u.id, [5000, 5000]);
  await confirmLive(RC.r.id, C.token, addressFor("chi"));
  await fundAndQueue(RC.items[0].id); await fundAndQueue(RC.items[1].id);
  await deliver(RC.items[0].id, new Date(now.getTime() - 3 * DAY));
  // Nothing funded, confirmed 91 days ago: blanked. 30 days ago: kept.
  const D = await mother("Dayo Old");
  const RD = await askRegister(D.u.id);
  await confirmLive(RD.r.id, D.token, addressFor("dayo"));
  await setConfirmedAt(RD.r.id, new Date(now.getTime() - 91 * DAY));
  const E = await mother("Efe Recent");
  const RE = await askRegister(E.u.id);
  await confirmLive(RE.r.id, E.token, addressFor("efe"));
  await setConfirmedAt(RE.r.id, new Date(now.getTime() - 30 * DAY));
  // Every funded item delivered 2 days ago: blanked.
  const F = await mother("Funke Done");
  const RF = await askRegister(F.u.id, [5000, 5000]);
  await confirmLive(RF.r.id, F.token, addressFor("funke"));
  await fundAndQueue(RF.items[0].id); await deliver(RF.items[0].id, new Date(now.getTime() - 2 * DAY));
  // Closed with an item waiting: kept. Closed with nothing waiting: blanked.
  const G = await mother("Gbemi Closed");
  const RG = await askRegister(G.u.id);
  await confirmLive(RG.r.id, G.token, addressFor("gbemi"));
  await fundAndQueue(RG.items[0].id);
  await prisma.register.update({ where: { id: RG.r.id }, data: { status: "CLOSED", closedAt: new Date(now.getTime() - 5 * DAY) } });
  const H = await mother("Halima Closed");
  const RH = await askRegister(H.u.id);
  await confirmLive(RH.r.id, H.token, addressFor("halima"));
  await prisma.register.update({ where: { id: RH.r.id }, data: { status: "CLOSED", closedAt: new Date(now.getTime() - 2 * DAY) } });
  const J = await mother("Jumoke Own");
  const jRes = await createRegister(req("POST", savedBody(addressFor("jumoke")), J.token));
  const jId = (await jRes.json()).register.id as string;
  await setConfirmedAt(jId, new Date(now.getTime() - 91 * DAY));
  // Per-item address, item delivered 2 days ago: blanked, as before.
  const I = await mother("Ife PerItem");
  const RI = await askRegister(I.u.id);
  await prisma.registerItem.update({ where: { id: RI.items[0].id }, data: { status: "FULFILLED", fundingStatus: "FULFILLED", totalFundedCents: 5000 } });
  const iAddr = addressFor("ife");
  await prisma.shipmentAddress.create({ data: { registerItemId: RI.items[0].id, ...iAddr } });
  await prisma.$executeRaw`UPDATE "RegisterItem" SET "updatedAt" = ${new Date(now.getTime() - 2 * DAY)} WHERE "id" = ${RI.items[0].id}`;

  const cronRes = await redactCron(req("POST", undefined, undefined, { authorization: `Bearer ${process.env.CRON_SECRET}` }));
  const cron = await cronRes.json();
  check("cron route runs the job", cronRes.status === 200 && cron.ok === true, JSON.stringify(cron));
  // Gone = blanked, or blanked and then deleted by the revert (registers the
  // card switched whose mother never said yes, once their address is blanked).
  const blanked = async (id: string) => { const a = await prisma.registerAddress.findUnique({ where: { registerId: id } }); return !a || a.redactedAt !== null; };
  const kept = async (id: string) => { const a = await prisma.registerAddress.findUnique({ where: { registerId: id } }); return !!a && a.redactedAt === null; };
  check("blank: one delivered and one waiting → kept", await kept(RC.r.id));
  check("blank: nothing funded, confirmed 91 days ago → blanked", await blanked(RD.r.id));
  check("blank: nothing funded, confirmed 30 days ago → kept", await kept(RE.r.id));
  check("mid-flow: confirmed on the card, not said yes yet, address intact → left in saved mode", (await reg(RE.r.id)).addressMode === "SAVED_PER_REGISTER" && !!(await reg(RE.r.id)).liveAddressSwitchedAt);
  check("never said yes, address blanked after 90 days → back to ask-per-shipment", (await reg(RD.r.id)).addressMode === "ASK_PER_SHIPMENT" && !(await reg(RD.r.id)).savedAddress);
  check("blank: every funded item delivered 2 days ago → blanked", await blanked(RF.r.id));
  check("blank: closed with an item waiting → kept", await kept(RG.r.id));
  check("blank: closed 2 days ago, nothing waiting → blanked", await blanked(RH.r.id));
  check("blank: per-item address 24h after delivery → blanked", (await prisma.shipmentAddress.findUniqueOrThrow({ where: { registerItemId: RI.items[0].id } })).redactedAt !== null);
  const blankRow = await prisma.registerAddress.findUniqueOrThrow({ where: { registerId: jId } });
  check("blank: personal fields cleared", blankRow.streetAddress === "[REDACTED]" && blankRow.phone === "[REDACTED]" && blankRow.postalCode === "" && blankRow.unit === null);
  check("blank: saved by her own choice, nothing funded, 91 days → blanked, row kept, still saved mode", blankRow.redactedAt !== null && (await reg(jId)).addressMode === "SAVED_PER_REGISTER");
  check("blank: an audit snapshot each", (await prisma.addressAuditSnapshot.count({ where: { registerId: { in: [RD.r.id, RF.r.id, RH.r.id, jId] } } })) === 4);
  check("blank: idempotent", (await runAddressRedaction(new Date())).counts.savedRedacted === 0);
  // The waiting one blanks only once its last item is delivered (and 24h on).
  await deliver(RC.items[1].id, new Date(now.getTime() - 25 * 3_600_000));
  await runAddressRedaction(new Date());
  check("blank: the register with one waiting, once that item is delivered → blanked", await blanked(RC.r.id));

  // ── 7. The address timeout follows the item, not the register's mode ─────
  // Both sweeps pick items WAITING FOR AN ADDRESS. A newly funded item on a
  // saved-address register whose saved address was blanked waits for one like
  // any ask-per-shipment item: reminder at 7 days, refund at 14. An item
  // already queued with an address is never touched.
  const T = await mother("Tolu Timeout");
  const askT = await askRegister(T.u.id, [3000, 3000]);
  const savedT = await createRegister(req("POST", savedBody(addressFor("tolu")), T.token));
  const savedTId = (await savedT.json()).register.id as string;
  // Her saved address has been blanked (e.g. every earlier item delivered).
  await prisma.registerAddress.update({ where: { registerId: savedTId }, data: {
    fullName: "[REDACTED]", streetAddress: "[REDACTED]", unit: null, postalCode: "", phone: "[REDACTED]", redactedAt: new Date(Date.now() - 20 * DAY),
  } });
  // Newly funded, as the webhook leaves it when the saved address is blanked.
  const waitingFunded = (registerId: string, name: string) => prisma.registerItem.create({ data: {
    name, registerId, standardPriceCents: 3000, totalFundedCents: 3000, fundingStatus: "FULLY_FUNDED", status: "AWAITING_ADDRESS",
  } });
  const saved8 = await waitingFunded(savedTId, "Saved eight");
  const saved15 = await waitingFunded(savedTId, "Saved fifteen");
  // Already queued with an address, 15 days ago: never touched.
  const savedQueued = await prisma.registerItem.create({ data: {
    name: "Saved queued", registerId: savedTId, standardPriceCents: 3000, totalFundedCents: 3000, fundingStatus: "IN_FULFILLMENT", status: "AWAITING_PURCHASE",
  } });
  await prisma.fulfillmentQueue.create({ data: { registerItemId: savedQueued.id, totalFundedCents: 3000, status: "QUEUED" } });
  await prisma.registerItem.update({ where: { id: askT.items[0].id }, data: { name: "Ask fifteen", totalFundedCents: 3000, fundingStatus: "FULLY_FUNDED", status: "AWAITING_ADDRESS" } });
  await prisma.registerItem.update({ where: { id: askT.items[1].id }, data: { name: "Ask eight", totalFundedCents: 3000, fundingStatus: "FULLY_FUNDED", status: "AWAITING_ADDRESS" } });
  const d8 = new Date(Date.now() - 8 * DAY), d15 = new Date(Date.now() - 15 * DAY);
  await prisma.$executeRaw`UPDATE "RegisterItem" SET "updatedAt" = ${d8} WHERE "id" IN (${saved8.id}, ${askT.items[1].id})`;
  await prisma.$executeRaw`UPDATE "RegisterItem" SET "updatedAt" = ${d15} WHERE "id" IN (${saved15.id}, ${savedQueued.id}, ${askT.items[0].id})`;

  const toRes = await addressTimeout(req("POST", undefined, undefined, { authorization: `Bearer ${process.env.CRON_SECRET}` }));
  const to = await toRes.json();
  check("timeout: sweeps ran", toRes.status === 200 && to.reminders === 2 && to.cancelled === 2, JSON.stringify(to));
  const statusOf = async (id: string) => (await prisma.registerItem.findUniqueOrThrow({ where: { id } })).status;
  const notes = (type: "ADDRESS_REMINDER" | "ADDRESS_TIMEOUT_CANCELLED", name: string) => prisma.notification.count({ where: { userId: T.u.id, type, message: { contains: name } } });
  check("timeout: saved register, blanked address, 15 days → refunded and removed", await statusOf(saved15.id) === "CANCELLED"
    && await notes("ADDRESS_TIMEOUT_CANCELLED", "Saved fifteen") === 1);
  check("timeout: saved register, blanked address, 8 days → reminded, still waiting", await statusOf(saved8.id) === "AWAITING_ADDRESS"
    && await notes("ADDRESS_REMINDER", "Saved eight") === 1);
  check("timeout: ask-per-shipment, 15 days → refunded and removed", await statusOf(askT.items[0].id) === "CANCELLED"
    && await notes("ADDRESS_TIMEOUT_CANCELLED", "Ask fifteen") === 1);
  check("timeout: ask-per-shipment, 8 days → reminded", await statusOf(askT.items[1].id) === "AWAITING_ADDRESS"
    && await notes("ADDRESS_REMINDER", "Ask eight") === 1);
  check("timeout: an item already queued with an address is never touched", await statusOf(savedQueued.id) === "AWAITING_PURCHASE"
    && (await prisma.fulfillmentQueue.findUniqueOrThrow({ where: { registerItemId: savedQueued.id } })).status === "QUEUED"
    && await notes("ADDRESS_REMINDER", "Saved queued") === 0 && await notes("ADDRESS_TIMEOUT_CANCELLED", "Saved queued") === 0);
  // Every queued item elsewhere in this test (sections 5 and 6) is untouched too.
  check("timeout: no queued item anywhere was cancelled", (await prisma.registerItem.count({ where: { status: "CANCELLED", fulfillmentQueue: { isNot: null } } })) === 0);

  // ── 8. Privacy sweep ─────────────────────────────────────────────────────
  // A featured register with a fresh address, on screen in a live event.
  const P = await mother("Pelumi Privacy");
  const RP = await askRegister(P.u.id, [5000, 5000, 5000, 5000]);   // 1 of 4 funded: 25%, under the 30% pick rule
  await confirmLive(RP.r.id, P.token, addressFor("pelumi"));
  await consent(RP.r.id, P.token, true);
  await fundAndQueue(RP.items[2].id, 5000);
  const token = generateEventToken();
  const ev = await prisma.fundraisingEvent.create({ data: { title: "E", slug: `e-${uid()}`, hostName: "H", status: "LIVE", accessToken: token, currentRegisterId: RP.r.id } });
  await prisma.eventRegisterCompletion.create({ data: { eventId: ev.id, registerId: RP.r.id } });
  check("privacy: the featured register is in the pool", await inPool(RP.r.id));

  const stranger = await mother("Stranger Donor");
  const responses: [string, string][] = [
    ["pool (event page)", JSON.stringify(await fetchFeaturableRegisters())],
    ["on screen (event page, overlay)", JSON.stringify(await fetchOnScreenRegister(RP.r.id))],
    ["public share page /r", JSON.stringify(await fetchPublicRegister(RP.r.id))],
    ["overlay frame (built)", JSON.stringify(await buildOverlayFrame(ev.id, { claim: false }))],
    ["overlay frame route", await (await overlayFrame(req("POST", {}), p({ token }))).text()],
    ["host dashboard", await (await hostDashboard(req("GET"), p({ token }))).text()],
    ["streamer orders page", await (await streamerOrders(req("GET"), p({ token }))).text()],
    ["register, anonymous", await (await getRegister(req("GET"), p({ id: RP.r.id }))).text()],
    ["register, another user", await (await getRegister(req("GET", undefined, stranger.token), p({ id: RP.r.id }))).text()],
    ["register, her own", await (await getRegister(req("GET", undefined, P.token), p({ id: RP.r.id }))).text()],
    ["register list", await (await listRegisters(new NextRequest(`http://localhost/api/registers?creatorId=${P.u.id}`))).text()],
    ["consent save", await (await consent(RP.r.id, P.token, true)).text()],
    ["card address step", await (await confirmLive(RP.r.id, P.token, addressFor("pelumi2"))).text()],
  ];
  // The sweep is only meaningful on real responses: each must carry her
  // register (her first name), not an error.
  for (const [where, text] of responses.slice(0, 11)) {
    check(`privacy: ${where} is a real response with her register`, text.includes("Pelumi") && !/"error"/.test(text), text.slice(0, 120));
  }
  for (const [where, text] of responses) {
    const leaked = secrets.filter((s) => text.includes(s));
    check(`privacy: no address in ${where}`, leaked.length === 0, leaked.join(" | "));
    check(`privacy: no address fields in ${where}`, !/"(streetAddress|postalCode|savedAddress|shipmentAddress|fullName)"/.test(text), where);
  }

  console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILED`);
  await prisma.$disconnect();
  process.exit(fails === 0 ? 0 : 1);
})();
