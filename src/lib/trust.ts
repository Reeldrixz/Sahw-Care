import { prisma } from "@/lib/prisma";

export const TRUST_THRESHOLDS = {
  MARKETPLACE: 60,   // can request items
  BUNDLES: 85,       // can request care bundles
  HIGH: 70,          // legacy threshold kept for admin display
  NORMAL: 40,
};

// ── Event type config ─────────────────────────────────────────────────────────

type TrustEventConfig = {
  points: number;
  once?: boolean;           // can only be earned once per user
  dailyCap?: number;        // max times earnable per calendar day
};

const EVENT_CONFIG: Record<string, TrustEventConfig> = {
  PHONE_VERIFIED:        { points: 10, once: true },
  EMAIL_VERIFIED:        { points: 10, once: true },
  DOC_VERIFIED:          { points: 15, once: true },
  INTRO_POST:            { points: 8,  once: true },
  CIRCLE_POST:           { points: 2,  dailyCap: 3 },
  CIRCLE_REACTION_RECEIVED: { points: 1, dailyCap: 10 },
  CIRCLE_REPLY:          { points: 1,  dailyCap: 5 },
  DONATION_FULFILLED:    { points: 10 },
  ITEM_REQUEST_FULFILLED:{ points: 5  },
  REGISTER_ITEM_FULFILLED:{ points: 5 },
  FLAGGED_POST:          { points: -5 },
  REPORT_CONFIRMED:      { points: -10 },
};

// ── Main award function ───────────────────────────────────────────────────────

/**
 * Award (or deduct) trust points for an event.
 * Returns the new trustScore, or null if the award was skipped.
 */
export async function awardTrust(
  userId: string,
  eventType: string,
  opts?: { referenceId?: string; referenceType?: string; reason?: string },
): Promise<number | null> {
  const config = EVENT_CONFIG[eventType];
  if (!config) return null;

  // Fetch user state
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { trustScore: true, trustFrozen: true, trustFrozenUntil: true },
  });
  if (!user) return null;

  // If user is frozen and earning positive points, skip (penalties still apply)
  const isFrozen = user.trustFrozen && user.trustFrozenUntil && user.trustFrozenUntil > new Date();
  if (isFrozen && config.points > 0) return user.trustScore;

  // Auto-unfreeze if freeze period has passed
  if (user.trustFrozen && user.trustFrozenUntil && user.trustFrozenUntil <= new Date()) {
    await prisma.user.update({ where: { id: userId }, data: { trustFrozen: false, trustFrozenUntil: null } });
  }

  // Check once-per-user cap
  if (config.once) {
    const existing = await prisma.trustEvent.count({ where: { userId, eventType } });
    if (existing > 0) return user.trustScore;
  }

  // Check daily cap
  if (config.dailyCap) {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const todayCount = await prisma.trustEvent.count({
      where: { userId, eventType, createdAt: { gte: startOfDay } },
    });
    if (todayCount >= config.dailyCap) return user.trustScore;
  }

  const delta = config.points;
  const newScore = Math.max(0, Math.min(100, user.trustScore + delta));
  const reason = opts?.reason ?? eventType.replace(/_/g, " ").toLowerCase();

  // Log event + update score atomically
  await prisma.$transaction([
    prisma.trustEvent.create({
      data: {
        userId,
        eventType,
        pointsDelta: delta,
        reason,
        referenceId:   opts?.referenceId   ?? null,
        referenceType: opts?.referenceType ?? null,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data:  { trustScore: newScore, trustRating: parseFloat(((newScore / 100) * 5).toFixed(1)) },
    }),
  ]);

  return newScore;
}

/**
 * Detect rapid-fire posting abuse (5+ posts in 10 minutes).
 * If detected, freeze trust earning for 24 hours and return true.
 */
export async function checkAndFreezeIfAbuse(userId: string): Promise<boolean> {
  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentPosts = await prisma.trustEvent.count({
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

// ── Legacy functions (keep for backwards compat) ──────────────────────────────

export async function recalculateTrustScore(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { trustScore: true } });
  return user?.trustScore ?? 50;
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
  const now = new Date();
  const lastReset = user.urgentOverridesResetAt;
  const isDifferentMonth =
    !lastReset ||
    lastReset.getMonth() !== now.getMonth() ||
    lastReset.getFullYear() !== now.getFullYear();

  if (isDifferentMonth) {
    await prisma.user.update({
      where: { id: userId },
      data: { urgentOverridesUsed: 0, urgentOverridesResetAt: now },
    });
  }
}

export async function syncTrustRating(userId: string, score: number) {
  const rating = parseFloat(((score / 100) * 5).toFixed(1));
  await prisma.user.update({ where: { id: userId }, data: { trustRating: rating } });
}
