import { prisma } from "./prisma";

/** Extract country from a "City, Country" or "Country" location string. */
export function extractCountry(location: string | null): string | null {
  if (!location?.trim()) return null;
  const parts = location.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

/** Extract city (first segment) from location string. */
export function extractCity(location: string | null): string | null {
  if (!location?.trim()) return null;
  const parts = location.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[0] ?? null;
}

/** Get or create the circle for a country, return its id. */
export async function getOrCreateCircle(country: string): Promise<string> {
  const result = await prisma.circle.upsert({
    where: { country },
    create: { name: `${country} Circle`, country },
    update: {},
  });
  return result.id;
}

/**
 * Auto-join a user to their country's circle based on their location.
 * No-ops if user has no location, no country extractable, or is already in a circle.
 */
export async function autoJoinCircle(userId: string, location: string | null): Promise<void> {
  const country = extractCountry(location);
  if (!country) return;

  const existing = await prisma.circleMember.findFirst({ where: { userId } });
  if (existing) return;

  const circleId = await getOrCreateCircle(country);
  await prisma.circleMember.create({ data: { userId, circleId } }).catch(() => {});
}
