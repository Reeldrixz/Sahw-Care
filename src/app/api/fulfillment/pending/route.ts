import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ── Fair circulation ────────────────────────────────────────────────────────
// Mothers who have received less recently are surfaced first in a giver's list
// of incoming requests. This is a thumb on the scale, NOT an allocation: the
// giver still chooses freely, and the ordering is the whole mechanism.
//
// The received-count is a SORT KEY ONLY and must never reach the giver. Ranking
// claimants by need in a face-to-face exchange would turn the handover into a
// pity-pick and expose the mother in exactly the moment we are protecting. The
// response map below is an explicit allowlist, so the count cannot leak by
// accident — a leak would require someone to deliberately add the field.
//
// Computed live (a groupBy over just the ids in the current list) rather than
// kept as a denormalised counter, matching the formula capacity ledger: a stored
// counter drifts, and this one would drift silently and unfairly.
const FAIR_WINDOW_DAYS = 90; // rolling — fairness resets, no permanent penalty
const FAIR_FETCH_CAP   = 100; // fetch ceiling before weighting
const FAIR_SHOW_LIMIT  = 10;  // what the giver actually sees

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
      // Fetch a wider window than we show, because the real ordering is the fair
      // circulation weighting applied below — slicing to 10 on a time sort first
      // would truncate exactly the mothers the weighting exists to surface.
      // createdAt asc makes this base slice deterministic; the ceiling keeps the
      // query bounded if a giver ever accumulates a pathological number of claims.
      orderBy: { createdAt: "asc" },
      take:    FAIR_FETCH_CAP,
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

  // ── Fair circulation weighting ────────────────────────────────────────────
  // One groupBy over only the requesters already in this list: how many gifts
  // has each actually received in the trailing window? FULFILLED is the terminal
  // success state (CONFIRMED is dead — see RequestStatus). Request has no
  // fulfilledAt, so updatedAt stands in for "when it completed": imperfect if a
  // row is touched later, accepted deliberately rather than adding a column.
  const requesterIds = [...new Set(pendingRequestsRaw.map((r) => r.requester.id))];
  const windowStart  = new Date(Date.now() - FAIR_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const recentReceipts = requesterIds.length
    ? await prisma.request.groupBy({
        by:     ["requesterId"],
        where:  {
          requesterId: { in: requesterIds },
          status:      "FULFILLED",
          updatedAt:   { gte: windowStart },
        },
        _count: { _all: true },
      })
    : [];

  const receiptCount = new Map(recentReceipts.map((g) => [g.requesterId, g._count._all]));

  const weighted = [...pendingRequestsRaw].sort((a, b) => {
    // Fewest recent receipts first; absent from the map means zero, which is the
    // strongest claim. Longest-waiting wins ties, so fairness compounds rather
    // than resetting each time a new request arrives.
    const diff = (receiptCount.get(a.requester.id) ?? 0) - (receiptCount.get(b.requester.id) ?? 0);
    return diff !== 0 ? diff : a.createdAt.getTime() - b.createdAt.getTime();
  }).slice(0, FAIR_SHOW_LIMIT);

  // NOTE: this map is an allowlist. The receipt count is deliberately absent and
  // must stay absent — it is a sort key, never something the giver can see.
  const pendingRequests = weighted.map((r) => ({
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
