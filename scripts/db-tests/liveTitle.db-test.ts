// Run by hand against a throwaway local UTF-8 Postgres (UTC) with all migrations applied:
//   DATABASE_URL=postgresql://…@127.0.0.1:…/db DIRECT_URL=<same> JWT_SECRET=<16+ chars> npx tsx scripts/db-tests/liveTitle.db-test.ts
//
// The register's title next to her first name on every live surface: the
// overlay strip and recap, the host dashboard (pool, on screen, "Fully funded
// this event"), the streamer's orders page and the public event page's data.
// Title shown when it passes; a failing title falls back to first name only;
// a long title is trimmed; no title at all without her current consent. And
// "No" on the consent card works when her address isn't ready. Drives the
// real routes. Writes test rows, so it refuses any non-local or non-UTF-8
// database.
import { NextRequest } from "next/server";
import { prisma } from "../../src/lib/prisma";
import { signToken } from "../../src/lib/auth";
import { FEATURE_CONSENT_VERSION } from "../../src/lib/featureConsent";
import { generateEventToken } from "../../src/lib/fundraisingEvent";
import { fetchFeaturableRegisters, fetchOnScreenRegister } from "../../src/lib/registers";
import { recapText, LIVE_TITLE_MAX } from "../../src/lib/publicCelebration";
import { PATCH as patchRegister } from "../../src/app/api/registers/[id]/route";
import { POST as liveAddress } from "../../src/app/api/registers/[id]/live-address/route";
import { GET as hostDashboard } from "../../src/app/api/host/[token]/route";
import { GET as streamerOrders } from "../../src/app/api/host/[token]/orders/route";
import { POST as overlayFrame } from "../../src/app/api/overlay/[token]/frame/route";

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
  headers: { "Content-Type": "application/json", "x-forwarded-for": `10.2.${n % 250}.${n++ % 250}`, ...(bearer && { Authorization: `Bearer ${bearer}` }) },
});
const p = <T extends Record<string, string>>(o: T) => ({ params: Promise.resolve(o) });
const address = { fullName: "A B", streetAddress: "1 Test St", unit: "", city: "Toronto", province: "ON", postalCode: "M5V 1A1", phone: "+14165550100" };

async function mother(name: string) {
  const u = await prisma.user.create({ data: { name, email: `m${uid()}@t.test`, password: "x", identityVerified: true, manualReviewStatus: "APPROVED" } });
  return { u, token: await signToken({ userId: u.id, role: "RECIPIENT", name }) };
}
async function register(creatorId: string, title: string, prices = [5000, 5000, 5000, 5000]) {
  const r = await prisma.register.create({ data: { title, city: "Lagos", dueDate: new Date("2027-03-14"), creatorId, status: "ACTIVE" } });
  for (const [i, c] of prices.entries()) await prisma.registerItem.create({ data: { name: `Item ${i}`, registerId: r.id, standardPriceCents: c } });
  return r;
}
// Consent the way she gives it: address on the card, then yes.
async function consentLive(id: string, token: string) {
  const a = await liveAddress(req("POST", address, token), p({ id }));
  const c = await patchRegister(req("PATCH", { featureConsent: true }, token), p({ id }));
  if (a.status !== 200 || c.status !== 200) throw new Error(`consent failed ${a.status} ${c.status}`);
}

(async () => {
  await requireUtf8();
  const GOOD = "baby things for March";
  const LONG = "everything we need for our new little one arriving soon";

  const idris = await mother("Idris Okafor");
  const rI = await register(idris.u.id, GOOD);
  const bisi = await mother("Bisi Adeyemi");
  const rB = await register(bisi.u.id, "Adeyemi family list");          // her surname → fails
  const chi = await mother("Chi Eze");
  const rC = await register(chi.u.id, LONG);
  const dayo = await mother("Dayo Bello");
  const rD = await register(dayo.u.id, "text me 416 555 0100");          // contact details → fails
  const emeka = await mother("Emeka Nwosu");
  const rE = await register(emeka.u.id, GOOD);                           // never consents
  for (const [r, m] of [[rI, idris], [rB, bisi], [rC, chi], [rD, dayo]] as const) await consentLive(r.id, m.token);

  // ── The pool and the public event page's data ────────────────────────────
  const pool = await fetchFeaturableRegisters();
  const inPool = (id: string) => pool.find((r) => r.id === id);
  check("pool: title shown", inPool(rI.id)?.title === GOOD, JSON.stringify(inPool(rI.id)?.title));
  check("pool: surname title → first name only", inPool(rB.id)?.title === null && inPool(rB.id)?.firstName === "Bisi");
  check("pool: contact-detail title → first name only", inPool(rD.id)?.title === null);
  const trimmed = inPool(rC.id)?.title ?? "";
  check("pool: long title trimmed with an ellipsis", trimmed.endsWith("…") && Array.from(trimmed).length <= LIVE_TITLE_MAX && LONG.startsWith(trimmed.slice(0, -1)), trimmed);
  check("pool: no consent, not there at all", !inPool(rE.id));
  check("pool: no raw title anywhere", !JSON.stringify(pool).includes("Adeyemi family") && !JSON.stringify(pool).includes("416 555"));

  // ── A live event: Idris on screen, Bisi and Chi completed earlier ────────
  const token = generateEventToken();
  const ev = await prisma.fundraisingEvent.create({ data: { title: "E", slug: `e-${uid()}`, hostName: "H", status: "LIVE", accessToken: token, currentRegisterId: rI.id } });
  for (const r of [rB, rC, rI]) await prisma.eventRegisterCompletion.create({ data: { eventId: ev.id, registerId: r.id } });
  // Fund their items so the recap has a true status to show.
  await prisma.registerItem.updateMany({ where: { registerId: { in: [rB.id, rC.id] } }, data: { totalFundedCents: 5000, fundingStatus: "FULLY_FUNDED" } });

  const frame = await (await overlayFrame(req("POST", {}), p({ token }))).json();
  check("overlay strip: first name and title", frame.register?.firstName === "Idris" && frame.register?.title === GOOD, JSON.stringify(frame.register && { f: frame.register.firstName, t: frame.register.title }));
  const recap = (frame.recap.entries as { firstName: string; title: string | null; status: "FUNDED" }[]).map(recapText);
  check("overlay recap: failing title falls back to first name only", recap.includes("Bisi — Funded ✓"), JSON.stringify(recap));
  check("overlay recap: long title trimmed", recap.some((l) => l.startsWith(`Chi · ${trimmed} —`)), JSON.stringify(recap));
  check("overlay: no raw or surname title", !JSON.stringify(frame).includes("Adeyemi") && !JSON.stringify(frame).includes(LONG));

  const host = await (await hostDashboard(req("GET"), p({ token }))).json();
  check("host: on-screen register shows the title", host.onScreen?.title === GOOD);
  const hc = (name: string) => host.completions.find((c: { firstName: string }) => c.firstName === name);
  check("host 'Fully funded this event': title, fallback, trimmed", hc("Idris")?.title === GOOD && hc("Bisi")?.title === null && hc("Chi")?.title === trimmed,
    JSON.stringify(host.completions.map((c: { firstName: string; title: string | null }) => [c.firstName, c.title])));
  check("host: no raw or surname title", !JSON.stringify(host).includes("Adeyemi") && !JSON.stringify(host).includes(LONG));

  const orders = await (await streamerOrders(req("GET"), p({ token }))).json();
  const or = (name: string) => orders.registers.find((r: { firstName: string }) => r.firstName === name);
  check("streamer orders: title, fallback, trimmed", or("Idris")?.title === GOOD && or("Bisi")?.title === null && or("Chi")?.title === trimmed,
    JSON.stringify(orders.registers.map((r: { firstName: string; title: string | null }) => [r.firstName, r.title])));

  // ── Not consented: the title is left out of every payload ────────────────
  // Idris withdraws while on screen: she stays on screen (as the card tells
  // her) with her first name, but her title is gone.
  const w = await patchRegister(req("PATCH", { featureConsent: false }, idris.token), p({ id: rI.id }));
  check("withdraw while on screen: allowed", w.status === 200);
  const f2 = await (await overlayFrame(req("POST", {}), p({ token }))).json();
  check("withdrawn: overlay strip keeps her first name, no title", f2.register?.firstName === "Idris" && f2.register?.title === null, JSON.stringify(f2.register?.title));
  check("withdrawn: on-screen read has no title", (await fetchOnScreenRegister(rI.id))?.title === null);
  const h2 = await (await hostDashboard(req("GET"), p({ token }))).json();
  check("withdrawn: host on-screen panel has no title", h2.onScreen?.title === null);
  check("withdrawn: gone from the host's 'Fully funded' list", !h2.completions.some((c: { firstName: string }) => c.firstName === "Idris"));
  check("withdrawn: gone from the streamer orders page", !(await (await streamerOrders(req("GET"), p({ token }))).json()).registers.some((r: { firstName: string }) => r.firstName === "Idris"));
  check("withdrawn: her title appears in no live payload", ![JSON.stringify(f2), JSON.stringify(h2)].some((t) => t.includes(GOOD)));
  // Consent to an older wording: no title either.
  await prisma.register.update({ where: { id: rI.id }, data: { featureConsent: true, featureConsentVersion: 2 } });
  check("older consent wording: no title", (await fetchOnScreenRegister(rI.id))?.title === null);
  check("current consent version is 3", FEATURE_CONSENT_VERSION === 3);

  // ── Bug A: "No" works when her address isn't ready ───────────────────────
  // Fiyin confirmed an address on the card (switching her to saved mode) but
  // never said yes. "No" must work, and undoes the switch.
  const fiyin = await mother("Fiyin Ade");
  const rF = await register(fiyin.u.id, GOOD);
  await liveAddress(req("POST", address, fiyin.token), p({ id: rF.id }));
  const before = await prisma.register.findUniqueOrThrow({ where: { id: rF.id }, include: { savedAddress: true } });
  check("card-switched, not consented: saved mode with her address", before.addressMode === "SAVED_PER_REGISTER" && !!before.savedAddress && !before.featureConsent);
  const no = await patchRegister(req("PATCH", { featureConsent: false }, fiyin.token), p({ id: rF.id }));
  const noBody = await no.json();
  const after = await prisma.register.findUniqueOrThrow({ where: { id: rF.id }, include: { savedAddress: true } });
  check("No with the address not yet consented: accepted, switch undone", no.status === 200 && noBody.liveAddressReverted === true
    && after.addressMode === "ASK_PER_SHIPMENT" && !after.savedAddress, JSON.stringify(noBody));
  // A stale address on a consented mother: "No" still works.
  const gbemi = await mother("Gbemi Ola");
  const rG = await register(gbemi.u.id, GOOD);
  await consentLive(rG.id, gbemi.token);
  await prisma.registerAddress.update({ where: { registerId: rG.id }, data: { confirmedAt: new Date(Date.now() - 120 * 86_400_000) } });
  const noStale = await patchRegister(req("PATCH", { featureConsent: false }, gbemi.token), p({ id: rG.id }));
  check("No with a stale address: accepted, consent withdrawn", noStale.status === 200 && !(await prisma.register.findUniqueOrThrow({ where: { id: rG.id } })).featureConsent);
  // Nothing to withdraw, no address at all: "No" is still accepted.
  const hauwa = await mother("Hauwa Musa");
  const rH = await register(hauwa.u.id, GOOD);
  check("No with no address and no consent: accepted", (await patchRegister(req("PATCH", { featureConsent: false }, hauwa.token), p({ id: rH.id }))).status === 200);

  console.log(fails === 0 ? "\nALL PASS" : `\n${fails} FAILED`);
  await prisma.$disconnect();
  process.exit(fails === 0 ? 0 : 1);
})();
