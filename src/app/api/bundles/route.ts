import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;

  // Load user only if authenticated
  let user: {
    id: string; journeyType: string | null; docStatus: string; trustScore: number;
    currentStage: string | null; countryCode: string | null;
    activeBundleId: string | null; lastBundleCompletedAt: Date | null;
  } | null = null;

  if (auth) {
    user = await prisma.user.findUnique({
      where:  { id: auth.userId },
      select: {
        id: true, journeyType: true, docStatus: true, trustScore: true,
        currentStage: true, countryCode: true,
        activeBundleId: true, lastBundleCompletedAt: true,
      },
    });
  }

  const campaigns = await prisma.campaign.findMany({
    where:  { status: "ACTIVE", bundlesRemaining: { gt: 0 } },
    include: { template: true },
    orderBy: { createdAt: "desc" },
  });

  // Compute eligibility for each campaign
  const now = Date.now();
  const daysSinceBundle = user?.lastBundleCompletedAt
    ? (now - new Date(user.lastBundleCompletedAt).getTime()) / (86400 * 1000)
    : null;

  const formatted = campaigns
    .filter((c) => {
      // Filter by targetRegion only when user is logged in with a known country
      if (c.targetRegion && user && user.countryCode !== c.targetRegion) return false;
      return true;
    })
    .map((c) => {
      const eligibility = user
        ? checkEligibility(user, c, daysSinceBundle)
        : { eligible: false, reason: "not_logged_in" as string, daysUntilEligible: undefined };
      const templateItems = c.template.items as { name: string; quantity: string }[];
      const itemSummary = templateItems.map((i) => i.name).join(", ");

      return {
        id:              c.id,
        title:           c.title,
        description:     c.description,
        sponsorName:     c.sponsorName,
        sponsorLogo:     c.sponsorLogo,
        bundlesRemaining: c.bundlesRemaining,
        totalBundles:    c.totalBundles,
        template: {
          id:          c.template.id,
          name:        c.template.name,
          description: c.template.description,
          itemSummary,
          items:       c.template.items,
        },
        eligibility,
      };
    });

  return NextResponse.json({ campaigns: formatted });
}

export function checkEligibility(
  user: {
    journeyType: string | null;
    docStatus:   string;
    trustScore:  number;
    activeBundleId: string | null;
    lastBundleCompletedAt: Date | null;
    currentStage: string | null;
  },
  campaign: { targetStage: string | null; bundlesRemaining: number },
  daysSinceBundle: number | null,
): { eligible: boolean; reason: string | null; daysUntilEligible?: number } {
  if (!["pregnant", "postpartum"].includes(user.journeyType ?? "")) {
    return { eligible: false, reason: "not_mother" };
  }
  if (user.docStatus !== "VERIFIED") {
    return { eligible: false, reason: "not_verified" };
  }
  if (user.trustScore < 85) {
    return { eligible: false, reason: "low_trust" };
  }
  if (user.activeBundleId) {
    return { eligible: false, reason: "active_bundle" };
  }
  if (daysSinceBundle !== null && daysSinceBundle < 60) {
    const daysUntilEligible = Math.ceil(60 - daysSinceBundle);
    return { eligible: false, reason: "cooldown", daysUntilEligible };
  }
  if (campaign.bundlesRemaining <= 0) {
    return { eligible: false, reason: "no_stock" };
  }
  if (campaign.targetStage && user.currentStage !== campaign.targetStage) {
    return { eligible: false, reason: "wrong_stage" };
  }
  return { eligible: true, reason: null };
}
