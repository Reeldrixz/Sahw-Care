import { prisma } from "@/lib/prisma";

export interface ImpactStats {
  donations: number;
  families: number;
  babiesFed: number;
  rank: RankInfo;
}

export interface RankInfo {
  label: string;
  emoji: string;
  next: string | null;
  nextAt: number | null;
}

const RANKS = [
  { min: 0,  max: 0,   label: "New Giver",       emoji: "🌱", next: "Caring Heart"     },
  { min: 1,  max: 2,   label: "Caring Heart",     emoji: "💛", next: "Village Helper"   },
  { min: 3,  max: 5,   label: "Village Helper",   emoji: "🤝", next: "Community Pillar" },
  { min: 6,  max: 10,  label: "Community Pillar", emoji: "🏛️", next: "Guardian Angel"   },
  { min: 11, max: 20,  label: "Guardian Angel",   emoji: "👼", next: "Kradəl Champion"  },
  { min: 21, max: 50,  label: "Kradəl Champion",  emoji: "🌟", next: "Kradəl Legend"    },
  { min: 51, max: Infinity, label: "Kradəl Legend", emoji: "🏆", next: null              },
];

export function getRank(donations: number): RankInfo {
  const tier = RANKS.findLast((r) => donations >= r.min) ?? RANKS[0];
  const nextTier = RANKS[RANKS.indexOf(tier) + 1];
  return {
    label: tier.label,
    emoji: tier.emoji,
    next: tier.next,
    nextAt: nextTier ? nextTier.min : null,
  };
}

export async function getImpactStats(userId: string): Promise<ImpactStats> {
  // Count assignments where donor has at minimum delivered
  const assignments = await prisma.itemAssignment.findMany({
    where: {
      donorId: userId,
      status: { in: ["DELIVERED", "PURCHASED"] },
    },
    include: {
      item: {
        include: {
          register: { select: { creatorId: true } },
        },
      },
    },
  });

  const donations = assignments.length;

  // Unique families = unique register creator IDs
  const familyIds = new Set(
    assignments
      .map((a) => a.item.register?.creatorId)
      .filter(Boolean) as string[]
  );
  const families = familyIds.size || donations; // fallback to donation count

  // Estimate babies fed: baby-related categories count for slightly more
  const babyCategories = new Set(["Feeding", "Diapering", "Clothing"]);
  let babiesFed = 0;
  for (const a of assignments) {
    babiesFed += babyCategories.has(a.item.category ?? "") ? 2 : 1;
  }

  return {
    donations,
    families,
    babiesFed,
    rank: getRank(donations),
  };
}
