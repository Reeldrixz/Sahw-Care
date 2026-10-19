// Run by hand against a throwaway local Postgres with all migrations applied: DATABASE_URL=postgresql://…@127.0.0.1:…/db npx tsx scripts/db-tests/donorName.db-test.ts
//
// Step 6 of the live fundraising rework: the donor's livestream name, from
// Stripe session metadata (untrusted) through the webhook's path
// (lib/donorName → stripeLedger.recordPayment) to the contribution and the
// celebration. Writes test rows, so it refuses any non-local DATABASE_URL.
import { prisma } from "../../src/lib/prisma";
import { withStripeEvent, isDuplicateStripeEvent, recordPayment } from "../../src/lib/stripeLedger";
import { donorNameFromMetadata } from "../../src/lib/donorName";

const dbUrl = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(dbUrl)) {
  console.error("Refusing to run: DATABASE_URL must point at a local throwaway Postgres (127.0.0.1 or localhost).");
  process.exit(1);
}

let fails = 0;
const check = (label: string, ok: boolean, detail = "") => { if (!ok) fails++; console.log(ok ? "pass" : "FAIL", label, detail); };
let n = 0;
const uid = () => `${Date.now()}-${n++}`;

// One live event with a one-item register on screen, and a PENDING
// contribution covering that item — as the guest checkout would create it.
async function setup() {
  const u = await prisma.user.create({ data: { name: "Aisha Surname", email: `m${uid()}@t.test`, password: "x" } });
  const r = await prisma.register.create({ data: { title: "T", city: "C", dueDate: new Date(), creatorId: u.id, status: "ACTIVE" } });
  const it = await prisma.registerItem.create({ data: { name: "Diapers", registerId: r.id, standardPriceCents: 1000 } });
  const ev = await prisma.fundraisingEvent.create({ data: { title: "E", slug: `e-${uid()}`, hostName: "H", status: "LIVE", currentRegisterId: r.id } });
  const f = await prisma.registerItemFunding.create({ data: {
    registerItemId: it.id, amountCents: 1000, status: "PENDING", fundraisingEventId: ev.id, guestEmail: `g${uid()}@t.test`,
  } });
  return { ev, f };
}

// What the webhook does with a completed session's metadata.
const webhook = (fundingId: string, metadata: Record<string, string> | null, eventId = `evt_${uid()}`) =>
  withStripeEvent(eventId, "checkout.session.completed", (tx) =>
    recordPayment(tx, fundingId, `pi_${fundingId}`, donorNameFromMetadata(metadata)));

async function outcome(fundingId: string, eventId: string) {
  const f = await prisma.registerItemFunding.findUniqueOrThrow({ where: { id: fundingId } });
  // The one-item register also completes, so there is a REGISTER_COMPLETE
  // celebration too; the donor name belongs on the item celebration.
  const all = await prisma.eventCelebration.findMany({ where: { eventId } });
  const cs = all.filter((c) => c.type === "ITEM_FUNDED" || c.type === "ITEM_FUNDED_BY_ONE");
  return { stored: { showNameConsent: f.showNameConsent, displayName: f.displayName }, celebrations: cs, all };
}

(async () => {
  // Ticked, with a full name typed: first name stored and shown.
  {
    const { ev, f } = await setup();
    await webhook(f.id, { showName: "1", displayName: "Sarah Jane Smith" });
    const o = await outcome(f.id, ev.id);
    check("ticked: consent stored, first name only", o.stored.showNameConsent === true && o.stored.displayName === "Sarah", JSON.stringify(o.stored));
    check("ticked: item celebration shows the first name", o.celebrations.length === 1 && o.celebrations[0].donorDisplayName === "Sarah");
    check("ticked: the completion celebration carries no donor name", o.all.filter((c) => c.type === "REGISTER_COMPLETE").every((c) => c.donorDisplayName === null));
    check("ticked: the surname is stored nowhere", !JSON.stringify(o).includes("Smith") && !JSON.stringify(o).includes("Jane"));
  }

  // Unticked, with a name typed: nothing stored, nothing shown.
  {
    const { ev, f } = await setup();
    await webhook(f.id, { showName: "0", displayName: "Sarah" });
    const o = await outcome(f.id, ev.id);
    check("unticked: consent false, no name stored", o.stored.showNameConsent === false && o.stored.displayName === null, JSON.stringify(o.stored));
    check("unticked: celebration has no name", o.celebrations[0]?.donorDisplayName === null);
  }

  // Ticked but blank: no name.
  {
    const { ev, f } = await setup();
    await webhook(f.id, { showName: "1", displayName: "   " });
    const o = await outcome(f.id, ev.id);
    check("blank: no name stored", o.stored.displayName === null, JSON.stringify(o.stored));
    check("blank: celebration has no name", o.celebrations[0]?.donorDisplayName === null);
  }

  // Markup typed as the name: cleaned by the first-name rule, never stored raw.
  {
    const { ev, f } = await setup();
    await webhook(f.id, { showName: "1", displayName: "<b>Sarah</b>" });
    const o = await outcome(f.id, ev.id);
    check("<b>Sarah</b>: stored without markup", o.stored.displayName === "bSarahb", `stored=${o.stored.displayName}`);
    check("<b>Sarah</b>: no < or > anywhere", !/[<>]/.test(JSON.stringify(o)));
    const { ev: ev2, f: f2 } = await setup();
    await webhook(f2.id, { showName: "1", displayName: "<b>" });
    const o2 = await outcome(f2.id, ev2.id);
    check("<b> alone: becomes \"b\"", o2.stored.displayName === "b", `stored=${o2.stored.displayName}`);
  }

  // Missing metadata (a session from before this change) or a forged flag: no consent.
  {
    const { ev, f } = await setup();
    await webhook(f.id, null);
    const o = await outcome(f.id, ev.id);
    check("no metadata: consent false, no name", o.stored.showNameConsent === false && o.stored.displayName === null);
    const { f: f2 } = await setup();
    await webhook(f2.id, { showName: "true", displayName: "Sarah" });
    const o2 = await prisma.registerItemFunding.findUniqueOrThrow({ where: { id: f2.id } });
    check("flag other than \"1\": consent false, no name", o2.showNameConsent === false && o2.displayName === null);
  }

  // Webhook retry: the same event twice at once and again later, and a new
  // event id for the same payment carrying a different name. Set once.
  {
    const { ev, f } = await setup();
    const evtId = `evt_${uid()}`;
    const md = { showName: "1", displayName: "Sarah" };
    const out = await Promise.allSettled([webhook(f.id, md, evtId), webhook(f.id, md, evtId)]);
    let later = false; try { await webhook(f.id, md, evtId); } catch (e) { later = isDuplicateStripeEvent(e); }
    const again = await webhook(f.id, { showName: "1", displayName: "Mallory" });
    const o = await outcome(f.id, ev.id);
    check("retry: one applied, one duplicate",
      out.filter((x) => x.status === "fulfilled").length === 1 && out.filter((x) => x.status === "rejected" && isDuplicateStripeEvent(x.reason)).length === 1);
    check("retry: later redelivery is a duplicate", later);
    check("retry: a new event id for the same payment changes nothing", again === null && o.stored.displayName === "Sarah");
    check("retry: one item celebration, with the original name", o.celebrations.length === 1 && o.celebrations[0].donorDisplayName === "Sarah");
    check("retry: no celebration duplicated", o.all.length === 2, o.all.map((c) => c.type).join(","));
  }

  console.log(fails === 0 ? "ALL PASS" : `${fails} FAILED`);
  await prisma.$disconnect();
  process.exit(fails === 0 ? 0 : 1);
})();
