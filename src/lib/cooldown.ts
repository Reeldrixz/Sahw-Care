import { prisma } from "@/lib/prisma";

// ── Category configuration ─────────────────────────────────────────────────
export const CATEGORY_CONFIG: Record<
  string,
  { cooldownDays: number; supplyDays: number; maxQty: number; label: string }
> = {
  "Diapering":     { cooldownDays: 10, supplyDays: 21,  maxQty: 3, label: "Diapering" },
  "Feeding":   { cooldownDays:  7, supplyDays: 30,  maxQty: 4, label: "Feeding / Formula" },
  "Clothing":    { cooldownDays: 21, supplyDays: 90,  maxQty: 5, label: "Clothing" },
  "Maternity":   { cooldownDays: 30, supplyDays: 90,  maxQty: 2, label: "Maternity" },
  "Hygiene": { cooldownDays: 14, supplyDays: 60,  maxQty: 3, label: "Hygiene" },
  "Other":       { cooldownDays: 14, supplyDays: 30,  maxQty: 3, label: "Other" },
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG);

// ── Core calculations ──────────────────────────────────────────────────────

/** Dynamic cooldown = 50% of estimated supply duration, floored to config min */
export function computeCooldownDays(category: string, supplyDuration?: number): number {
  const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG["Other"];
  if (supplyDuration && supplyDuration > 0) {
    return Math.max(Math.round(supplyDuration * 0.5), Math.round(cfg.cooldownDays * 0.7));
  }
  return cfg.cooldownDays;
}

export function getNextEligibleDate(
  category: string,
  fulfilledAt: Date = new Date(),
  supplyDuration?: number
): Date {
  const days = computeCooldownDays(category, supplyDuration);
  const d = new Date(fulfilledAt);
  d.setDate(d.getDate() + days);
  return d;
}

export function daysUntilEligible(nextEligibleAt: Date): number {
  return Math.max(0, Math.ceil((nextEligibleAt.getTime() - Date.now()) / 86400000));
}

// ── DB helpers ─────────────────────────────────────────────────────────────

/** Check if a user is currently in cooldown for a given category */
export async function checkCooldown(
  userId: string,
  category: string
): Promise<{ inCooldown: boolean; daysLeft: number; nextEligibleAt: Date | null }> {
  const record = await prisma.categoryCooldown.findUnique({
    where: { userId_category: { userId, category } },
  });

  if (!record) return { inCooldown: false, daysLeft: 0, nextEligibleAt: null };

  const daysLeft = daysUntilEligible(record.nextEligibleAt);
  return {
    inCooldown: daysLeft > 0,
    daysLeft,
    nextEligibleAt: record.nextEligibleAt,
  };
}

/** Record a new fulfilment and set/update the cooldown for a category */
export async function recordFulfilment(
  userId: string,
  category: string,
  supplyDuration?: number
): Promise<void> {
  const now = new Date();
  const nextEligibleAt = getNextEligibleDate(category, now, supplyDuration);

  await prisma.categoryCooldown.upsert({
    where: { userId_category: { userId, category } },
    update: { lastFulfilledAt: now, nextEligibleAt, updatedAt: now },
    create: { userId, category, lastFulfilledAt: now, nextEligibleAt },
  });
}

/** All cooldowns for a user, merged with config data */
export async function getUserCooldowns(userId: string) {
  const records = await prisma.categoryCooldown.findMany({
    where: { userId },
    orderBy: { nextEligibleAt: "asc" },
  });

  return ALL_CATEGORIES.map((cat) => {
    const record = records.find((r) => r.category === cat);
    const cfg = CATEGORY_CONFIG[cat];
    const daysLeft = record ? daysUntilEligible(record.nextEligibleAt) : 0;
    return {
      category: cat,
      label: cfg.label,
      inCooldown: daysLeft > 0,
      daysLeft,
      nextEligibleAt: record?.nextEligibleAt ?? null,
      lastFulfilledAt: record?.lastFulfilledAt ?? null,
      config: cfg,
    };
  });
}
