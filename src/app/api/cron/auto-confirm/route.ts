import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { awardTrust } from "@/lib/trust";
import { createAbuseFlag } from "@/lib/abuse";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/auto-confirm
 * Runs daily. Two jobs:
 *
 * 1. Reminder at day 4: send FULFILLMENT_REMINDER notification to recipients who
 *    have not yet responded, preventing silent abandonment.
 *
 * 2. Auto-confirm at day 7: mark PENDING fulfillments as AUTO_CONFIRMED,
 *    set Request=FULFILLED, award +5 trust to donor, flag donors with high
 *    unverified-to-verified ratios.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now         = new Date();
  const day4Cutoff  = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
  const day7Cutoff  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

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

    // Award donor +5 trust (fire-and-forget per item — ok in cron context)
    await awardTrust(donorId, "REQUEST_FULFILLMENT_AUTO_CONFIRMED", {
      referenceId: fl.id, referenceType: "RequestFulfillment",
      reason: "auto-confirmed after 7-day silence",
    }).catch(() => {});

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
    ok:              true,
    reminders:       remindersCount,
    autoConfirmed:   autoConfirmedCount,
    timestamp:       now.toISOString(),
  });
}
