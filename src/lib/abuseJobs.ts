import { prisma } from "@/lib/prisma";
import { runAbuseChecks } from "@/lib/abuse";
import { getRapidTrustFarmers, getUsersDroppedBelowThreshold } from "@/lib/abuseQueries";

/**
 * Run abuse checks for all users active in the last 30 days.
 * Intended to be called daily at midnight UTC.
 */
export async function clearExpiredRequestLocks(): Promise<{ cleared: number }> {
  const result = await prisma.user.updateMany({
    where: { activeRequestLockedUntil: { lte: new Date() } },
    data:  { activeRequestLockedUntil: null, requestCountSinceReset: 0 },
  });
  console.log(`[clearExpiredRequestLocks] Cleared ${result.count} expired locks`);
  return { cleared: result.count };
}

export async function dailyAbuseCheck(): Promise<{ checked: number; errors: number; locksCleared?: number }> {
  const since = new Date(Date.now() - 30 * 86400000);

  // Users active in last 30 days (have at least one abuse event log)
  const activeUsers = await prisma.abuseEventLog.findMany({
    where:   { timestamp: { gte: since } },
    select:  { userId: true },
    distinct: ["userId"],
  });

  let checked = 0;
  let errors  = 0;

  for (const { userId } of activeUsers) {
    try {
      await runAbuseChecks(userId);
      checked++;
    } catch {
      errors++;
    }
  }

  const { cleared } = await clearExpiredRequestLocks();
  console.log(`[dailyAbuseCheck] Checked ${checked} users, ${errors} errors, cleared ${cleared} request locks`);
  return { checked, errors, locksCleared: cleared };
}

/**
 * Generate a weekly abuse summary.
 * Intended to be called Sunday midnight UTC.
 */
export async function weeklyAbuseSummary(): Promise<void> {
  const now       = new Date();
  const weekEnd   = new Date(now); weekEnd.setHours(23, 59, 59, 999);
  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7); weekStart.setHours(0, 0, 0, 0);

  const [flags, flagsByType, droppedUsers, farmers, topCategories] = await Promise.all([
    // All flags created this week
    prisma.abuseFlag.findMany({
      where:  { createdAt: { gte: weekStart, lte: weekEnd } },
      select: { severity: true, flagType: true },
    }),
    // Flags grouped by type
    prisma.abuseFlag.groupBy({
      by:     ["flagType"],
      where:  { createdAt: { gte: weekStart, lte: weekEnd } },
      _count: { flagType: true },
      orderBy: { _count: { flagType: "desc" } },
    }),
    getUsersDroppedBelowThreshold(60, 7),
    getRapidTrustFarmers(),
    // Top requested item categories this week
    prisma.item.groupBy({
      by:     ["category"],
      where:  { requests: { some: { createdAt: { gte: weekStart } } } },
      _count: { category: true },
      orderBy: { _count: { category: "desc" } },
      take: 5,
    }),
  ]);

  const highSeverityFlags = flags.filter(f => f.severity === "HIGH").length;
  const topFlagTypes      = flagsByType.slice(0, 5).map(f => ({ type: f.flagType, count: f._count.flagType }));
  const topCategories5    = topCategories.map(c => ({ category: c.category, count: c._count.category }));

  await prisma.weeklyAbuseSummary.create({
    data: {
      weekStart,
      weekEnd,
      totalFlags:            flags.length,
      highSeverityFlags,
      topFlagTypes,
      usersDroppedBelow60:   droppedUsers.length,
      rapidTrustFarmers:     farmers.length,
      topRequestedCategories: topCategories5,
    },
  });

  console.log(`[weeklyAbuseSummary] Week ${weekStart.toISOString()} → ${weekEnd.toISOString()}: ${flags.length} flags, ${highSeverityFlags} HIGH`);
}
