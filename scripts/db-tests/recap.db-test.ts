// Run by hand against a throwaway local UTF-8 Postgres (UTC) with all migrations applied: DATABASE_URL=postgresql://…@127.0.0.1:…/db npx tsx scripts/db-tests/recap.db-test.ts
//
// Step 8 of the live fundraising rework: the live fulfilment layer — the
// overlay recap of registers completed in this event (lib/eventRecap), driven
// through the real payment path (stripeLedger.recordPayment) and the same
// buildOverlayFrame the endpoint runs, plus the host's goal raise. Writes test
// rows, so it refuses any non-local or non-UTF-8 database.
import { prisma } from "../../src/lib/prisma";
import { withStripeEvent, recordPayment } from "../../src/lib/stripeLedger";
import { buildOverlayFrame, type OverlayFrame } from "../../src/lib/overlayFrame";
import { recapText } from "../../src/lib/publicCelebration";
import { raiseGoal, fetchEventCompletions, hostCompletions } from "../../src/lib/eventRecap";

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

const allFrames: OverlayFrame[] = [];
const secrets: string[] = [];   // every id, surname, place and title created, for the privacy sweep
const frame = async (eventId: string) => {
  const f = (await buildOverlayFrame(eventId, { claim: false }))!;
  allFrames.push(f);
  return f;
};
const recap = (f: OverlayFrame) => f.recap.entries.map(recapText);

async function register(motherName: string, prices: number[]) {
  const mom = await prisma.user.create({ data: { name: motherName, email: `m${uid()}@t.test`, password: "x" } });
  const r = await prisma.register.create({ data: {
    title: `${motherName}'s list for Ikeja`, city: "Lagos", dueDate: new Date(), creatorId: mom.id, status: "ACTIVE",
    featureConsent: true, featureConsentAt: new Date(), featureConsentVersion: 2,
  } });
  const items = [];
  for (const p of prices) items.push(await prisma.registerItem.create({ data: { name: `Item ${items.length}`, registerId: r.id, standardPriceCents: p } }));
  secrets.push(mom.id, r.id, ...items.map((i) => i.id), motherName.split(" ").slice(1).join(" "), r.title, "Lagos", "Ikeja");
  return { mom, r, items };
}
async function pay(itemId: string, eventId: string, cents: number) {
  const f = await prisma.registerItemFunding.create({ data: {
    registerItemId: itemId, amountCents: cents, status: "PENDING", fundraisingEventId: eventId, guestEmail: `g${uid()}@t.test`,
  } });
  secrets.push(f.id);
  await withStripeEvent(`evt_${uid()}`, "checkout.session.completed", (tx) =>
    recordPayment(tx, f.id, `pi_${f.id}`, { showNameConsent: false, displayName: null }));
}
const onScreen = (eventId: string, registerId: string) =>
  prisma.fundraisingEvent.update({ where: { id: eventId }, data: { currentRegisterId: registerId } });
const queue = (itemId: string, status: "QUEUED" | "PURCHASED" | "DISPATCHED" | "DELIVERED") =>
  prisma.fulfillmentQueue.create({ data: { registerItemId: itemId, totalFundedCents: 1000, status, purchasedAt: status === "QUEUED" ? null : new Date() } });

(async () => {
  await requireUtf8();

  const A = await register("Maryam Okafor", [1000, 1000]);
  const B = await register("Ma$ryam Adeyemi", [1000]);       // first name fails the rule
  const C = await register("Zoë Lindqvist", [1000, 9000]);
  const ev = await prisma.fundraisingEvent.create({ data: {
    title: "E", slug: `e-${uid()}`, hostName: "H", status: "LIVE", currentRegisterId: A.r.id, goalRegisters: 5,
  } });
  secrets.push(ev.id, ev.slug);

  // ── The register on screen is excluded ───────────────────────────────────
  for (const it of A.items) await pay(it.id, ev.id, 1000);     // A completes while on screen
  const f1 = await frame(ev.id);
  check("on screen: A completed but is on screen, so no recap", f1.recap.entries.length === 0 && f1.event.goal.completed === 1,
    JSON.stringify(f1.recap));

  await onScreen(ev.id, B.r.id);
  await pay(B.items[0].id, ev.id, 1000);                       // B completes while on screen
  const f2 = await frame(ev.id);
  check("on screen: B on screen is excluded, A is listed", JSON.stringify(recap(f2)) === JSON.stringify(["Maryam — Funded ✓"]), recap(f2).join(" | "));

  // ── Status from the least advanced item ───────────────────────────────────
  await queue(A.items[0].id, "DELIVERED");
  const f3 = await frame(ev.id);
  check("least advanced: one delivered, one only funded -> Funded", recap(f3)[0] === "Maryam — Funded ✓", recap(f3)[0]);
  await queue(A.items[1].id, "PURCHASED");
  const f4 = await frame(ev.id);
  check("least advanced: one delivered, one purchased -> Order placed", recap(f4)[0] === "Maryam — Order placed ✓", recap(f4)[0]);
  await prisma.fulfillmentQueue.update({ where: { registerItemId: A.items[1].id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
  const f5 = await frame(ev.id);
  check("least advanced: both delivered -> Delivered", recap(f5)[0] === "Maryam — Delivered ✓", recap(f5)[0]);

  // ── A failed name rule gives the generic line ─────────────────────────────
  await onScreen(ev.id, C.r.id);
  const f6 = await frame(ev.id);
  check("name rule: B is shown as 'A mother', in completion order",
    JSON.stringify(recap(f6)) === JSON.stringify(["Maryam — Delivered ✓", "A mother — Funded ✓"]), recap(f6).join(" | "));
  check("only registers completed in this event: C (not complete) is not listed", f6.recap.entries.length === 2);

  // ── A withdrawn consent drops the entry ───────────────────────────────────
  await prisma.register.update({ where: { id: A.r.id }, data: { featureConsent: false, featureConsentAt: null, featureConsentVersion: null } });
  const f7 = await frame(ev.id);
  check("withdrawn consent: A drops off the recap", JSON.stringify(recap(f7)) === JSON.stringify(["A mother — Funded ✓"]), recap(f7).join(" | "));
  const host = hostCompletions(await fetchEventCompletions(ev.id));
  check("withdrawn consent: A drops off the host panel too", host.length === 1 && host[0].firstName === null);
  check("goal count still includes A (she was funded in this event)", f7.event.goal.completed === 2);

  // ── Another event's completions are not listed ────────────────────────────
  const D = await register("Ada Obi", [1000]);
  const ev2 = await prisma.fundraisingEvent.create({ data: { title: "E2", slug: `e-${uid()}`, hostName: "H", status: "LIVE", currentRegisterId: D.r.id } });
  secrets.push(ev2.id);
  await pay(D.items[0].id, ev2.id, 1000);
  const f8 = await frame(ev.id);
  check("this event only: a register completed in another event is not listed", !recap(f8).some((t) => t.startsWith("Ada")));

  // ── The goal: raised, never lowered, never below the funded count ────────
  const up = await raiseGoal(ev.id, 7);
  check("goal: raised from 5 to 7", up.ok && up.goalRegisters === 7);
  const down = await raiseGoal(ev.id, 6);
  check("goal: lowering is refused", !down.ok && /only be raised/.test(down.error), JSON.stringify(down));
  const ev3 = await prisma.fundraisingEvent.create({ data: { title: "E3", slug: `e-${uid()}`, hostName: "H", status: "LIVE" } });
  await prisma.eventRegisterCompletion.createMany({ data: [{ id: `c1-${uid()}`, eventId: ev3.id, registerId: B.r.id }, { id: `c2-${uid()}`, eventId: ev3.id, registerId: C.r.id }] });
  const below = await raiseGoal(ev3.id, 1);
  check("goal: below the 2 already funded is refused", !below.ok && /below the 2/.test(below.error), JSON.stringify(below));
  const atFunded = await raiseGoal(ev3.id, 2);
  check("goal: equal to the funded count is allowed", atFunded.ok && atFunded.goalRegisters === 2);
  await Promise.all([raiseGoal(ev.id, 9), raiseGoal(ev.id, 8)]);
  const g = await prisma.fundraisingEvent.findUnique({ where: { id: ev.id }, select: { goalRegisters: true } });
  check("goal: two raises at once never end lower than the higher one", g?.goalRegisters === 9, `goal=${g?.goalRegisters}`);
  const bad = await raiseGoal(ev.id, "12");
  check("goal: a non-number is refused", !bad.ok);

  // ── No ids, dates or places in any overlay response ──────────────────────
  const json = JSON.stringify(allFrames);
  const keys = new Set<string>();
  const walk = (v: unknown) => { if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { keys.add(k); walk(x); } };
  allFrames.forEach(walk);
  const idKeys = [...keys].filter((k) => /(^id$|Id$|At$|date|city|address|place)/i.test(k));
  check("privacy: no id, date or place keys in any frame", idKeys.length === 0, idKeys.join(","));
  const leaked = secrets.filter((s) => s && json.includes(s));
  check("privacy: no id, surname, title or place value in any frame", leaked.length === 0, leaked.join(","));
  check("privacy: no date or time value in any frame", !/\d{4}-\d{2}-\d{2}|T\d{2}:\d{2}/.test(json));

  console.log(fails === 0 ? "ALL PASS" : `${fails} FAILED`);
  await prisma.$disconnect();
  process.exit(fails === 0 ? 0 : 1);
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
