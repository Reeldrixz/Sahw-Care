import { prisma } from "@/lib/prisma";

export const TRUST_THRESHOLDS = {
  MARKETPLACE: 60,   // can request items
  BUNDLES: 85,       // can request care bundles
  HIGH: 70,          // legacy threshold kept for admin display
  NORMAL: 40,
};

const DAILY_CAP = 5; // max positive trust points per day for engagement events

// Events NOT subject to the global daily cap (one-time verifications, periodic bonuses)
const NO_DAILY_CAP_EVENTS = new Set([
  "PHONE_VERIFIED", "EMAIL_VERIFIED", "DOC_VERIFIED", "FULL_VERIFICATION_BONUS",
  "DONATION_FULFILLED", "ITEM_REQUEST_FULFILLED", "REGISTER_ITEM_FULFILLED",
  "REQUEST_FULFILLMENT_VERIFIED", "REQUEST_RECEIPT_CONFIRMED",
  "REQUEST_FULFILLMENT_AUTO_CONFIRMED", "FULFILLMENT_DISPUTED",
  "BUNDLE_ALLOCATION_CONFIRMED",
  "STREAK_7_DAY", "STREAK_WEEK_1", "STREAK_WEEK_2", "STREAK_WEEK_3", "STREAK_WEEK_4",
  "MONTHLY_ACTIVE", "ACCOUNT_AGE_30_DAYS",
]);

// Events that can only fire once per user lifetime
const ONCE_EVENTS = new Set([
  "PHONE_VERIFIED", "EMAIL_VERIFIED", "DOC_VERIFIED", "INTRO_POST",
  "FULL_VERIFICATION_BONUS",
]);

// Points per event type
export const EVENT_POINTS: Record<string, number> = {
  PHONE_VERIFIED:              10,
  EMAIL_VERIFIED:              10,
  DOC_VERIFIED:                15,
  INTRO_POST:                   8,
  CIRCLE_POST:                  2,
  CIRCLE_REACTION_RECEIVED:     1,
  CIRCLE_REPLY:                 1,
  DONATION_FULFILLED:          10,
  ITEM_REQUEST_FULFILLED:       5,
  REGISTER_ITEM_FULFILLED:      5,
  STREAK_7_DAY:                 3,
  STREAK_WEEK_1:                3,
  STREAK_WEEK_2:                3,
  STREAK_WEEK_3:                3,
  STREAK_WEEK_4:                3,
  MONTHLY_ACTIVE:               3,
  ACCOUNT_AGE_30_DAYS:          2,
  // fulfillment events
  REQUEST_FULFILLMENT_VERIFIED:       10,
  REQUEST_RECEIPT_CONFIRMED:           5,
  REQUEST_FULFILLMENT_AUTO_CONFIRMED:  5,
  BUNDLE_ALLOCATION_CONFIRMED:         5,
  // negative events
  FLAGGED_POST:                -5,
  REPORT_CONFIRMED:           -10,
  DISCOVER_REQUEST:            -2,
  FULFILLMENT_DISPUTED:       -10,
};

// Impact score points per event type (donors)
const IMPACT_EVENT_POINTS: Record<string, number> = {
  FULFILLED_REQUEST:            15,
  REGISTER_ITEM_DELIVERED:      10,
  BUNDLE_FUNDED:                25,
  REGISTER_ITEM_FUNDED:          2,  // any funding contribution
  REGISTER_ITEM_FULL_FUND:      10,  // bonus for single full-item contribution
  REGISTER_ITEM_FULFILLED_DONOR: 8, // item they helped fund reaches FULFILLED
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

async function sendTrustNotification(
  userId: string,
  type: "milestone" | "warning",
  score: number,
): Promise<void> {
  if (type === "milestone") {
    await prisma.notification.create({
      data: {
        userId,
        type: "TRUST_MILESTONE",
        message: "You've unlocked bundle access! Your trust score has reached 85.",
        link: "/bundles",
      },
    });
  } else {
    await prisma.notification.create({
      data: {
        userId,
        type: "TRUST_WARNING",
        message: `Your trust score has dropped to ${score}. You need 60 to request items.`,
        link: "/profile",
      },
    });
  }
}

// ── Core scoring functions ────────────────────────────────────────────────────

/**
 * Award positive trust points.
 * Applies global 5pt/day cap for engagement events.
 * Returns the new trustScore, or null if skipped.
 */
export async function awardTrustPoints(
  userId: string,
  eventType: string,
  delta: number,
  opts?: { referenceId?: string; referenceType?: string; reason?: string },
): Promise<number | null> {
  if (delta <= 0) return null;

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { trustScore: true, trustFrozen: true, trustFrozenUntil: true, dailyPointsEarned: true, dailyPointsDate: true },
  });
  if (!user) return null;

  // Freeze: block positive points (penalties still apply — use deductTrustPoints)
  const isFrozen = user.trustFrozen && user.trustFrozenUntil && user.trustFrozenUntil > new Date();
  if (isFrozen) return user.trustScore;

  // Auto-unfreeze
  if (user.trustFrozen && user.trustFrozenUntil && user.trustFrozenUntil <= new Date()) {
    await prisma.user.update({ where: { id: userId }, data: { trustFrozen: false, trustFrozenUntil: null } });
  }

  // Once-per-user check
  if (ONCE_EVENTS.has(eventType)) {
    const existing = await prisma.trustScoreLog.count({ where: { userId, eventType } });
    if (existing > 0) return user.trustScore;
  }

  // Daily cap for engagement events
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const lastDate = user.dailyPointsDate ? new Date(user.dailyPointsDate) : null;
  if (lastDate) lastDate.setHours(0, 0, 0, 0);
  const isToday = !!lastDate && lastDate.getTime() === today.getTime();
  const currentDailyEarned = isToday ? user.dailyPointsEarned : 0;

  let effectiveDelta = delta;
  if (!NO_DAILY_CAP_EVENTS.has(eventType)) {
    if (currentDailyEarned >= DAILY_CAP) return user.trustScore;
    effectiveDelta = Math.min(delta, DAILY_CAP - currentDailyEarned);
  }

  const prevScore = user.trustScore;
  const newScore  = Math.max(0, Math.min(100, prevScore + effectiveDelta));
  const reason    = opts?.reason ?? eventType.replace(/_/g, " ").toLowerCase();

  const newDailyEarned = NO_DAILY_CAP_EVENTS.has(eventType)
    ? currentDailyEarned
    : currentDailyEarned + effectiveDelta;

  await prisma.$transaction([
    prisma.trustScoreLog.create({
      data: { userId, eventType, pointsDelta: effectiveDelta, newScore },
    }),
    prisma.trustScoreHistory.create({
      data: { userId, oldScore: prevScore, newScore, delta: effectiveDelta, reason: opts?.reason ?? eventType.replace(/_/g, " ").toLowerCase() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        trustScore:  newScore,
        trustRating: parseFloat(((newScore / 100) * 5).toFixed(1)),
        ...(NO_DAILY_CAP_EVENTS.has(eventType) ? {} : {
          dailyPointsEarned: newDailyEarned,
          dailyPointsDate:   new Date(),
        }),
      },
    }),
  ]);

  // Milestone notification: just unlocked bundle access
  if (prevScore < 85 && newScore >= 85) {
    sendTrustNotification(userId, "milestone", newScore).catch(() => {});
  }

  void reason; // suppress unused var warning
  return newScore;
}

/**
 * Deduct trust points. No daily cap. Bypasses freeze.
 * Pass delta as a positive number (will be negated internally).
 */
export async function deductTrustPoints(
  userId: string,
  eventType: string,
  delta: number,
  opts?: { referenceId?: string; referenceType?: string; reason?: string },
): Promise<number | null> {
  const absDelta = Math.abs(delta);
  if (absDelta === 0) return null;

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { trustScore: true },
  });
  if (!user) return null;

  const prevScore = user.trustScore;
  const newScore  = Math.max(0, prevScore - absDelta);
  const reason    = opts?.reason ?? eventType.replace(/_/g, " ").toLowerCase();

  await prisma.$transaction([
    prisma.trustScoreLog.create({
      data: { userId, eventType, pointsDelta: -absDelta, newScore },
    }),
    prisma.trustScoreHistory.create({
      data: { userId, oldScore: prevScore, newScore, delta: -absDelta, reason: opts?.reason ?? eventType.replace(/_/g, " ").toLowerCase() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        trustScore:  newScore,
        trustRating: parseFloat(((newScore / 100) * 5).toFixed(1)),
      },
    }),
  ]);

  // Warning notification: just dropped below 60
  if (prevScore >= 60 && newScore < 60) {
    sendTrustNotification(userId, "warning", newScore).catch(() => {});
  }

  void reason;
  return newScore;
}

/**
 * Backwards-compat wrapper used throughout the codebase.
 * Dispatches to awardTrustPoints or deductTrustPoints based on event config.
 */
export async function awardTrust(
  userId: string,
  eventType: string,
  opts?: { referenceId?: string; referenceType?: string; reason?: string },
): Promise<number | null> {
  const points = EVENT_POINTS[eventType];
  if (points === undefined) return null;
  if (points > 0) return awardTrustPoints(userId, eventType, points, opts);
  if (points < 0) return deductTrustPoints(userId, eventType, Math.abs(points), opts);
  return null;
}

// ── Verification bonus ────────────────────────────────────────────────────────

/**
 * If all 4 verifications are complete and bonus not yet awarded, set trustScore to at least 60.
 */
export async function checkFullVerificationBonus(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { emailVerified: true, phoneVerified: true, avatar: true, docStatus: true, trustScore: true },
  });
  if (!user) return;

  const allVerified =
    user.emailVerified &&
    user.phoneVerified &&
    !!user.avatar &&
    user.docStatus === "VERIFIED";

  if (!allVerified) return;

  const existing = await prisma.trustScoreLog.count({ where: { userId, eventType: "FULL_VERIFICATION_BONUS" } });
  if (existing > 0) return;

  const newScore = Math.max(user.trustScore, 60);
  const delta    = newScore - user.trustScore;

  await prisma.$transaction([
    prisma.trustScoreLog.create({
      data: { userId, eventType: "FULL_VERIFICATION_BONUS", pointsDelta: delta, newScore },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        trustScore:  newScore,
        trustRating: parseFloat(((newScore / 100) * 5).toFixed(1)),
      },
    }),
  ]);

  if (user.trustScore < 85 && newScore >= 85) {
    sendTrustNotification(userId, "milestone", newScore).catch(() => {});
  }
}

// ── Streak tracking ───────────────────────────────────────────────────────────

/**
 * Update daily login streak and award streak bonuses.
 * Call after successful authentication (fire-and-forget is fine).
 */
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

  // Already checked in today
  if (lastActive && lastActive.getTime() === today.getTime()) return;

  let newStreak = lastActive && lastActive.getTime() === yesterday.getTime()
    ? user.streakCurrentDays + 1
    : 1;

  await prisma.user.update({
    where: { id: userId },
    data:  { streakCurrentDays: newStreak, streakLastActiveDate: new Date() },
  });

  // 7-day streak bonus
  if (newStreak === 7) {
    await awardTrustPoints(userId, "STREAK_7_DAY", 3, { reason: "7 day streak" }).catch(() => {});
  }

  // Weekly bonuses (weeks 1–4)
  if (newStreak % 7 === 0) {
    const weekNum = newStreak / 7;
    if (weekNum >= 1 && weekNum <= 4) {
      const weekEvent = `STREAK_WEEK_${weekNum}`;
      const alreadyHave = await prisma.trustScoreLog.count({ where: { userId, eventType: weekEvent } }).catch(() => 1);
      if (alreadyHave === 0) {
        await awardTrustPoints(userId, weekEvent, 3, { reason: `week ${weekNum} streak bonus` }).catch(() => {});
        await prisma.user.update({ where: { id: userId }, data: { streakWeeksCompleted: weekNum } }).catch(() => {});
      }
    }
  }

  // Monthly active bonus (after completing 4 weeks)
  const weeksCompleted = Math.max(user.streakWeeksCompleted, newStreak % 7 === 0 ? Math.min(4, newStreak / 7) : user.streakWeeksCompleted);
  if (weeksCompleted >= 4) {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlyAlready = await prisma.trustScoreLog.count({
      where: { userId, eventType: "MONTHLY_ACTIVE", createdAt: { gte: startOfMonth } },
    }).catch(() => 1);
    if (monthlyAlready === 0) {
      await awardTrustPoints(userId, "MONTHLY_ACTIVE", 3, { reason: "monthly active bonus" }).catch(() => {});
    }
  }
}

// ── Account age bonus ─────────────────────────────────────────────────────────

/**
 * Award +2 per 30-day period of account age not yet credited.
 */
export async function awardAccountAgePoints(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  if (!user) return;

  const daysSince  = (Date.now() - new Date(user.createdAt).getTime()) / (86400 * 1000);
  const periodsDue = Math.floor(daysSince / 30);
  if (periodsDue === 0) return;

  const alreadyAwarded = await prisma.trustScoreLog.count({ where: { userId, eventType: "ACCOUNT_AGE_30_DAYS" } });
  const toAward = periodsDue - alreadyAwarded;
  if (toAward <= 0) return;

  for (let i = 0; i < toAward; i++) {
    await awardTrustPoints(userId, "ACCOUNT_AGE_30_DAYS", 2, { reason: "account age bonus" });
  }
}

// ── RBW (Recent Behavior Weight) ──────────────────────────────────────────────

/**
 * Check for risky behaviour patterns and restrict bundle access if detected.
 * Returns the restriction end date, or null if no restriction applied.
 */
export async function checkRBW(userId: string): Promise<Date | null> {
  const thirtyDaysAgo   = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  // Check if already restricted
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { bundleRestrictedUntil: true } });
  if (user?.bundleRestrictedUntil && user.bundleRestrictedUntil > new Date()) {
    return user.bundleRestrictedUntil;
  }

  const [discoverRequests, urgentOverrides, recentDeductions, pendingReports] = await Promise.all([
    prisma.trustScoreLog.count({
      where: { userId, eventType: "DISCOVER_REQUEST", createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.urgentOverride.count({ where: { userId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.trustScoreLog.aggregate({
      where: { userId, pointsDelta: { lt: 0 }, createdAt: { gte: fourteenDaysAgo } },
      _sum:  { pointsDelta: true },
    }),
    prisma.report.count({ where: { targetUserId: userId, status: "PENDING" } }),
  ]);

  const deductionSum = recentDeductions._sum.pointsDelta ?? 0;
  const isRisky = discoverRequests >= 5 || urgentOverrides >= 2 || deductionSum <= -10 || pendingReports > 0;
  if (!isRisky) return null;

  const restrictedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.user.update({ where: { id: userId }, data: { bundleRestrictedUntil: restrictedUntil } });

  prisma.notification.create({
    data: {
      userId,
      type:    "RBW_RESTRICTION",
      message: "Bundle access has been temporarily restricted due to recent activity. It will be restored in 30 days.",
      link:    "/bundles",
    },
  }).catch(() => {});

  return restrictedUntil;
}

// ── Impact Score (donors) ─────────────────────────────────────────────────────

/**
 * Award impact points to a donor. Score only goes up.
 * Updates donorLevel and sends level-up notification when level changes.
 */
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
    prisma.user.update({
      where: { id: userId },
      data:  { impactScore: newScore, donorLevel: newLevel },
    }),
  ]);

  // Level-up notification
  if (newLevel !== prevLevel) {
    const levelLabels: Record<string, string> = {
      ACTIVE_DONOR:   "Active Donor",
      TRUSTED_DONOR:  "Trusted Donor",
      IMPACT_PARTNER: "Impact Partner",
    };
    const label = levelLabels[newLevel];
    if (label) {
      prisma.notification.create({
        data: {
          userId,
          type:    "DONOR_LEVEL_UP",
          message: `You've reached ${label} status! Keep giving to unlock more recognition.`,
          link:    "/profile",
        },
      }).catch(() => {});
    }
  }

  return newScore;
}

// ── Quality gate helpers ──────────────────────────────────────────────────────

const REQUEST_KEYWORDS = [
  "can you give", "please give", "i need", "send me", "give me",
  "donate to me", "help me get", "looking for donations",
];

/**
 * Validate a circle post qualifies for trust points.
 * Returns null if valid, or an error string if not.
 */
export function validateCirclePost(content: string): string | null {
  if (content.trim().length < 20) return "too_short";
  const lower = content.toLowerCase();
  if (REQUEST_KEYWORDS.some(kw => lower.includes(kw))) return "request_keywords";
  return null;
}

/**
 * Validate a circle comment qualifies for trust points.
 */
export function validateCircleComment(content: string): string | null {
  if (content.trim().length < 15) return "too_short";
  return null;
}

/**
 * Validate an intro post qualifies for trust points.
 */
export function validateIntroPost(content: string): string | null {
  if (content.trim().length < 30) return "too_short";
  return null;
}

// ── Abuse detection ───────────────────────────────────────────────────────────

/**
 * Detect rapid-fire posting abuse (5+ posts in 10 minutes).
 * If detected, freeze trust earning for 24 hours and return true.
 */
export async function checkAndFreezeIfAbuse(userId: string): Promise<boolean> {
  const tenMinsAgo  = new Date(Date.now() - 10 * 60 * 1000);
  const recentPosts = await prisma.trustScoreLog.count({
    where: { userId, eventType: "CIRCLE_POST", createdAt: { gte: tenMinsAgo } },
  });

  if (recentPosts >= 5) {
    const frozenUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: userId },
      data:  { trustFrozen: true, trustFrozenUntil: frozenUntil },
    });
    return true;
  }
  return false;
}

// ── Legacy functions (kept for backwards compat) ──────────────────────────────

export async function recalculateTrustScore(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { trustScore: true } });
  return user?.trustScore ?? 0;
}

export function getTrustLevel(score: number): "high" | "normal" | "low" {
  if (score >= TRUST_THRESHOLDS.HIGH) return "high";
  if (score >= TRUST_THRESHOLDS.NORMAL) return "normal";
  return "low";
}

export function urgentOverrideLimit(score: number): number {
  return score >= TRUST_THRESHOLDS.HIGH ? 2 : 1;
}

export async function resetOverridesIfNeeded(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const now       = new Date();
  const lastReset = user.urgentOverridesResetAt;
  const isDifferentMonth =
    !lastReset ||
    lastReset.getMonth() !== now.getMonth() ||
    lastReset.getFullYear() !== now.getFullYear();

  if (isDifferentMonth) {
    await prisma.user.update({
      where: { id: userId },
      data:  { urgentOverridesUsed: 0, urgentOverridesResetAt: now },
    });
  }
}

export async function syncTrustRating(userId: string, score: number) {
  const rating = parseFloat(((score / 100) * 5).toFixed(1));
  await prisma.user.update({ where: { id: userId }, data: { trustRating: rating } });
}
