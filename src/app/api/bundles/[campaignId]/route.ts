import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkEligibility } from "@/app/api/bundles/route";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ campaignId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaignId } = await params;

  const [campaign, user] = await Promise.all([
    prisma.campaign.findUnique({
      where:   { id: campaignId },
      include: { template: true },
    }),
    prisma.user.findUnique({
      where:  { id: auth.userId },
      select: {
        journeyType: true, docStatus: true, trustScore: true,
        currentStage: true, countryCode: true,
        activeBundleId: true, lastBundleCompletedAt: true,
      },
    }),
  ]);

  if (!campaign || campaign.status === "DRAFT") {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const daysSinceBundle = user.lastBundleCompletedAt
    ? (Date.now() - new Date(user.lastBundleCompletedAt).getTime()) / (86400 * 1000)
    : null;

  const eligibility = checkEligibility(user, campaign, daysSinceBundle);

  return NextResponse.json({
    campaign: {
      id:              campaign.id,
      title:           campaign.title,
      description:     campaign.description,
      sponsorName:     campaign.sponsorName,
      sponsorLogo:     campaign.sponsorLogo,
      bundlesRemaining: campaign.bundlesRemaining,
      totalBundles:    campaign.totalBundles,
      status:          campaign.status,
      startDate:       campaign.startDate,
      endDate:         campaign.endDate,
      template: {
        id:          campaign.template.id,
        name:        campaign.template.name,
        description: campaign.template.description,
        items:       campaign.template.items,
      },
    },
    eligibility,
  });
}
