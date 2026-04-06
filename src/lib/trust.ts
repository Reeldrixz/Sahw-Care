import { prisma } from "@/lib/prisma";

export const TRUST_THRESHOLDS = { HIGH: 70, NORMAL: 40 };

/** Points added per verification level reached */
const VERIFICATION_BONUS = [0, 5, 10, 15, 20]; // index = level

/** Recompute a user's trust score from first principles and persist it. */
export async function recalculateTrustScore(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return 50;

  let score = 50; // neutral base

  // ── Verification bonus ─────────────────────────────────────────────────
  score += VERIFICATION_BONUS[Math.min(user.verificationLevel, 4)];

  // ── Successful fulfilments (donor delivered + mom confirmed) ───────────
  const fulfilledItems = await prisma.fulfillmentLog.count({
    where: {
      donorConfirmed: true,
      momConfirmed: true,
      assignment: { item: { register: { creatorId: userId } } },
    },
  });
  score += Math.min(fulfilledItems * 3, 24); // +3 each, cap +24

  // ── Account age (1 pt / month, max 12) ────────────────────────────────
  const ageMonths = Math.floor(
    (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
  );
  score += Math.min(ageMonths, 12);

  // ── Mismatch / dispute penalty ─────────────────────────────────────────
  const mismatches = await prisma.fulfillmentLog.count({
    where: {
      mismatch: true,
      assignment: { item: { register: { creatorId: userId } } },
    },
  });
  score -= mismatches * 8;

  // ── Reports against user ───────────────────────────────────────────────
  const [pendingReports, resolvedReports] = await Promise.all([
    prisma.report.count({ where: { targetUserId: userId, status: "PENDING" } }),
    prisma.report.count({ where: { targetUserId: userId, status: "RESOLVED" } }),
  ]);
  score -= pendingReports * 5;
  score -= resolvedReports * 12;

  // ── Urgent override abuse ──────────────────────────────────────────────
  const unapprovedOverrides = await prisma.urgentOverride.count({
    where: { userId, reviewed: true, approved: false },
  });
  score -= unapprovedOverrides * 10;

  // ── Account status penalty ─────────────────────────────────────────────
  if (user.status === "FLAGGED") score -= 20;
  if (user.status === "SUSPENDED") score = Math.min(score, 15);

  score = Math.max(0, Math.min(100, score));

  await prisma.user.update({ where: { id: userId }, data: { trustScore: score } });
  return score;
}

export function getTrustLevel(score: number): "high" | "normal" | "low" {
  if (score >= TRUST_THRESHOLDS.HIGH) return "high";
  if (score >= TRUST_THRESHOLDS.NORMAL) return "normal";
  return "low";
}

/** How many urgent overrides this user gets per month */
export function urgentOverrideLimit(score: number): number {
  return score >= TRUST_THRESHOLDS.HIGH ? 2 : 1;
}

/** Reset the monthly override counter if a new month has begun */
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

/** Update the legacy 0-5 trustRating from the 0-100 trustScore */
export async function syncTrustRating(userId: string, score: number) {
  const rating = parseFloat(((score / 100) * 5).toFixed(1));
  await prisma.user.update({ where: { id: userId }, data: { trustRating: rating } });
}
