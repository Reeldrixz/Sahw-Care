import { prisma } from "@/lib/prisma";

// How many discover requests in the last N days
export async function getRequestCount(userId: string, days: number): Promise<number> {
  const since = new Date(Date.now() - days * 86400000);
  return prisma.abuseEventLog.count({
    where: { userId, eventType: "DISCOVER_REQUEST_CREATED", timestamp: { gte: since } },
  });
}

// Time from signup to first discover request (in hours), or null if no request yet
export async function getTimeToFirstRequest(userId: string): Promise<number | null> {
  const [user, firstRequest] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.abuseEventLog.findFirst({
      where:   { userId, eventType: "DISCOVER_REQUEST_CREATED" },
      orderBy: { timestamp: "asc" },
      select:  { timestamp: true },
    }),
  ]);
  if (!user || !firstRequest) return null;
  return (firstRequest.timestamp.getTime() - user.createdAt.getTime()) / 3600000;
}

// Engagement ratio: (posts + comments) vs requests
export async function getEngagementRatio(userId: string): Promise<{
  posts: number; comments: number; requests: number; ratio: string;
}> {
  const counts = await prisma.abuseEventLog.groupBy({
    by:    ["eventType"],
    where: { userId, eventType: { in: ["CIRCLE_POST_CREATED", "INTRO_POST_CREATED", "COMMENT_CREATED", "DISCOVER_REQUEST_CREATED"] } },
    _count: { eventType: true },
  });
  const map = Object.fromEntries(counts.map(c => [c.eventType, c._count.eventType]));
  const posts    = (map["CIRCLE_POST_CREATED"] ?? 0) + (map["INTRO_POST_CREATED"] ?? 0);
  const comments = map["COMMENT_CREATED"] ?? 0;
  const requests = map["DISCOVER_REQUEST_CREATED"] ?? 0;
  const engagement = posts + comments;
  const ratio = requests === 0 ? "0:0" : engagement === 0 ? `∞` : `${requests}:${engagement}`;
  return { posts, comments, requests, ratio };
}

// Urgent override count in the last 30 days
export async function getRecentOverrideCount(userId: string): Promise<number> {
  return prisma.urgentOverride.count({
    where: { userId, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
  });
}

// How many days from signup to reach a trust score threshold (null if not reached)
export async function getDaysToReachThreshold(userId: string, threshold: number): Promise<number | null> {
  const [user, firstCrossing] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    prisma.trustScoreHistory.findFirst({
      where:   { userId, newScore: { gte: threshold } },
      orderBy: { createdAt: "asc" },
      select:  { createdAt: true },
    }),
  ]);
  if (!user || !firstCrossing) return null;
  return (firstCrossing.createdAt.getTime() - user.createdAt.getTime()) / 86400000;
}

// All open abuse flags for a user
export async function getUserAbuseFlags(userId: string) {
  return prisma.abuseFlag.findMany({
    where:   { userId },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
  });
}

// Users with open HIGH severity flags
export async function getHighSeverityFlaggedUsers() {
  const flags = await prisma.abuseFlag.findMany({
    where:   { status: "OPEN", severity: "HIGH" },
    include: { user: { select: { id: true, name: true, email: true, trustScore: true, createdAt: true } } },
    orderBy: { createdAt: "desc" },
    distinct: ["userId"],
  });
  return flags;
}

// Users whose trust score dropped below a threshold in the last N days
export async function getUsersDroppedBelowThreshold(threshold: number, days: number) {
  const since = new Date(Date.now() - days * 86400000);
  const history = await prisma.trustScoreHistory.findMany({
    where:   { oldScore: { gte: threshold }, newScore: { lt: threshold }, createdAt: { gte: since } },
    include: { user: { select: { id: true, name: true, email: true, trustScore: true } } },
    orderBy: { createdAt: "desc" },
    distinct: ["userId"],
  });
  return history;
}

// Users whose trust score rose 20+ points in under 5 days (rapid trust farming)
export async function getRapidTrustFarmers() {
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000);

  // Aggregate net delta per user over last 5 days
  const gains = await prisma.trustScoreHistory.groupBy({
    by:     ["userId"],
    where:  { createdAt: { gte: fiveDaysAgo }, delta: { gt: 0 } },
    _sum:   { delta: true },
    having: { delta: { _sum: { gte: 20 } } },
  });

  if (gains.length === 0) return [];

  const users = await prisma.user.findMany({
    where:  { id: { in: gains.map(g => g.userId) } },
    select: { id: true, name: true, email: true, trustScore: true },
  });

  return users.map(u => ({
    ...u,
    pointsGainedIn5d: gains.find(g => g.userId === u.id)?._sum.delta ?? 0,
  }));
}

// All open flags sorted by severity then date, with optional filters
export async function getAllOpenFlags(opts?: { status?: string; severity?: string }) {
  return prisma.abuseFlag.findMany({
    where: {
      ...(opts?.status   ? { status:   opts.status   as never } : { status: "OPEN" }),
      ...(opts?.severity ? { severity: opts.severity as never } : {}),
    },
    include: { user: { select: { id: true, name: true, email: true, trustScore: true, createdAt: true } } },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
  });
}

// Users with 2+ open flags or 1+ HIGH flag
export async function getRiskyUsers() {
  const openFlags = await prisma.abuseFlag.findMany({
    where:  { status: "OPEN" },
    select: { userId: true, severity: true, flagType: true, createdAt: true },
  });

  const userMap = new Map<string, { count: number; hasHigh: boolean; lastFlagged: Date; flagTypes: string[] }>();
  for (const f of openFlags) {
    const existing = userMap.get(f.userId) ?? { count: 0, hasHigh: false, lastFlagged: new Date(0), flagTypes: [] };
    existing.count += 1;
    if (f.severity === "HIGH") existing.hasHigh = true;
    if (f.createdAt > existing.lastFlagged) existing.lastFlagged = f.createdAt;
    existing.flagTypes.push(f.flagType);
    userMap.set(f.userId, existing);
  }

  const riskyUserIds = [...userMap.entries()]
    .filter(([, v]) => v.count >= 2 || v.hasHigh)
    .map(([id]) => id);

  if (riskyUserIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where:  { id: { in: riskyUserIds } },
    select: { id: true, name: true, email: true, phone: true, trustScore: true, createdAt: true, status: true },
  });

  return users
    .map(u => ({
      ...u,
      flagCount:   userMap.get(u.id)?.count ?? 0,
      hasHighFlag: userMap.get(u.id)?.hasHigh ?? false,
      lastFlagged: userMap.get(u.id)?.lastFlagged ?? null,
      flagTypes:   userMap.get(u.id)?.flagTypes ?? [],
    }))
    .sort((a, b) => {
      if (a.hasHighFlag !== b.hasHighFlag) return a.hasHighFlag ? -1 : 1;
      return b.flagCount - a.flagCount;
    });
}
