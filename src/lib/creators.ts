import { prisma } from "@/lib/prisma";
import { generateReferralCode } from "@/lib/referral";

// Ensure the user has a stable, unique creator link code (reuses the referral
// code generator). Returns the code. Retries on the rare unique collision.
export async function ensureCreatorCode(userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { creatorReferralCode: true },
  });
  if (existing?.creatorReferralCode) return existing.creatorReferralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    try {
      await prisma.user.update({ where: { id: userId }, data: { creatorReferralCode: code } });
      return code;
    } catch {
      // unique collision — try again
    }
  }
  throw new Error("Could not generate a unique creator code");
}

export interface CreatorDashboard {
  linkVisits:       number;
  membersJoined:    number;   // people who signed up through this creator's link
  contributions:    number;   // confirmed donations made by those people
  mothersSupported: number;   // distinct mothers helped by those people's contributions (cohort-scoped)
}

// Honest, cohort-scoped, ecosystem-attributed numbers for one creator.
// The creator drove AWARENESS; outcomes belong to the people they brought in.
export async function getCreatorDashboard(creatorId: string): Promise<CreatorDashboard> {
  const me = await prisma.user.findUnique({
    where:  { id: creatorId },
    select: { creatorLinkVisits: true },
  });

  // People this creator brought in.
  const referred = await prisma.user.findMany({
    where:  { referredByUserId: creatorId },
    select: { id: true },
  });
  const referredIds = referred.map((u) => u.id);

  if (referredIds.length === 0) {
    return { linkVisits: me?.creatorLinkVisits ?? 0, membersJoined: 0, contributions: 0, mothersSupported: 0 };
  }

  // Confirmed (non-refunded) contributions made by the cohort, and the distinct
  // mothers those contributions reached (register creator = the mother).
  const fundings = await prisma.registerItemFunding.findMany({
    where: {
      donorId:    { in: referredIds },
      status:     "CONFIRMED",
      refundedAt: null,
    },
    select: { registerItem: { select: { register: { select: { creatorId: true } } } } },
  });

  const mothers = new Set(
    fundings.map((f) => f.registerItem?.register?.creatorId).filter(Boolean) as string[],
  );

  return {
    linkVisits:       me?.creatorLinkVisits ?? 0,
    membersJoined:    referredIds.length,
    contributions:    fundings.length,
    mothersSupported: mothers.size,
  };
}
