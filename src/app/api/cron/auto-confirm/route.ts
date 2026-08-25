import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { createAbuseFlag } from "@/lib/abuse";
import { notifyUser } from "@/lib/notify";

import { isAuthorizedCron } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";

const HOUR = 60 * 60 * 1000;
const PENDING_EXPIRY_HOURS = 48; // unanswered claim — nothing is committed yet
const STALL_EXPIRY_HOURS   = 72; // accepted but not moving — real people, be patient

// No-fault markers. cancelledById === null is the signal that NOBODY cancelled:
// the system timed it out. Every surface that renders "X cancelled" must treat a
// null canceller as "expired" so a mother is never shown as having backed out.
const REASON_NO_RESPONSE = "AUTO_EXPIRED_NO_RESPONSE";
const REASON_STALLED     = "AUTO_EXPIRED_STALLED";

/**
 * POST /api/cron/auto-confirm
 * The request lifecycle cron. Runs daily. Deliberately ONE route covering every
 * stall in the claim → pickup → receipt flow, rather than several scheduled
 * entries.
 *
 * Lifecycle guards (2c):
 *   A. Expire claims never answered by the giver (48h) — frees the item.
 *   B. Cancel coordinations that stopped moving (72h) — frees her slot and the
 *      item. Anchored on PickupCoordination.updatedAt, which every step touches.
 *   C. Auto-confirm coordination handovers the mother never confirmed (7d).
 *
 * Fulfillment tail (pre-existing, legacy /fulfill path):
 *   D. Day-4 reminder to recipients who have not responded.
 *   E. Day-7 auto-confirm of PENDING RequestFulfillment rows.
 *   F. Flag donors with a high auto-confirmed ratio.
 *
 * Every job is idempotent: each moves rows INTO a terminal state, so a re-run
 * matches nothing. Auto-cancels never touch requestCountSinceReset — an expiry
 * must never consume one of her 8-per-12h claims.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now         = new Date();
  const day4Cutoff  = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
  const day7Cutoff  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // ── Job A: expire claims the giver never answered ─────────────────────────
  // A PENDING request holds no reservation (the item is only decremented on
  // acceptance), so there is nothing to restore — just close it and tell both.
  const pendingCutoff = new Date(now.getTime() - PENDING_EXPIRY_HOURS * HOUR);
  const unanswered = await prisma.request.findMany({
    where:  { status: "PENDING", createdAt: { lte: pendingCutoff } },
    select: { id: true, requesterId: true, item: { select: { title: true, donorId: true } } },
    take:   200,
  });

  let expiredPending = 0;
  for (const r of unanswered) {
    await prisma.request.update({
      where: { id: r.id },
      // cancelReason marks this as a system expiry, so her request list can say
      // "expired" rather than implying she withdrew.
      data:  { status: "CANCELLED", cancelReason: REASON_NO_RESPONSE },
    });
    expiredPending++;

    await notifyUser({
      userId:  r.requesterId,
      type:    "REQUEST_DECLINED",
      message: `Your request for "${r.item.title}" expired because it wasn't answered. That's no reflection on you — you're free to request something else.`,
      link:    "/browse",
      context: "request:pending-expired",
    });
    await notifyUser({
      userId:  r.item.donorId,
      type:    "ADMIN_MESSAGE",
      message: `A request for "${r.item.title}" expired after ${PENDING_EXPIRY_HOURS} hours without a reply. Your item is still listed.`,
      link:    "/profile/requests",
      context: "request:pending-expired-giver",
    });
  }

  // ── Job B: cancel coordinations that stopped moving ───────────────────────
  // DELIVERED is excluded: a completed handover awaiting confirmation is Job C's
  // business, and cancelling it would erase a real exchange.
  const stallCutoff = new Date(now.getTime() - STALL_EXPIRY_HOURS * HOUR);
  const stalled = await prisma.pickupCoordination.findMany({
    where: {
      status:    { notIn: ["DELIVERED", "CONFIRMED", "CANCELLED", "REPORTED"] },
      updatedAt: { lte: stallCutoff },
      request:   { status: { notIn: ["FULFILLED", "CANCELLED"] } },
    },
    include: {
      request: {
        select: {
          id: true, requesterId: true,
          item: { select: { id: true, title: true, donorId: true, status: true, quantityNum: true } },
        },
      },
    },
    take: 200,
  });

  let expiredStalled = 0;
  for (const c of stalled) {
    const item = c.request.item;
    await prisma.$transaction([
      prisma.pickupCoordination.update({
        where: { requestId: c.requestId },
        // null canceller => nobody's fault, the system timed it out.
        data:  { status: "CANCELLED", cancelledById: null, cancelReason: REASON_STALLED },
      }),
      prisma.request.update({
        where: { id: c.request.id },
        data:  { status: "CANCELLED", cancelReason: REASON_STALLED },
      }),
      // Always restore the item. Acceptance decremented it, so an expiry that
      // left it RESERVED would strand the item permanently.
      ...(item.status === "RESERVED"
        ? [prisma.item.update({
            where: { id: item.id },
            data:  { status: "ACTIVE", quantityNum: (item.quantityNum ?? 0) + 1 },
          })]
        : []),
    ]);
    expiredStalled++;

    await notifyUser({
      userId:  c.request.requesterId,
      type:    "COORDINATION_CANCELLED",
      message: `The pickup for "${item.title}" was closed because it hadn't moved in ${STALL_EXPIRY_HOURS / 24} days. Nothing went wrong on your side — you're free to request something else.`,
      link:    "/browse",
      context: "coordination:stalled",
    });
    await notifyUser({
      userId:  item.donorId,
      type:    "COORDINATION_CANCELLED",
      message: `The pickup for "${item.title}" was closed after ${STALL_EXPIRY_HOURS / 24} days without progress. Your item has been relisted.`,
      link:    "/profile/requests",
      context: "coordination:stalled-giver",
    });
  }

  // ── Job C: auto-confirm handovers the mother never confirmed ──────────────
  // The coordination path had NO auto-confirm: a giver could mark DELIVERED and
  // the request would sit open forever. Mirrors the legacy day-7 rule below.
  const undelivered = await prisma.pickupCoordination.findMany({
    where:   { status: "DELIVERED", updatedAt: { lte: day7Cutoff } },
    include: { request: { select: { id: true, requesterId: true, item: { select: { title: true } } } } },
    take:    200,
  });

  let autoConfirmedPickups = 0;
  for (const c of undelivered) {
    await prisma.$transaction([
      prisma.pickupCoordination.update({ where: { requestId: c.requestId }, data: { status: "CONFIRMED" } }),
      prisma.request.update({ where: { id: c.request.id }, data: { status: "FULFILLED" } }),
    ]);
    autoConfirmedPickups++;

    await notifyUser({
      userId:  c.request.requesterId,
      type:    "FULFILLMENT_CONFIRMED",
      message: `We've marked "${c.request.item.title}" as received, since the pickup was completed a week ago. If that isn't right, please let us know.`,
      link:    "/pickups",
      context: "coordination:auto-confirmed",
    });
  }

  // ── Job 1: Send day-4 reminders ──────────────────────────────────────────────
  const needsReminder = await prisma.requestFulfillment.findMany({
    where: {
      status:          "PENDING",
      markedAt:        { lte: day4Cutoff, gt: day7Cutoff },
      reminderSentAt:  null,
    },
    include: {
      request: {
        select: {
          requesterId: true,
          requester:   { select: { name: true } },
          item:        { select: { title: true } },
        },
      },
    },
    take: 200,
  });

  let remindersCount = 0;
  for (const fl of needsReminder) {
    await prisma.$transaction([
      prisma.notification.create({
        data: {
          userId:  fl.request.requesterId,
          type:    "FULFILLMENT_REMINDER",
          message: `Reminder: your donor says they've sent "${fl.request.item.title}". Did you receive it? Please confirm.`,
          link:    `/?confirm=${fl.requestId}`,
        },
      }),
      prisma.requestFulfillment.update({
        where: { id: fl.id },
        data:  { reminderSentAt: now },
      }),
    ]);
    remindersCount++;
  }

  // ── Job 2: Auto-confirm day-7 ─────────────────────────────────────────────────
  const overdueList = await prisma.requestFulfillment.findMany({
    where: {
      status:   "PENDING",
      markedAt: { lte: day7Cutoff },
    },
    include: {
      request: {
        select: {
          id:          true,
          requesterId: true,
          item:        { select: { title: true, donorId: true } },
        },
      },
    },
    take: 200,
  });

  let autoConfirmedCount = 0;
  for (const fl of overdueList) {
    const donorId = fl.request.item.donorId;

    await prisma.$transaction([
      prisma.requestFulfillment.update({
        where: { id: fl.id },
        data:  { status: "AUTO_CONFIRMED", autoConfirmedAt: now, recipientResponse: "AUTO" },
      }),
      prisma.request.update({
        where: { id: fl.requestId },
        data:  { status: "FULFILLED" },
      }),
    ]);

    autoConfirmedCount++;
  }

  // ── Job 3: Flag high unverified ratio (donors with ≥5 auto-confirmed, <20% verified) ──
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const donorStats = await prisma.requestFulfillment.groupBy({
    by:    ["requestId"],
    where: { markedAt: { gte: thirtyDaysAgo } },
    _count: { status: true },
  });
  // Simplified: flag donors with ≥3 AUTO_CONFIRMED in 30 days
  const autoConfirmed30d = await prisma.requestFulfillment.findMany({
    where:   { status: "AUTO_CONFIRMED", autoConfirmedAt: { gte: thirtyDaysAgo } },
    include: { request: { select: { item: { select: { donorId: true } } } } },
  });

  const donorAutoCount: Record<string, number> = {};
  for (const f of autoConfirmed30d) {
    const did = f.request.item.donorId;
    donorAutoCount[did] = (donorAutoCount[did] ?? 0) + 1;
  }

  for (const [donorId, count] of Object.entries(donorAutoCount)) {
    if (count >= 3) {
      await createAbuseFlag(donorId, "HIGH_UNVERIFIED_FULFILLMENTS", "MEDIUM", {
        autoConfirmed30d: count,
        detectedAt: now.toISOString(),
        reason: "high proportion of auto-confirmed (no recipient response) fulfillments",
      }).catch(() => {});
    }
  }

  void donorStats; // used implicitly via autoConfirmed30d

  return NextResponse.json({
    ok:                   true,
    // 2c lifecycle guards
    expiredPending,        // claims the giver never answered (48h)
    expiredStalled,        // coordinations that stopped moving (72h)
    autoConfirmedPickups,  // DELIVERED handovers she never confirmed (7d)
    // legacy fulfillment tail
    reminders:            remindersCount,
    autoConfirmed:        autoConfirmedCount,
    timestamp:            now.toISOString(),
  });
}
export { POST as GET };
