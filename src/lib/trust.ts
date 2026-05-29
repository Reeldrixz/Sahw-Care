import { prisma } from "@/lib/prisma";

// ── Tiers ─────────────────────────────────────────────────────────────────────

export const TRUST_TIERS = {
  RESTRICTED:  { min:  0, max: 24,  label: "New member" },
  BASIC:       { min: 25, max: 49,  label: "Verified member" },
  VERIFIED:    { min: 50, max: 69,  label: "Verified member" },
  TRUSTED:     { min: 70, max: 84,  label: "Established member" },
  ESTABLISHED: { min: 85, max: 100, label: "Established member" },
} as const;

export function getTier(score: number) {
  if (score >= 85) return TRUST_TIERS.ESTABLISHED;
  if (score >= 70) return TRUST_TIERS.TRUSTED;
  if (score >= 50) return TRUST_TIERS.VERIFIED;
  if (score >= 25) return TRUST_TIERS.BASIC;
  return TRUST_TIERS.RESTRICTED;
}

// Legacy thresholds kept for call sites that import TRUST_THRESHOLDS
export const TRUST_THRESHOLDS = {
  MARKETPLACE: 25,
  BUNDLES:     85,
  HIGH:        70,
  NORMAL:      25,
};

// ── Event points table ────────────────────────────────────────────────────────

export const EVENT_POINTS: Record<string, number> = {
  // Verification (40 pt category cap)
  EMAIL_VERIFIED:       5,
  PHONE_VERIFIED:       5,
  DOC_VERIFIED:        15,
  ADDRESS_CONFIRMED:    5,
  IDENTITY_CONFIRMED:   5,
  TRUSTED_ORG_VERIFIED: 10,
  // Verification penalties (no cap)
  VERIFICATION_FAILED:  -10,
  FAKE_DOCUMENT:        -40,
  MULTIPLE_ACCOUNTS:    -30,
  // Engagement (20 pt category cap + 5 pt/day)
  PROFILE_COMPLETED: 3,
  CIRCLE_JOIN:       2,
  HELPFUL_POST:      1,
  CIRCLE_POST:       1,
  CIRCLE_REPLY:      1,
  WEEKLY_ACTIVE:     2,
  RESOURCE_READ:     1,
  ADMIN_RESPONSE:    2,
  // Engagement penalties (no cap)
  SPAM_POSTING:         -5,
  TOXIC_BEHAVIOR:       -10,
  HARASSMENT_CONFIRMED: -25,
  // Streak (10 pt category cap)
  STREAK_7_DAY:          2,
  STREAK_30_DAY:         5,
  STREAK_MONTHLY_ACTIVE: 3,
  // Account age (10 pt category cap, differential per milestone)
  AGE_1_WEEK:   1,
  AGE_1_MONTH:  2,
  AGE_3_MONTHS: 2,
  AGE_6_MONTHS: 3,
  AGE_1_YEAR:   2,
  // Fulfilment (20 pt category cap)
  SUPPORT_RECEIVED:     2,
  DELIVERY_CONFIRMED:   2,
  POSITIVE_INTERACTION: 3,
  NO_SHOW_AVOIDED:      3,
  SUCCESSFUL_CYCLE:     5,
  TIMELY_COMMUNICATION: 2,
  // Fulfilment penalties (no cap)
  REPEATED_CANCELLATIONS: -5,
  NO_SHOW:               -10,
  ABUSE_CONFIRMED:       -25,
};

// ── Category mapping ──────────────────────────────────────────────────────────

type Category = "verification" | "engagement" | "streak" | "age" | "fulfilment";

const CATEGORY_MAP: Record<string, Category> = {
  EMAIL_VERIFIED: "verification", PHONE_VERIFIED: "verification", DOC_VERIFIED: "verification",
  ADDRESS_CONFIRMED: "verification", IDENTITY_CONFIRMED: "verification", TRUSTED_ORG_VERIFIED: "verification",
  PROFILE_COMPLETED: "engagement", CIRCLE_JOIN: "engagement", HELPFUL_POST: "engagement",
  CIRCLE_POST: "engagement", CIRCLE_REPLY: "engagement", WEEKLY_ACTIVE: "engagement",
  RESOURCE_READ: "engagement", ADMIN_RESPONSE: "engagement",
  STREAK_7_DAY: "streak", STREAK_30_DAY: "streak", STREAK_MONTHLY_ACTIVE: "streak",
  AGE_1_WEEK: "age", AGE_1_MONTH: "age", AGE_3_MONTHS: "age", AGE_6_MONTHS: "age", AGE_1_YEAR: "age",
  SUPPORT_RECEIVED: "fulfilment", DELIVERY_CONFIRMED: "fulfilment", POSITIVE_INTERACTION: "fulfilment",
  NO_SHOW_AVOIDED: "fulfilment", SUCCESSFUL_CYCLE: "fulfilment", TIMELY_COMMUNICATION: "fulfilment",
};

const CATEGORY_CAPS: Record<Category, number> = {
  verification: 40, engagement: 20, streak: 10, age: 10, fulfilment: 20,
};

const DAILY_CAP = 5;

// Engagement events exempt from the per-day cap
const DAILY_CAP_EXEMPT = new Set([
  "PROFILE_COMPLETED", "CIRCLE_JOIN", "WEEKLY_ACTIVE",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCategoryPoints(
  user: { verificationPoints: number; engagementPoints: number; streakPoints: number; agePoints: number; fulfilmentPoints: number },
  cat: Category,
): number {
  if (cat === "verification") return user.verificationPoints;
  if (cat === "engagement")   return user.engagementPoints;
  if (cat === "streak")       return user.streakPoints;
  if (cat === "age")          return user.agePoints;
  return user.fulfilmentPoints;
}

function categoryIncrement(cat: Category, delta: number) {
  if (cat === "verification") return { verificationPoints: { increment: delta } };
  if (cat === "engagement")   return { engagementPoints:   { increment: delta } };
  if (cat === "streak")       return { streakPoints:       { increment: delta } };
  if (cat === "age")          return { agePoints:          { increment: delta } };
  return { fulfilmentPoints: { increment: delta } };
}

// ── Notifications ─────────────────────────────────────────────────────────────

async function fireMilestoneNotif(userId: string, prev: number, next: number): Promise<void> {
  const milestones = [
    { t: 85, msg: "You have priority access to Kradəl support programmes.", link: "/bundles" },
    { t: 70, msg: "You're an established Kradəl member. You'll receive faster support reviews.", link: "/profile" },
    { t: 25, msg: "Your account is now verified. You can create registers and apply for bundles.", link: "/registers" },
  ];
  for (const { t, msg, link } of milestones) {
    if (prev < t && next >= t) {
      await prisma.notification.create({ data: { userId, type: "TRUST_MILESTONE", message: msg, link } }).catch(() => {});
      break;
    }
  }
}

async function fireWarningNotif(userId: string, prev: number, next: number): Promise<void> {
  if (prev >= 25 && next < 25) {
    await prisma.notification.create({
      data: {
        userId, type: "TRUST_WARNING",
        message: "Your account access has been reduced. Contact support if you think this is an error.",
        link: "/profile",
      },
    }).catch(() => {});
  }
}

// ── Core award function ───────────────────────────────────────────────────────

export async function awardTrust(
  userId: string,
  eventType: string,
  opts?: { referenceId?: string; referenceType?: string; reason?: string },
): Promise<number | null> {
  const basePoints = EVENT_POINTS[eventType];
  if (!basePoints || basePoints <= 0) return null;

  const category = CATEGORY_MAP[eventType];
  if (!category) return null;

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      trustScore: true,
      verificationPoints: true, engagementPoints: true,
      streakPoints: true, agePoints: true, fulfilmentPoints: true,
      dailyPointsEarned: true, dailyPointsDate: true,
    },
  });
  if (!user) return null;

  const currentCatPts = getCategoryPoints(user, category);
  const headroom = CATEGORY_CAPS[category] - currentCatPts;
  if (headroom <= 0) return user.trustScore;

  let effectiveDelta = Math.min(basePoints, headroom);

  // Daily cap for engagement events (not exempt ones)
  if (category === "engagement" && !DAILY_CAP_EXEMPT.has(eventType)) {
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const lastDate = user.dailyPointsDate ? new Date(user.dailyPointsDate) : null;
    if (lastDate) lastDate.setHours(0, 0, 0, 0);
    const isToday      = !!lastDate && lastDate.getTime() === today.getTime();
    const dailyEarned  = isToday ? user.dailyPointsEarned : 0;
    if (dailyEarned >= DAILY_CAP) return user.trustScore;
    effectiveDelta = Math.min(effectiveDelta, DAILY_CAP - dailyEarned);
  }

  if (effectiveDelta <= 0) return user.trustScore;

  const prevScore = user.trustScore;
  const newScore  = Math.min(100, prevScore + effectiveDelta);
  const reason    = opts?.reason ?? eventType.replace(/_/g, " ").toLowerCase();

  const dailyUpdate =
    category === "engagement" && !DAILY_CAP_EXEMPT.has(eventType)
      ? { dailyPointsEarned: { increment: effectiveDelta }, dailyPointsDate: new Date() }
      : {};

  await prisma.$transaction([
    prisma.trustScoreLog.create({ data: { userId, eventType, pointsDelta: effectiveDelta, newScore } }),
    prisma.trustScoreHistory.create({ data: { userId, oldScore: prevScore, newScore, delta: effectiveDelta, reason } }),
    prisma.user.update({
      where: { id: userId },
      data: { trustScore: newScore, ...categoryIncrement(category, effectiveDelta), ...dailyUpdate },
    }),
  ]);

  return newScore;
}

// ── Core deduction function ───────────────────────────────────────────────────

export async function deductTrust(
  userId: string,
  eventType: string,
  opts?: { referenceId?: string; referenceType?: string; reason?: string },
): Promise<number | null> {
  const basePoints = EVENT_POINTS[eventType];
  if (basePoints === undefined || basePoints >= 0) return null;

  const absDelta  = Math.abs(basePoints);
  const user      = await prisma.user.findUnique({ where: { id: userId }, select: { trustScore: true } });
  if (!user) return null;

  const prevScore = user.trustScore;
  const newScore  = Math.max(0, prevScore - absDelta);
  const reason    = opts?.reason ?? eventType.replace(/_/g, " ").toLowerCase();

  await prisma.$transaction([
    prisma.trustScoreLog.create({ data: { userId, eventType, pointsDelta: -absDelta, newScore } }),
    prisma.trustScoreHistory.create({ data: { userId, oldScore: prevScore, newScore, delta: -absDelta, reason } }),
    prisma.user.update({ where: { id: userId }, data: { trustScore: newScore } }),
  ]);

  return newScore;
}

// Backwards-compat shim (external callers pass delta explicitly; we ignore it and use EVENT_POINTS)
export async function deductTrustPoints(
  userId: string,
  eventType: string,
  _delta: number,
  opts?: { referenceId?: string; referenceType?: string; reason?: string },
): Promise<number | null> {
  return deductTrust(userId, eventType, opts);
}

// ── Trust summary ─────────────────────────────────────────────────────────────

export async function getTrustSummary(userId: string) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      trustScore: true,
      verificationPoints: true, engagementPoints: true,
      streakPoints: true, agePoints: true, fulfilmentPoints: true,
    },
  });
  if (!user) return null;

  const tier = getTier(user.trustScore);
  const tierName = (Object.entries(TRUST_TIERS).find(([, v]) => v === tier)?.[0] ?? "RESTRICTED") as string;

  return {
    score: user.trustScore,
    tier:  tierName,
    label: tier.label,
    categoryBreakdown: {
      verification: { earned: user.verificationPoints, cap: CATEGORY_CAPS.verification },
      engagement:   { earned: user.engagementPoints,   cap: CATEGORY_CAPS.engagement },
      streak:       { earned: user.streakPoints,       cap: CATEGORY_CAPS.streak },
      age:          { earned: user.agePoints,          cap: CATEGORY_CAPS.age },
      fulfilment:   { earned: user.fulfilmentPoints,   cap: CATEGORY_CAPS.fulfilment },
    },
  };
}

// ── Streak tracking ───────────────────────────────────────────────────────────

export async function updateStreakOnLogin(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { streakCurrentDays: true, streakLastActiveDate: true, streakWeeksCompleted: true },
  });
  if (!user) return;

  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const lastActive = user.streakLastActiveDate ? new Date(user.streakLastActiveDate) : null;
  if (lastActive) lastActive.setHours(0, 0, 0, 0);
  if (lastActive && lastActive.getTime() === today.getTime()) return;

  const newStreak = lastActive && lastActive.getTime() === yesterday.getTime()
    ? user.streakCurrentDays + 1
    : 1;

  await prisma.user.update({
    where: { id: userId },
    data:  { streakCurrentDays: newStreak, streakLastActiveDate: new Date() },
  });

  // 7-day milestone (once per lifetime — category cap enforces this)
  if (newStreak >= 7) {
    const already7 = await prisma.trustScoreLog.count({ where: { userId, eventType: "STREAK_7_DAY" } }).catch(() => 1);
    if (already7 === 0) {
      await awardTrust(userId, "STREAK_7_DAY", { reason: "7-day streak" }).catch(() => {});
    }
  }

  // 30-day milestone (once per lifetime)
  if (newStreak >= 28) {
    const already30 = await prisma.trustScoreLog.count({ where: { userId, eventType: "STREAK_30_DAY" } }).catch(() => 1);
    if (already30 === 0) {
      await awardTrust(userId, "STREAK_30_DAY", { reason: "30-day streak" }).catch(() => {});
      await prisma.user.update({ where: { id: userId }, data: { streakWeeksCompleted: 4 } }).catch(() => {});
    }
  }

  // Monthly active (once per calendar month when 4+ full weeks completed)
  if (Math.floor(newStreak / 7) >= 4) {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlyAlready = await prisma.trustScoreLog.count({
      where: { userId, eventType: "STREAK_MONTHLY_ACTIVE", createdAt: { gte: startOfMonth } },
    }).catch(() => 1);
    if (monthlyAlready === 0) {
      await awardTrust(userId, "STREAK_MONTHLY_ACTIVE", { reason: "monthly active bonus" }).catch(() => {});
    }
  }
}

// ── Account age milestones ────────────────────────────────────────────────────

const AGE_MILESTONES = [
  { event: "AGE_1_WEEK",   days: 7   },
  { event: "AGE_1_MONTH",  days: 30  },
  { event: "AGE_3_MONTHS", days: 90  },
  { event: "AGE_6_MONTHS", days: 180 },
  { event: "AGE_1_YEAR",   days: 365 },
];

export async function awardAccountAgePoints(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  if (!user) return;

  const daysSince = (Date.now() - new Date(user.createdAt).getTime()) / 86400000;

  for (const { event, days } of AGE_MILESTONES) {
    if (daysSince >= days) {
      const already = await prisma.trustScoreLog.count({ where: { userId, eventType: event } });
      if (already === 0) {
        await awardTrust(userId, event, { reason: "account age milestone" });
      }
    }
  }
}

// ── RBW (Recent Behaviour Weight) ────────────────────────────────────────────

export async function checkRBW(userId: string): Promise<Date | null> {
  const thirtyDaysAgo   = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { bundleRestrictedUntil: true } });
  if (user?.bundleRestrictedUntil && user.bundleRestrictedUntil > new Date()) {
    return user.bundleRestrictedUntil;
  }

  const [recentDeductions, pendingReports] = await Promise.all([
    prisma.trustScoreLog.aggregate({
      where: { userId, pointsDelta: { lt: 0 }, createdAt: { gte: fourteenDaysAgo } },
      _sum:  { pointsDelta: true },
    }),
    prisma.report.count({ where: { targetUserId: userId, status: "PENDING" } }),
  ]);

  const deductionSum = recentDeductions._sum.pointsDelta ?? 0;
  const isRisky = deductionSum <= -10 || pendingReports > 0;
  if (!isRisky) return null;

  const restrictedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.user.update({ where: { id: userId }, data: { bundleRestrictedUntil: restrictedUntil } });

  prisma.notification.create({
    data: {
      userId, type: "RBW_RESTRICTION",
      message: "Bundle access has been temporarily restricted due to recent activity. It will be restored in 30 days.",
      link: "/bundles",
    },
  }).catch(() => {});

  return restrictedUntil;
}

// ── Impact Score (donors) ─────────────────────────────────────────────────────

const IMPACT_EVENT_POINTS: Record<string, number> = {
  FULFILLED_REQUEST:             15,
  REGISTER_ITEM_DELIVERED:       10,
  BUNDLE_FUNDED:                 25,
  REGISTER_ITEM_FUNDED:           2,
  REGISTER_ITEM_FULL_FUND:       10,
  REGISTER_ITEM_FULFILLED_DONOR:  8,
};

const DONOR_LEVELS = [
  { level: "IMPACT_PARTNER", min: 300 },
  { level: "TRUSTED_DONOR",  min: 150 },
  { level: "ACTIVE_DONOR",   min:  50 },
  { level: "NEW_DONOR",      min:   0 },
];

function getDonorLevel(score: number): string {
  for (const { level, min } of DONOR_LEVELS) {
    if (score >= min) return level;
  }
  return "NEW_DONOR";
}

export async function awardImpactPoints(
  userId: string,
  eventType: string,
  referenceId?: string,
): Promise<number | null> {
  const delta = IMPACT_EVENT_POINTS[eventType];
  if (!delta || delta <= 0) return null;

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { impactScore: true, donorLevel: true },
  });
  if (!user) return null;

  const prevScore = user.impactScore;
  const newScore  = prevScore + delta;
  const prevLevel = user.donorLevel;
  const newLevel  = getDonorLevel(newScore);

  await prisma.$transaction([
    prisma.impactScoreLog.create({
      data: { userId, eventType, pointsDelta: delta, newScore, referenceId: referenceId ?? null },
    }),
    prisma.user.update({ where: { id: userId }, data: { impactScore: newScore, donorLevel: newLevel } }),
  ]);

  if (newLevel !== prevLevel) {
    prisma.notification.create({
      data: {
        userId, type: "DONOR_LEVEL_UP",
        message: "Thank you for supporting mothers on Kradəl.",
        link: "/profile",
      },
    }).catch(() => {});
  }

  return newScore;
}

// ── Quality gate helpers ──────────────────────────────────────────────────────

const REQUEST_KEYWORDS = [
  "can you give", "please give", "i need", "send me", "give me",
  "donate to me", "help me get", "looking for donations",
];

export function validateCirclePost(content: string): string | null {
  if (content.trim().length < 20) return "too_short";
  if (REQUEST_KEYWORDS.some(kw => content.toLowerCase().includes(kw))) return "request_keywords";
  return null;
}

export function validateCircleComment(content: string): string | null {
  if (content.trim().length < 15) return "too_short";
  return null;
}

export function validateIntroPost(content: string): string | null {
  if (content.trim().length < 30) return "too_short";
  return null;
}

// ── Legacy helpers ────────────────────────────────────────────────────────────

export async function recalculateTrustScore(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { trustScore: true } });
  return user?.trustScore ?? 0;
}

export function getTrustLevel(score: number): "high" | "normal" | "low" {
  if (score >= TRUST_THRESHOLDS.HIGH)   return "high";
  if (score >= TRUST_THRESHOLDS.NORMAL) return "normal";
  return "low";
}

