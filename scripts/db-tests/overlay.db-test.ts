// Run by hand against a throwaway local UTF-8 Postgres (UTC) with all migrations applied: DATABASE_URL=postgresql://…@127.0.0.1:…/db npx tsx scripts/db-tests/overlay.db-test.ts
//
// Step 7 of the live fundraising rework: the overlay frame and its celebration
// queue (lib/overlayFrame), driven through the real payment path
// (stripeLedger.recordPayment) and the same buildOverlayFrame the endpoint
// runs. Writes test rows, so it refuses any non-local or non-UTF-8 database.
import { prisma } from "../../src/lib/prisma";
import { withStripeEvent, recordPayment } from "../../src/lib/stripeLedger";
import { buildOverlayFrame, type OverlayFrame } from "../../src/lib/overlayFrame";
import { celebrationText } from "../../src/lib/publicCelebration";

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

// Every frame any test receives, for the privacy sweep at the end.
const allFrames: OverlayFrame[] = [];
const frame = async (eventId: string, claim = true) => {
  const f = await buildOverlayFrame(eventId, { claim });
  if (f) allFrames.push(f);
  return f!;
};

async function scene(opts: { mother?: string; items?: number[]; sponsor?: boolean; hideDonorNames?: boolean } = {}) {
  const mom = await prisma.user.create({ data: { name: opts.mother ?? "Aisha Bello", email: `m${uid()}@t.test`, password: "x" } });
  const r = await prisma.register.create({ data: { title: `${opts.mother ?? "Aisha Bello"}'s baby list`, city: "Lagos", dueDate: new Date(), creatorId: mom.id, status: "ACTIVE" } });
  const items = [];
  for (const price of opts.items ?? [1000, 5000]) items.push(await prisma.registerItem.create({ data: { name: `Diapers ${items.length}`, registerId: r.id, standardPriceCents: price } }));
  const ev = await prisma.fundraisingEvent.create({ data: {
    title: "E", slug: `e-${uid()}`, hostName: "H", status: "LIVE", currentRegisterId: r.id, goalRegisters: 5,
    hideDonorNames: opts.hideDonorNames ?? false,
    ...(opts.sponsor ? { sponsorConfirmedAt: new Date(), sponsorName: "Acme", sponsorBundleValueCents: 20000, sponsorBundlesReserved: 3 } : {}),
  } });
  return { mom, r, items, ev };
}
async function pay(itemId: string, eventId: string, cents: number, displayName: string | null = null) {
  const f = await prisma.registerItemFunding.create({ data: {
    registerItemId: itemId, amountCents: cents, status: "PENDING", fundraisingEventId: eventId, guestEmail: `g${uid()}@t.test`,
  } });
  await withStripeEvent(`evt_${uid()}`, "checkout.session.completed", (tx) =>
    recordPayment(tx, f.id, `pi_${f.id}`, { showNameConsent: displayName !== null, displayName }));
  return f;
}

(async () => {
  await requireUtf8();

  // ── State: a fresh overlay gets the register, counts and goal ─────────────
  {
    const { ev } = await scene({ items: [1000, 5000] });
    const f = await frame(ev.id, false);
    check("state: on-screen register with items, remaining and progress",
      f.register?.firstName === "Aisha" && f.register.items.length === 2 && f.register.items[0].remainingCents === 1000
      && f.register.counts.total === 2 && f.register.counts.funded === 0 && f.register.percent === 0);
    check("state: goal progress", f.event.goal.completed === 0 && f.event.goal.target === 5);
  }

  // ── Item states: only what is literally true ──────────────────────────────
  // FUNDED from the funding alone (a QUEUED row is not an order), ORDERED from
  // a recorded purchase, DELIVERED only when an admin marked it delivered.
  {
    const { items, ev } = await scene({ items: [1000, 1000, 1000, 1000, 1000, 9000] });
    for (const it of items.slice(0, 5)) await pay(it.id, ev.id, 1000);
    // Step 9: ORDERED needs an order attached.
    const order = await prisma.fulfillmentOrder.create({ data: { registerId: items[0].registerId, totalCents: 3000, trackingUrl: "https://a.co/d/x", estimatedDeliveryOn: new Date() } });
    const q = (i: number, status: "QUEUED" | "PURCHASED" | "DISPATCHED" | "DELIVERED") =>
      prisma.fulfillmentQueue.create({ data: { registerItemId: items[i].id, totalFundedCents: 1000, status, orderId: status === "QUEUED" ? null : order.id } });
    await q(1, "QUEUED"); await q(2, "PURCHASED"); await q(3, "DISPATCHED"); await q(4, "DELIVERED");
    const f = await frame(ev.id, false);
    const states = f.register?.items.map((i) => i.state).join(",");
    check("item states: funded, queued = funded, purchased/dispatched = order placed, delivered = delivered, unpaid = needed",
      states === "FUNDED,FUNDED,ORDERED,ORDERED,DELIVERED,NEEDED", states);
  }

  // ── Two overlays claiming the same celebration at once ────────────────────
  {
    const { items, ev } = await scene({ items: [1000, 5000] });
    await pay(items[0].id, ev.id, 1000);                      // one celebration queued
    const [a, b] = await Promise.all([frame(ev.id), frame(ev.id)]);
    const got = [a.celebration, b.celebration].filter(Boolean).length;
    check("two overlays, one celebration: exactly one gets it", got === 1, `got=${got}`);

    // Many overlays, several celebrations: each shown exactly once.
    const s2 = await scene({ items: [1000, 1000, 1000, 9000] });
    for (const it of s2.items.slice(0, 3)) await pay(it.id, s2.ev.id, 1000);
    const frames = await Promise.all(Array.from({ length: 8 }, () => frame(s2.ev.id)));
    const shown = frames.map((f) => f.celebration).filter(Boolean);
    const shownRows = await prisma.eventCelebration.count({ where: { eventId: s2.ev.id, shownAt: { not: null } } });
    check("eight overlays, three celebrations: three shown, none twice", shown.length === 3 && shownRows === 3,
      `shown=${shown.length} rows=${shownRows}`);
  }

  // ── Oldest first ──────────────────────────────────────────────────────────
  {
    const { items, ev } = await scene({ items: [1000, 1000, 9000] });
    await pay(items[0].id, ev.id, 1000);
    await pay(items[1].id, ev.id, 1000);
    const first = await frame(ev.id);
    const second = await frame(ev.id);
    const t = (f: OverlayFrame) => (f.celebration && "itemName" in f.celebration ? f.celebration.itemName : null);
    check("oldest first", t(first) === "Diapers 0" && t(second) === "Diapers 1", `${t(first)}, ${t(second)}`);
  }

  // ── A reload must not replay anything ─────────────────────────────────────
  {
    const { items, ev } = await scene({ items: [1000, 5000] });
    await pay(items[0].id, ev.id, 1000);
    const shown = await frame(ev.id);
    const reload = await frame(ev.id);          // a fresh overlay: first poll after loading
    const again = await frame(ev.id);
    check("reload: the shown celebration is not replayed", !!shown.celebration && reload.celebration === null && again.celebration === null);
    check("reload: it still gets the current state", reload.register?.counts.funded === 1 && reload.register.items[0].state === "FUNDED");
  }

  // ── hideDonorNames switched on mid-queue ──────────────────────────────────
  {
    const { items, ev } = await scene({ items: [1000, 1000, 9000] });
    await pay(items[0].id, ev.id, 1000, "Sarah");
    await pay(items[1].id, ev.id, 1000, "Tola");
    const first = await frame(ev.id);
    await prisma.fundraisingEvent.update({ where: { id: ev.id }, data: { hideDonorNames: true } });  // host switches it on
    const second = await frame(ev.id);
    const name = (f: OverlayFrame) => (f.celebration && "donorFirstName" in f.celebration ? f.celebration.donorFirstName : "n/a");
    check("names: shown before the switch", name(first) === "Sarah");
    check("names: queued name gone after the switch", name(second) === null, `name=${name(second)}`);
    check("names: wording falls back to no donor", celebrationText(second.celebration!).headline === "Aisha's diapers 1 funded ✓",
      celebrationText(second.celebration!).headline);
    const stored = await prisma.eventCelebration.findFirst({ where: { eventId: ev.id, donorDisplayName: "Tola" } });
    check("names: hidden on air only — the record keeps her choice", !!stored);
  }

  // ── A bundle held until its beat ──────────────────────────────────────────
  {
    const { items, ev } = await scene({ items: [1000], sponsor: true });
    await pay(items[0].id, ev.id, 1000);                     // item funded + register complete + bundle
    const f1 = await frame(ev.id), f2 = await frame(ev.id), f3 = await frame(ev.id);
    check("bundle: item, then register complete", f1.celebration?.type === "ITEM_FUNDED_BY_ONE" && f2.celebration?.type === "REGISTER_COMPLETE");
    check("bundle: not shown straight after the register complete", f3.celebration === null);

    await prisma.eventCelebration.updateMany({ where: { eventId: ev.id, type: "BUNDLE_UNLOCKED" }, data: { createdAt: new Date(Date.now() - 61_000) } });
    const f4 = await frame(ev.id);
    check("bundle: 60s old but a register-complete was shown <30s ago -> still held", f4.celebration === null);

    await prisma.eventCelebration.updateMany({ where: { eventId: ev.id, type: "REGISTER_COMPLETE" }, data: { shownAt: new Date(Date.now() - 31_000) } });
    const f5 = await frame(ev.id);
    check("bundle: on its own beat once both hold", f5.celebration?.type === "BUNDLE_UNLOCKED");
    check("bundle: sponsor line while confirmed", f5.celebration?.type === "BUNDLE_UNLOCKED"
      && celebrationText(f5.celebration).line === "~$200 additional support from Acme");
    check("bundle: names no mother", !JSON.stringify(f5.celebration).includes("Aisha"));

    // Sponsor unconfirmed at show time: the moment shows, the sponsor line doesn't.
    const s2 = await scene({ items: [1000], sponsor: true, mother: "Bisi Ade" });
    await pay(s2.items[0].id, s2.ev.id, 1000);
    await frame(s2.ev.id); await frame(s2.ev.id);
    await prisma.eventCelebration.updateMany({ where: { eventId: s2.ev.id, type: "BUNDLE_UNLOCKED" }, data: { createdAt: new Date(Date.now() - 61_000) } });
    await prisma.eventCelebration.updateMany({ where: { eventId: s2.ev.id, type: "REGISTER_COMPLETE" }, data: { shownAt: new Date(Date.now() - 31_000) } });
    await prisma.fundraisingEvent.update({ where: { id: s2.ev.id }, data: { sponsorConfirmedAt: null } });
    const g = await frame(s2.ev.id);
    check("bundle: no sponsor line once sponsorConfirmedAt is cleared", g.celebration?.type === "BUNDLE_UNLOCKED" && g.celebration.sponsorLine === null);
  }

  // ── Stale: never shown and old ─────────────────────────────────────────────
  {
    const { items, ev } = await scene({ items: [1000], sponsor: true });
    await pay(items[0].id, ev.id, 1000);
    await prisma.eventCelebration.updateMany({ where: { eventId: ev.id, type: { not: "BUNDLE_UNLOCKED" } }, data: { createdAt: new Date(Date.now() - 121_000) } });
    await prisma.eventCelebration.updateMany({ where: { eventId: ev.id, type: "BUNDLE_UNLOCKED" }, data: { createdAt: new Date(Date.now() - 16 * 60_000) } });
    const f = await frame(ev.id);
    const left = await prisma.eventCelebration.count({ where: { eventId: ev.id, shownAt: null } });
    check("stale: register moments >2 min and a bundle >15 min are not shown", f.celebration === null);
    check("stale: they are kept, unshown, as a record", left === 3, `unshown=${left}`);
  }

  // ── A mother whose first name fails the rule: generic, never dropped ──────
  {
    const { items, ev } = await scene({ items: [1000, 5000], mother: "Ai$ha Bello" });
    await pay(items[0].id, ev.id, 1000);
    const f = await frame(ev.id);
    check("bad name: celebration still shown", f.celebration?.type === "ITEM_FUNDED_BY_ONE");
    check("bad name: generic wording, no name", !!f.celebration && "motherFirstName" in f.celebration && f.celebration.motherFirstName === null
      && celebrationText(f.celebration).headline === "Diapers 0 funded ✓", celebrationText(f.celebration!).headline);
    check("bad name: register strip shows no name", f.register?.firstName === null);
  }

  // ── No ids, no full names, no mother named on a bundle — in ANY frame ─────
  {
    const json = JSON.stringify(allFrames);
    const idRows = [
      ...(await prisma.register.findMany({ select: { id: true } })),
      ...(await prisma.registerItem.findMany({ select: { id: true } })),
      ...(await prisma.fundraisingEvent.findMany({ select: { id: true } })),
      ...(await prisma.eventCelebration.findMany({ select: { id: true } })),
      ...(await prisma.eventBundleUnlock.findMany({ select: { id: true } })),
      ...(await prisma.user.findMany({ select: { id: true } })),
      ...(await prisma.registerItemFunding.findMany({ select: { id: true } })),
    ].map((r) => r.id);
    const leakedIds = idRows.filter((id) => json.includes(id));
    check(`no ids: none of ${idRows.length} database ids appear in ${allFrames.length} frames`, leakedIds.length === 0, leakedIds.slice(0, 3).join(","));
    const keyed = (v: unknown): string[] => v && typeof v === "object" ? Object.entries(v).flatMap(([k, x]) => [k, ...keyed(x)]) : [];
    check("no ids: no key named id or ending in Id", keyed(allFrames).filter((k) => /(^id$|Id$)/.test(k)).length === 0);
    check("no full names: no surname, no register title, no city", !/Bello|Ade\b|baby list|Lagos/.test(json));
    const bundleFrames = allFrames.filter((f) => f.celebration?.type === "BUNDLE_UNLOCKED");
    check(`bundle frames name no mother (${bundleFrames.length} checked)`, bundleFrames.length > 0
      && bundleFrames.every((f) => !/Aisha|Bisi/.test(JSON.stringify(f.celebration))));
    check("no dollar total for the event in any frame", !/raised|totalCents|amountCents/i.test(json));
  }

  console.log(fails === 0 ? "ALL PASS" : `${fails} FAILED`);
  await prisma.$disconnect();
  process.exit(fails === 0 ? 0 : 1);
})();
