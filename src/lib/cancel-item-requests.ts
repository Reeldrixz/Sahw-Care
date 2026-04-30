import { prisma } from "@/lib/prisma";

/**
 * Cancels all PENDING/ACCEPTED requests for an item and any linked
 * PickupCoordinations. Fires item-unavailable notifications to affected
 * recipients. Called whenever an item is set to REMOVED (admin or owner).
 */
export async function cancelActiveRequestsForItem(
  itemId: string,
  itemTitle: string,
  cancelReason: string,
  cancelledById: string | null = null,
): Promise<void> {
  const activeRequests = await prisma.request.findMany({
    where: { itemId, status: { in: ["PENDING", "ACCEPTED"] } },
    select: { id: true, requesterId: true },
  });
  if (activeRequests.length === 0) return;

  const requestIds = activeRequests.map((r) => r.id);

  await prisma.$transaction([
    prisma.request.updateMany({
      where: { id: { in: requestIds } },
      data: { status: "CANCELLED" },
    }),
    prisma.pickupCoordination.updateMany({
      where: { requestId: { in: requestIds } },
      data: { status: "CANCELLED", cancelReason, cancelledById },
    }),
  ]);

  for (const req of activeRequests) {
    prisma.notification.create({
      data: {
        userId:            req.requesterId,
        type:              "REQUEST_RECEIVED",
        title:             "Item no longer available",
        message:           `An item you requested (${itemTitle}) is no longer available. Browse Discover to find similar items.`,
        link:              "/",
        triggeredByUserId: null,
      },
    }).catch(() => {});
  }
}
