// Monthly cooldowns for received support (bundles, formula). Both clocks are
// keyed off an approval/receipt timestamp (reviewedAt of an APPROVED/DELIVERED
// row), never off submission, so a pending or declined request never starts a
// clock. "One month" is rolling from the approval date, month-end clamped:
//   Jan 28 -> Feb 28,  Jan 31 -> Feb 28 (Feb has no 31st).
// The two tracks are independent; each caller queries its own model.

/**
 * The same day-of-month one calendar month later, clamped to the last day of
 * the target month when the original day does not exist there.
 */
export function addOneMonth(date: Date): Date {
  // UTC methods so the result is deterministic regardless of server timezone.
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);                        // avoid rollover while changing month
  d.setUTCMonth(d.getUTCMonth() + 1);
  const lastDayOfTargetMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return d;
}

/**
 * Given the most recent approval/receipt date (or null), returns the cooldown
 * state: whether the mother is currently in cooldown and, if so, the date she
 * is next eligible from.
 */
export function monthlyCooldown(lastApprovedAt: Date | null | undefined): {
  active: boolean;
  lastApprovedAt: Date | null;
  nextEligibleAt: Date | null;
} {
  if (!lastApprovedAt) {
    return { active: false, lastApprovedAt: null, nextEligibleAt: null };
  }
  const nextEligibleAt = addOneMonth(lastApprovedAt);
  return {
    active: Date.now() < nextEligibleAt.getTime(),
    lastApprovedAt,
    nextEligibleAt,
  };
}

/** Warm, human date for cooldown messages, e.g. "January 28, 2026". Formatted
 *  in UTC to match the UTC-based cooldown computation. */
export function formatCooldownDate(date: Date): string {
  return date.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}
