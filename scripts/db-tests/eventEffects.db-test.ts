// Run by hand against a throwaway local Postgres with all migrations applied: DATABASE_URL=postgresql://…@127.0.0.1:…/db npx tsx scripts/db-tests/eventEffects.db-test.ts
//
// Step 5 of the live fundraising rework: the webhook's event effects
// (lib/eventEffects via stripeLedger.recordPayment) under real concurrency.
// Writes test rows, so it refuses any DATABASE_URL that isn't localhost. Not
// part of the build or the pre-push hook: nothing imports it.
import { prisma } from "../../src/lib/prisma";
import { withStripeEvent, isDuplicateStripeEvent, recordPayment } from "../../src/lib/stripeLedger";
import { firstNameOnly } from "../../src/lib/eventEffects";

const dbUrl = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(dbUrl)) {
  console.error("Refusing to run: DATABASE_URL must point at a local throwaway Postgres (127.0.0.1 or localhost).");
  process.exit(1);
}

let fails = 0;
const check = (label: string, ok: boolean, detail = "") => { if (!ok) fails++; console.log(ok ? "pass" : "FAIL", label, detail); };
let n = 0;
const uid = () => `${Date.now()}-${n++}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function register(itemPrices: number[]) {
  const u = await prisma.user.create({ data: { name: "Aisha Surname", email: `m${uid()}@t.test`, password: "x" } });
  const r = await prisma.register.create({ data: { title: "T", city: "C", dueDate: new Date(), creatorId: u.id, status: "ACTIVE" } });
  const items = [];
  for (const price of itemPrices) items.push(await prisma.registerItem.create({ data: { name: "Diapers", registerId: r.id, standardPriceCents: price } }));
  return { r, items };
}
async function liveEvent(onScreen: string | null, extra: Record<string, unknown> = {}) {
  return prisma.fundraisingEvent.create({ data: { title: "E", slug: `e-${uid()}`, hostName: "H", status: "LIVE", currentRegisterId: onScreen, ...extra } });
}
const sponsor = { sponsorConfirmedAt: new Date(), sponsorName: "Acme", sponsorBundleValueCents: 20000 };
async function contribution(itemId: string, cents: number, o: { eventId?: string | null; guestEmail?: string; displayName?: string; showNameConsent?: boolean } = {}) {
  return prisma.registerItemFunding.create({ data: {
    registerItemId: itemId, amountCents: cents, status: "PENDING", fundraisingEventId: o.eventId ?? null,
    guestEmail: o.guestEmail ?? `g${uid()}@t.test`, displayName: o.displayName ?? null, showNameConsent: o.showNameConsent ?? true,
  } });
}
const deliver = (fundingId: string, eventId = `evt_${uid()}`) =>
  withStripeEvent(eventId, "checkout.session.completed", (tx) => recordPayment(tx, fundingId, `pi_${fundingId}`));
const celebrations = (eventId: string) => prisma.eventCelebration.findMany({ where: { eventId }, orderBy: { createdAt: "asc" } });

(async () => {
  check("firstNameOnly", firstNameOnly("  Sarah Jane Smith ") === "Sarah" && firstNameOnly("Ngozi-Ade") === "Ngozi-Ade"
    && firstNameOnly("<b>") === "b" && firstNameOnly("123") === null && firstNameOnly(null) === null
    && firstNameOnly("Abcdefghijklmnopqrstuvwxyz") === "Abcdefghijklmnopqrst");

  // Item funded by several donors: ITEM_FUNDED, no name.
  {
    const { r, items: [it] } = await register([2000, 5000]);
    const ev = await liveEvent(r.id);
    await deliver((await contribution(it.id, 1000, { eventId: ev.id, displayName: "Sarah" })).id);
    await deliver((await contribution(it.id, 1000, { eventId: ev.id, displayName: "Tola" })).id);
    const cs = await celebrations(ev.id);
    check("several donors: one ITEM_FUNDED, no name", cs.length === 1 && cs[0].type === "ITEM_FUNDED" && cs[0].donorDisplayName === null);
    check("dedupe key = event, item and type", cs[0]?.dedupeKey === `item:${ev.id}:${it.id}:ITEM_FUNDED`);
  }

  // One donor across two payments: ITEM_FUNDED_BY_ONE, first name.
  {
    const { r, items: [it] } = await register([2000, 5000]);
    const ev = await liveEvent(r.id);
    const email = `sarah${uid()}@t.test`;
    await deliver((await contribution(it.id, 1000, { eventId: ev.id, guestEmail: email, displayName: "Sarah" })).id);
    await deliver((await contribution(it.id, 1000, { eventId: ev.id, guestEmail: email.toUpperCase(), displayName: "Sarah Jane Smith" })).id);
    const cs = await celebrations(ev.id);
    check("one donor over two payments: ITEM_FUNDED_BY_ONE", cs.length === 1 && cs[0].type === "ITEM_FUNDED_BY_ONE");
    check("one donor: first name only", cs[0]?.donorDisplayName === "Sarah", `name=${cs[0]?.donorDisplayName}`);
  }

  // Name withheld: an unticked payment; the host's switch.
  {
    const { r, items: [it] } = await register([2000, 5000]);
    const ev = await liveEvent(r.id);
    const email = `x${uid()}@t.test`;
    await deliver((await contribution(it.id, 1000, { eventId: ev.id, guestEmail: email, displayName: "Sarah", showNameConsent: false })).id);
    await deliver((await contribution(it.id, 1000, { eventId: ev.id, guestEmail: email, displayName: "Sarah" })).id);
    const cs = await celebrations(ev.id);
    check("one of her payments unticked: name null", cs[0]?.type === "ITEM_FUNDED_BY_ONE" && cs[0]?.donorDisplayName === null);

    const B = await register([1000, 5000]);
    const ev2 = await liveEvent(B.r.id, { hideDonorNames: true });
    await deliver((await contribution(B.items[0].id, 1000, { eventId: ev2.id, displayName: "Sarah" })).id);
    const cs2 = await celebrations(ev2.id);
    check("host hid donor names: name null", cs2[0]?.type === "ITEM_FUNDED_BY_ONE" && cs2[0]?.donorDisplayName === null);
  }

  // Webhook retry.
  {
    const { r, items: [it] } = await register([1000]);
    const ev = await liveEvent(r.id, { ...sponsor, sponsorBundlesReserved: 5 });
    const f = await contribution(it.id, 1000, { eventId: ev.id, displayName: "Sarah" });
    const evtId = `evt_${uid()}`;
    const out = await Promise.allSettled([deliver(f.id, evtId), deliver(f.id, evtId)]);
    let later = false; try { await deliver(f.id, evtId); } catch (e) { later = isDuplicateStripeEvent(e); }
    const again = await deliver(f.id);
    const cs = await celebrations(ev.id);
    const evAfter = await prisma.fundraisingEvent.findUniqueOrThrow({ where: { id: ev.id } });
    check("retry: concurrent duplicate delivery, one applied",
      out.filter((o) => o.status === "fulfilled").length === 1 && out.filter((o) => o.status === "rejected" && isDuplicateStripeEvent(o.reason)).length === 1);
    check("retry: later redelivery is a duplicate; a new event id for the same payment does nothing", later && again === null);
    check("retry: item, complete and bundle celebrations once each", cs.length === 3
      && ["ITEM_FUNDED_BY_ONE", "REGISTER_COMPLETE", "BUNDLE_UNLOCKED"].every((t) => cs.filter((c) => c.type === t).length === 1),
      cs.map((c) => c.type).join(","));
    check("retry: one completion, one unlock, counter 1",
      (await prisma.eventRegisterCompletion.count({ where: { eventId: ev.id } })) === 1
      && (await prisma.eventBundleUnlock.count({ where: { eventId: ev.id } })) === 1 && evAfter.sponsorBundlesUnlocked === 1);
  }

  // Two concurrent payments finishing the same item.
  {
    const { r, items: [it] } = await register([1000, 5000]);
    const ev = await liveEvent(r.id);
    const [a, b] = await Promise.all([contribution(it.id, 1000, { eventId: ev.id }), contribution(it.id, 1000, { eventId: ev.id })]);
    const res = await Promise.all([deliver(a.id), deliver(b.id)]);
    const cs = await celebrations(ev.id);
    check("same item, two at once: exactly one completes it", res.filter((x) => x?.becameFullyFunded).length === 1);
    check("same item, two at once: exactly one celebration", cs.length === 1, `n=${cs.length}`);
  }

  // The last two items of one register finished at once.
  {
    const { r, items: [i1, i2] } = await register([1000, 1000]);
    const ev = await liveEvent(r.id);
    const [a, b] = await Promise.all([contribution(i1.id, 1000, { eventId: ev.id }), contribution(i2.id, 1000, { eventId: ev.id })]);
    await Promise.all([deliver(a.id), deliver(b.id)]);
    check("last two items at once: completion recorded exactly once (register lock)",
      (await prisma.eventRegisterCompletion.count({ where: { eventId: ev.id, registerId: r.id } })) === 1);
    check("last two items at once: one REGISTER_COMPLETE",
      (await celebrations(ev.id)).filter((c) => c.type === "REGISTER_COMPLETE").length === 1);
  }

  // Two registers completing at once, one bundle left. One event shows one
  // register at a time, so the race is a host switching register while A's
  // completion is between reading "on screen" and taking the bundle: a
  // transaction holds the event row; A's payment reads A on screen and waits
  // on the bundle counter; the holder switches the screen to B and commits;
  // A and B then take the counter together.
  {
    const A = await register([1000]); const B = await register([1000]);
    const ev = await liveEvent(A.r.id, { ...sponsor, sponsorBundlesReserved: 3, sponsorBundlesUnlocked: 2 });
    const fa = await contribution(A.items[0].id, 1000, { eventId: ev.id });
    const fb = await contribution(B.items[0].id, 1000, { eventId: ev.id });
    let aDone: Promise<unknown> = Promise.resolve();
    await prisma.$transaction(async (hold) => {
      await hold.$queryRaw`SELECT "id" FROM "FundraisingEvent" WHERE "id" = ${ev.id} FOR UPDATE`;
      aDone = deliver(fa.id);
      await sleep(800);
      await hold.fundraisingEvent.update({ where: { id: ev.id }, data: { currentRegisterId: B.r.id } });
    }, { timeout: 20000 });
    const bDone = deliver(fb.id);
    await Promise.all([aDone, bDone]);
    const unlocks = await prisma.eventBundleUnlock.findMany({ where: { eventId: ev.id } });
    const after = await prisma.fundraisingEvent.findUniqueOrThrow({ where: { id: ev.id } });
    const comps = await prisma.eventRegisterCompletion.count({ where: { eventId: ev.id } });
    check("one bundle left, two registers: exactly one unlock", unlocks.length === 1, `unlocks=${unlocks.length}`);
    check("one bundle left: counter stops at the reservation (3 of 3)", after.sponsorBundlesUnlocked === 3, `unlocked=${after.sponsorBundlesUnlocked}`);
    check("one bundle left: both registers still recorded as completed", comps === 2, `completions=${comps}`);
    const loser = unlocks[0]?.registerId === A.r.id ? B.r.id : A.r.id;
    check("one bundle left: the other register keeps no unlock (claim given back)",
      (await prisma.eventBundleUnlock.count({ where: { registerId: loser } })) === 0);
  }

  // sponsorConfirmedAt null: no unlock.
  {
    const { r, items: [it] } = await register([1000]);
    const ev = await liveEvent(r.id, { ...sponsor, sponsorConfirmedAt: null, sponsorBundlesReserved: 5 });
    await deliver((await contribution(it.id, 1000, { eventId: ev.id })).id);
    const after = await prisma.fundraisingEvent.findUniqueOrThrow({ where: { id: ev.id } });
    check("sponsor unconfirmed: completion recorded", (await prisma.eventRegisterCompletion.count({ where: { eventId: ev.id } })) === 1);
    check("sponsor unconfirmed: no unlock, no bundle celebration, counter 0",
      (await prisma.eventBundleUnlock.count({ where: { eventId: ev.id } })) === 0 && after.sponsorBundlesUnlocked === 0
      && (await celebrations(ev.id)).every((c) => c.type !== "BUNDLE_UNLOCKED"));
  }

  // A register that already has an unlock (from another event).
  {
    const { r, items: [i1, i2] } = await register([1000, 1000]);
    const old = await prisma.fundraisingEvent.create({ data: { title: "Old", slug: `old-${uid()}`, hostName: "H", status: "ENDED", ...sponsor, sponsorBundlesReserved: 1, sponsorBundlesUnlocked: 1 } });
    await prisma.eventBundleUnlock.create({ data: { eventId: old.id, registerId: r.id, valueCents: 20000, sponsorName: "Acme" } });
    const ev = await liveEvent(r.id, { ...sponsor, sponsorBundlesReserved: 5 });
    await deliver((await contribution(i1.id, 1000, { eventId: ev.id })).id);
    await deliver((await contribution(i2.id, 1000, { eventId: ev.id })).id);
    const after = await prisma.fundraisingEvent.findUniqueOrThrow({ where: { id: ev.id } });
    check("already unlocked: completion recorded in the new event", (await prisma.eventRegisterCompletion.count({ where: { eventId: ev.id } })) === 1);
    check("already unlocked: no second unlock, counter unchanged",
      (await prisma.eventBundleUnlock.count({ where: { registerId: r.id } })) === 1 && after.sponsorBundlesUnlocked === 0);
  }

  // The unlock names no mother; copies value and sponsor.
  {
    const { r, items: [it] } = await register([1000]);
    const ev = await liveEvent(r.id, { ...sponsor, sponsorBundlesReserved: 1 });
    await deliver((await contribution(it.id, 1000, { eventId: ev.id })).id);
    const u = await prisma.eventBundleUnlock.findFirstOrThrow({ where: { eventId: ev.id } });
    const bc = (await celebrations(ev.id)).find((c) => c.type === "BUNDLE_UNLOCKED");
    check("unlock copies value and sponsor", u.valueCents === 20000 && u.sponsorName === "Acme");
    check("bundle celebration names no mother", !!bc && bc.registerId === null && bc.registerItemId === null && bc.donorDisplayName === null && bc.bundleUnlockId === u.id);
  }

  // No effects unless the register is on screen in a LIVE event.
  {
    const { r, items: [it] } = await register([1000]);
    const other = await register([1000]);
    const ev = await liveEvent(other.r.id, sponsor);
    const ended = await prisma.fundraisingEvent.create({ data: { title: "X", slug: `x-${uid()}`, hostName: "H", status: "ENDED", currentRegisterId: r.id } });
    await deliver((await contribution(it.id, 1000, { eventId: ev.id })).id);
    check("attributed but not on screen: no celebration", (await celebrations(ev.id)).length === 0);
    check("on screen in an ENDED event: nothing", (await celebrations(ended.id)).length === 0
      && (await prisma.eventRegisterCompletion.count({ where: { registerId: r.id } })) === 0);
  }
  {
    const { r, items: [it] } = await register([1000]);
    const ev = await liveEvent(r.id, { ...sponsor, sponsorBundlesReserved: 5 });
    await deliver((await contribution(it.id, 1000, { eventId: null })).id);
    const cs = await celebrations(ev.id);
    check("on screen, no attributed contribution: item celebrated, but no completion or unlock",
      cs.length === 1 && cs[0].type === "ITEM_FUNDED_BY_ONE"
      && (await prisma.eventRegisterCompletion.count({ where: { eventId: ev.id } })) === 0
      && (await prisma.eventBundleUnlock.count({ where: { eventId: ev.id } })) === 0);
  }

  console.log(fails === 0 ? "ALL PASS" : `${fails} FAILED`);
  await prisma.$disconnect();
  process.exit(fails === 0 ? 0 : 1);
})();
