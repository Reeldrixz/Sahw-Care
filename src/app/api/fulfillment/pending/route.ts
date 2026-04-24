import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/fulfillment/pending
 *
 * Returns two lists for the current user:
 * - toConfirm:  PENDING RequestFulfillments where current user is the recipient
 * - toFulfill:  APPROVED requests where current user is the donor and no fulfillment yet
 * - allocations: DELIVERED BundleAllocations where current user is the recipient (CONFIRMED status excluded)
 */
export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = auth.userId;

  const [toConfirmRaw, toFulfillRaw, allocations] = await Promise.all([
    // Items the user requested that the donor has marked as sent
    prisma.requestFulfillment.findMany({
      where: {
        status:  "PENDING",
        request: { requesterId: userId },
      },
      include: {
        request: {
          select: {
            id:    true,
            item:  { select: { title: true, donor: { select: { name: true } } } },
          },
        },
      },
      orderBy: { markedAt: "asc" },
      take:    10,
    }),

    // Items the user donated that are approved but not yet marked as sent
    prisma.request.findMany({
      where: {
        status:      "APPROVED",
        fulfillment: null,
        item:        { donorId: userId },
      },
      include: {
        item:      { select: { id: true, title: true } },
        requester: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { updatedAt: "desc" },
      take:    10,
    }),

    // Bundle allocations awaiting recipient confirmation
    prisma.bundleAllocation.findMany({
      where: {
        recipientId: userId,
        status:      { in: ["DELIVERED", "DISPATCHED"] },
      },
      include: {
        goal: { select: { month: true } },
      },
      orderBy: { allocatedAt: "desc" },
      take:    5,
    }),
  ]);

  const toConfirm = toConfirmRaw.map((fl) => ({
    requestId:     fl.requestId,
    itemTitle:     fl.request.item.title,
    donorName:     fl.request.item.donor.name,
    donorNote:     fl.donorNote,
    donorPhotoUrl: fl.donorPhotoUrl,
    markedAt:      fl.markedAt.toISOString(),
  }));

  const toFulfill = toFulfillRaw.map((r) => ({
    requestId:     r.id,
    itemId:        r.item.id,
    itemTitle:     r.item.title,
    requesterName: r.requester.name,
    requesterAvatar: r.requester.avatar,
    requestedAt:   r.updatedAt.toISOString(),
  }));

  return NextResponse.json({ toConfirm, toFulfill, allocations });
}
