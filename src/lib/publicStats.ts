import { prisma } from "@/lib/prisma";

export interface ImpactStats {
  itemsFunded:      number; // register items that reached full funding
  mothersSupported: number; // distinct mothers who received at least one funded item
  deliveries:       number; // items delivered / fulfilled
  hasData:          boolean;
}

const FUNDED_STATUSES = ["FULLY_FUNDED", "IN_FULFILLMENT", "FULFILLED"] as const;

/**
 * Real, privacy-safe aggregate stats for the public landing page.
 * Returns counts only — never any mother-identifying data.
 * Falls back to zeroes (hasData=false) if the database is unreachable so the
 * landing page always renders fast and cleanly.
 */
export async function getPublicImpactStats(): Promise<ImpactStats> {
  try {
    const [itemsFunded, deliveries, motherGroups] = await Promise.all([
      prisma.registerItem.count({
        where: { fundingStatus: { in: [...FUNDED_STATUSES] } },
      }),
      prisma.registerItem.count({
        where: { OR: [{ status: "DELIVERED" }, { fundingStatus: "FULFILLED" }] },
      }),
      prisma.register.findMany({
        where:    { items: { some: { fundingStatus: { in: [...FUNDED_STATUSES] } } } },
        select:   { creatorId: true },
        distinct: ["creatorId"],
      }),
    ]);

    const mothersSupported = motherGroups.length;
    return {
      itemsFunded,
      mothersSupported,
      deliveries,
      hasData: itemsFunded > 0 || deliveries > 0 || mothersSupported > 0,
    };
  } catch {
    return { itemsFunded: 0, mothersSupported: 0, deliveries: 0, hasData: false };
  }
}
