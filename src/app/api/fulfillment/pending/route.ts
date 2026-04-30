import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/fulfillment/pending
 *
 * Returns four lists for the current user:
 * - toConfirm:     PENDING RequestFulfillments where current user is the recipient
 * - toFulfill:     APPROVED requests where current user is the donor and no fulfillment yet
 * - donorSentItems: RequestFulfillments where current user is the donor, status PENDING/DISPUTED
 *                   (lets the donor track items they've sent and see disputes)
 * - allocations:   DELIVERED/DISPATCHED BundleAllocations where current user is the recipient
 */
export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = auth.userId;

  const [toConfirmRaw, toFulfillRaw, donorSentRaw, pendingRequestsRaw, allocations] = await Promise.all([
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

    // Items the user donated that are accepted/approved but not yet marked as sent
    prisma.request.findMany({
      where: {
        status:      { in: ["APPROVED", "ACCEPTED"] },
        fulfillment: null,
        item:        { donorId: userId, status: { notIn: ["REMOVED", "FROZEN"] } },
      },
      include: {
        item:      { select: { id: true, title: true } },
        requester: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { updatedAt: "desc" },
      take:    10,
    }),

    // Items the donor has marked as sent but not yet resolved (PENDING or DISPUTED)
    // This is what the donor sees after marking — shows real fulfillment status, not a blank.
    prisma.requestFulfillment.findMany({
      where: {
        status:  { in: ["PENDING", "DISPUTED"] },
        request: { item: { donorId: userId } },
      },
      include: {
        request: {
          select: {
            id:        true,
            item:      { select: { title: true } },
            requester: { select: { name: true } },
          },
        },
      },
      orderBy: { markedAt: "desc" },
      take:    10,
    }),

    // PENDING requests on donor's items — awaiting donor review
    prisma.request.findMany({
      where: {
        status: "PENDING",
        item:   { donorId: userId },
      },
      include: {
        item:      { select: { id: true, title: true } },
        requester: { select: { id: true, name: true, avatar: true, trustScore: true } },
      },
      orderBy: { createdAt: "desc" },
      take:    20,
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
    requestId:       r.id,
    itemId:          r.item.id,
    itemTitle:       r.item.title,
    requesterName:   r.requester.name,
    requesterAvatar: r.requester.avatar,
    requestedAt:     r.updatedAt.toISOString(),
  }));

  const donorSentItems = donorSentRaw.map((fl) => ({
    requestId:     fl.requestId,
    itemTitle:     fl.request.item.title,
    recipientName: fl.request.requester.name,
    fulfillStatus: fl.status as "PENDING" | "DISPUTED",
    markedAt:      fl.markedAt.toISOString(),
    respondedAt:   fl.respondedAt?.toISOString() ?? null,
  }));

  const pendingRequests = pendingRequestsRaw.map((r) => ({
    requestId:           r.id,
    itemId:              r.item.id,
    itemTitle:           r.item.title,
    requesterId:         r.requester.id,
    requesterName:       r.requester.name,
    requesterAvatar:     r.requester.avatar,
    requesterTrustScore: r.requester.trustScore,
    reasonForRequest:    r.reasonForRequest,
    whoIsItFor:          r.whoIsItFor,
    pickupPreference:    r.pickupPreference,
    pickupCategoryId:    r.pickupCategoryId,
    requestedAt:         r.createdAt.toISOString(),
  }));

  return NextResponse.json({ toConfirm, toFulfill, donorSentItems, allocations, pendingRequests });
}
