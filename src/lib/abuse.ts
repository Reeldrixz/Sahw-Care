import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { AbuseEventType, AbuseFlagType, Severity } from "@prisma/client";

// ── Log a platform event ──────────────────────────────────────────────────────

export async function logAbuseEvent(
  userId: string,
  eventType: AbuseEventType,
  trustScore: number,
  metadata: Record<string, unknown>,
  req?: NextRequest,
): Promise<void> {
  try {
    const ipAddress = req
      ? (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null)
      : null;

    await prisma.abuseEventLog.create({
      data: { userId, eventType, trustScore, metadata: metadata as never, ipAddress },
    });
  } catch {
    // Never throw — abuse logging must never break user flows
  }
}

// ── Create a silent abuse flag ────────────────────────────────────────────────

export async function createAbuseFlag(
  userId: string,
  flagType: AbuseFlagType,
  severity: Severity,
  evidence: Record<string, unknown>,
): Promise<void> {
  try {
    // Don't duplicate open flags of the same type
    const existing = await prisma.abuseFlag.findFirst({
      where: { userId, flagType, status: "OPEN" },
    });
    if (existing) return;

    await prisma.abuseFlag.create({
      data: { userId, flagType, severity, evidence: evidence as never },
    });
  } catch {
    // Never throw
  }
}

// ── Detection checks ──────────────────────────────────────────────────────────

export async function runAbuseChecks(userId: string): Promise<void> {
  try {
    const [user, reqs7d, reqs30d, urgentOverrides30d, allAbuseEvents, allRequests] = await Promise.all([
      prisma.user.findUnique({
        where:  { id: userId },
        select: { id: true, createdAt: true, trustScore: true, bundleRestrictedUntil: true },
      }),
      // Discover requests in last 7 days
      prisma.abuseEventLog.count({
        where: { userId, eventType: "DISCOVER_REQUEST_CREATED", timestamp: { gte: new Date(Date.now() - 7 * 86400000) } },
      }),
      // Discover requests in last 30 days
      prisma.abuseEventLog.count({
        where: { userId, eventType: "DISCOVER_REQUEST_CREATED", timestamp: { gte: new Date(Date.now() - 30 * 86400000) } },
      }),
      // Urgent overrides in last 30 days
      prisma.urgentOverride.count({
        where: { userId, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      }),
      // All event counts for engagement ratio
      prisma.abuseEventLog.groupBy({
        by:    ["eventType"],
        where: { userId },
        _count: { eventType: true },
      }),
      // All discover requests for first-request timing
      prisma.abuseEventLog.findFirst({
        where:   { userId, eventType: "DISCOVER_REQUEST_CREATED" },
        orderBy: { timestamp: "asc" },
      }),
    ]);

    if (!user) return;

    // ── TOO_MANY_REQUESTS_SHORT_WINDOW ────────────────────────────────────────
    if (reqs7d >= 8) {
      await createAbuseFlag(userId, "TOO_MANY_REQUESTS_SHORT_WINDOW", "HIGH", {
        requestsIn7d: reqs7d, requestsIn30d: reqs30d, threshold7d: 8,
      });
    } else if (reqs7d >= 4) {
      await createAbuseFlag(userId, "TOO_MANY_REQUESTS_SHORT_WINDOW", "MEDIUM", {
        requestsIn7d: reqs7d, requestsIn30d: reqs30d, threshold7d: 4,
      });
    }

    // ── NEW_ACCOUNT_REQUESTING_TOO_FAST ───────────────────────────────────────
    if (allRequests) {
      const accountAgeMsAtFirstRequest = allRequests.timestamp.getTime() - user.createdAt.getTime();
      const accountAgeHrsAtFirstRequest = accountAgeMsAtFirstRequest / 3600000;

      if (accountAgeHrsAtFirstRequest < 1) {
        await createAbuseFlag(userId, "NEW_ACCOUNT_REQUESTING_TOO_FAST", "HIGH", {
          accountAgeHoursAtFirstRequest: parseFloat(accountAgeHrsAtFirstRequest.toFixed(2)),
          firstRequestAt: allRequests.timestamp,
          signupAt: user.createdAt,
        });
      } else if (accountAgeHrsAtFirstRequest < 24) {
        await createAbuseFlag(userId, "NEW_ACCOUNT_REQUESTING_TOO_FAST", "MEDIUM", {
          accountAgeHoursAtFirstRequest: parseFloat(accountAgeHrsAtFirstRequest.toFixed(2)),
          firstRequestAt: allRequests.timestamp,
          signupAt: user.createdAt,
        });
      }
    }

    // ── HIGH_REQUEST_LOW_ENGAGEMENT ───────────────────────────────────────────
    const countMap = Object.fromEntries(allAbuseEvents.map(e => [e.eventType, e._count.eventType]));
    const totalPosts    = (countMap["CIRCLE_POST_CREATED"] ?? 0) + (countMap["INTRO_POST_CREATED"] ?? 0);
    const totalComments = countMap["COMMENT_CREATED"] ?? 0;
    const totalRequests = countMap["DISCOVER_REQUEST_CREATED"] ?? 0;
    const engagement = totalPosts + totalComments;

    if (totalRequests > 0 && (engagement === 0 || totalRequests > engagement * 3)) {
      await createAbuseFlag(userId, "HIGH_REQUEST_LOW_ENGAGEMENT", "MEDIUM", {
        totalRequests, totalPosts, totalComments, engagementTotal: engagement,
        ratio: engagement === 0 ? "∞" : (totalRequests / engagement).toFixed(2),
      });
    }

    // ── REPEATED_URGENT_OVERRIDE ──────────────────────────────────────────────
    if (urgentOverrides30d >= 3) {
      await createAbuseFlag(userId, "REPEATED_URGENT_OVERRIDE", "HIGH", {
        overridesIn30d: urgentOverrides30d, threshold: 3,
      });
    } else if (urgentOverrides30d >= 2) {
      await createAbuseFlag(userId, "REPEATED_URGENT_OVERRIDE", "MEDIUM", {
        overridesIn30d: urgentOverrides30d, threshold: 2,
      });
    }

    // ── TRUST_SCORE_RECOVERY_SPAM ─────────────────────────────────────────────
    // Find if score dropped below 60 then recovered above 60 within 5 days
    const recentHistory = await prisma.trustScoreHistory.findMany({
      where:   { userId, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      orderBy: { createdAt: "asc" },
    });

    let droppedBelow60At: Date | null = null;
    for (const h of recentHistory) {
      if (h.oldScore >= 60 && h.newScore < 60) {
        droppedBelow60At = h.createdAt;
      }
      if (droppedBelow60At && h.newScore >= 60) {
        const recoveryMs = h.createdAt.getTime() - droppedBelow60At.getTime();
        const recoveryDays = recoveryMs / 86400000;
        if (recoveryDays <= 5) {
          await createAbuseFlag(userId, "TRUST_SCORE_RECOVERY_SPAM", "MEDIUM", {
            droppedBelow60At,
            recoveredAbove60At: h.createdAt,
            recoveryDays: parseFloat(recoveryDays.toFixed(2)),
          });
        }
        droppedBelow60At = null;
      }
    }

    // ── REPEATED_BUNDLE_ATTEMPTS ──────────────────────────────────────────────
    if (user.bundleRestrictedUntil) {
      const bundleAttemptsWhileRestricted = await prisma.abuseEventLog.count({
        where: { userId, eventType: "BUNDLE_REQUESTED" },
      });
      if (bundleAttemptsWhileRestricted >= 3) {
        await createAbuseFlag(userId, "REPEATED_BUNDLE_ATTEMPTS", "HIGH", {
          bundleAttempts: bundleAttemptsWhileRestricted,
          bundleRestrictedUntil: user.bundleRestrictedUntil,
        });
      }
    }

  } catch {
    // Never throw
  }
}
