import { Prisma } from "@prisma/client";
import { isItemFunded } from "@/lib/eventProgress";

// Confirming a shipping address (ASK_PER_SHIPMENT registers).
//
// ONE CONFIRMATION COVERS EVERYTHING WAITING. Each funded item of an
// ASK_PER_SHIPMENT register waits in AWAITING_ADDRESS until the mother gives an
// address. She gives it once, so it applies to EVERY funded item waiting
// across all of her registers, not just the one she tapped. Each gets its own
// ShipmentAddress copy (the model is per item, and admins edit them per
// item), moves to AWAITING_PURCHASE / IN_FULFILLMENT, and gets a QUEUED
// fulfilment row.
//
// Before this, the route moved only the item in the URL, so the rest stayed in
// Awaiting address, kept getting reminders, and were refunded by the
// address-timeout cron after 14 days.

export type AddressFields = {
  fullName: string; streetAddress: string; unit: string | null;
  city: string; province: string; postalCode: string; phone: string;
};

export type ConfirmedItem = { id: string; name: string; registerId: string };

// opts.registerId limits it to one register (the live-feature card confirms
// that register's saved address).
export async function confirmAddressForMother(
  tx: Prisma.TransactionClient, motherId: string, address: AddressFields, opts: { registerId?: string } = {},
): Promise<ConfirmedItem[]> {
  const waiting = await tx.registerItem.findMany({
    where:   { status: "AWAITING_ADDRESS", register: { creatorId: motherId }, ...(opts.registerId && { registerId: opts.registerId }) },
    orderBy: [{ registerId: "asc" }, { createdAt: "asc" }],
    select:  {
      id: true, name: true, registerId: true,
      standardPriceCents: true, totalFundedCents: true, fundingStatus: true,
      fulfillmentQueue: { select: { id: true } },
    },
  });
  const funded = waiting.filter((i) => isItemFunded(i));
  if (funded.length === 0) return [];
  const ids = funded.map((i) => i.id);

  // Conditional on the status, so a concurrent confirmation (two tabs, a
  // double tap) moves each item once; whichever runs second finds none left.
  const moved = await tx.registerItem.updateMany({
    where: { id: { in: ids }, status: "AWAITING_ADDRESS" },
    data:  { status: "AWAITING_PURCHASE", fundingStatus: "IN_FULFILLMENT" },
  });
  if (moved.count !== ids.length) throw new Error("ADDRESS_RACE");

  for (const i of funded) {
    await tx.shipmentAddress.upsert({
      where:  { registerItemId: i.id },
      create: { registerItemId: i.id, ...address },
      update: { ...address },
    });
  }
  await tx.fulfillmentQueue.createMany({
    data: funded.filter((i) => !i.fulfillmentQueue).map((i) => ({
      registerItemId: i.id, totalFundedCents: i.totalFundedCents, status: "QUEUED" as const,
    })),
    skipDuplicates: true,
  });
  return funded.map((i) => ({ id: i.id, name: i.name, registerId: i.registerId }));
}
