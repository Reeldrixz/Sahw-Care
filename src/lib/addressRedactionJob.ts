import { prisma } from "@/lib/prisma";
import { auditSnapshot, BLANKED_FIELDS, BLANK_ITEM_SELECT, savedAddressDecision } from "@/lib/addressRedaction";
import { revertLiveAddressSwitch, REVERT_CANDIDATE_WHERE } from "@/lib/liveAddress";

// The body of the redact-addresses cron (api/cron/redact-addresses), here so
// tests can run it with a chosen "now". Rules: lib/addressRedaction.
export async function runAddressRedaction(now: Date) {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let shipmentRedacted = 0;
  let savedRedacted = 0;
  let liveReverted = 0;
  const savedReasons: Record<string, number> = {};

  // ── Job A: Per-item ShipmentAddress ─────────────────────────────────────────
  const shipmentAddresses = await prisma.shipmentAddress.findMany({
    where: {
      redactedAt: null,
      registerItem: {
        // Delivered register items are set to FULFILLED (not DELIVERED) by the
        // fulfillment queue, so FULFILLED must be included or delivered
        // shipping addresses are never redacted.
        status: { in: ["FULFILLED", "DELIVERED", "CANCELLED"] },
        updatedAt: { lte: cutoff },
      },
    },
    include: { registerItem: { select: { id: true } } },
    take: 200,
  });

  for (const addr of shipmentAddresses) {
    await prisma.$transaction([
      prisma.addressAuditSnapshot.create({ data: auditSnapshot(addr, { registerId: null, registerItemId: addr.registerItem.id }) }),
      prisma.shipmentAddress.update({ where: { id: addr.id }, data: { ...BLANKED_FIELDS, redactedAt: now } }),
    ]);
    shipmentRedacted++;
  }

  // ── Job B: Per-register RegisterAddress ─────────────────────────────────────
  // Every saved address not yet blanked is checked against the rules; the
  // decision reads only item states and dates, never the address.
  // Paged through all of them: rows still waiting stay unblanked, so a fixed
  // cap would let them crowd out the rest.
  let after = "";
  for (;;) {
    const savedAddresses = await prisma.registerAddress.findMany({
      where:   { redactedAt: null, id: { gt: after } },
      orderBy: { id: "asc" },
      select: {
        id: true, confirmedAt: true, createdAt: true,
        streetAddress: true, unit: true, city: true, province: true, postalCode: true, country: true,
        register: { select: { id: true, status: true, closedAt: true, updatedAt: true, items: { select: BLANK_ITEM_SELECT } } },
      },
      take: 200,
    });
    if (savedAddresses.length === 0) break;
    after = savedAddresses[savedAddresses.length - 1].id;

    for (const addr of savedAddresses) {
      const d = savedAddressDecision(addr, now);
      if (!d.blank) continue;
      await prisma.$transaction([
        prisma.addressAuditSnapshot.create({ data: auditSnapshot(addr, { registerId: addr.register.id, registerItemId: null }) }),
        // Conditional on still not blanked, so two overlapping runs blank once.
        prisma.registerAddress.updateMany({ where: { id: addr.id, redactedAt: null }, data: { ...BLANKED_FIELDS, redactedAt: now } }),
      ]);
      savedRedacted++;
      savedReasons[d.why] = (savedReasons[d.why] ?? 0) + 1;
    }
  }

  // ── Job C: Finish live-consent withdrawals ──────────────────────────────────
  const switched = await prisma.register.findMany({
    where:  REVERT_CANDIDATE_WHERE,
    select: { id: true },
    take:   200,
  });
  for (const r of switched) {
    if (await prisma.$transaction((tx) => revertLiveAddressSwitch(tx, r.id))) liveReverted++;
  }

  return {
    ok:        true,
    counts:    { shipmentRedacted, savedRedacted, liveReverted },
    savedReasons,
    timestamp: now.toISOString(),
  };
}
