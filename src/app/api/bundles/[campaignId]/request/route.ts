import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkEligibility } from "@/app/api/bundles/route";
import {
  sendBundleRequestReceived,
  sendAdminNewBundleRequest,
} from "@/lib/email";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ campaignId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaignId } = await params;
  const { deliveryAddress } = await req.json();

  if (!deliveryAddress || !deliveryAddress.fullName || !deliveryAddress.address || !deliveryAddress.city) {
    return NextResponse.json({ error: "Delivery address (fullName, address, city) is required" }, { status: 400 });
  }

  const [campaign, user] = await Promise.all([
    prisma.campaign.findUnique({ where: { id: campaignId }, include: { template: true } }),
    prisma.user.findUnique({
      where:  { id: auth.userId },
      select: {
        id: true, name: true, email: true, location: true,
        journeyType: true, docStatus: true, trustScore: true,
        currentStage: true, countryCode: true,
        activeBundleId: true, lastBundleCompletedAt: true,
      },
    }),
  ]);

  if (!campaign || campaign.status !== "ACTIVE") {
    return NextResponse.json({ error: "Campaign not available" }, { status: 404 });
  }
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const daysSinceBundle = user.lastBundleCompletedAt
    ? (Date.now() - new Date(user.lastBundleCompletedAt).getTime()) / (86400 * 1000)
    : null;

  const eligibility = checkEligibility(user, campaign, daysSinceBundle);
  if (!eligibility.eligible) {
    return NextResponse.json({ error: `Not eligible: ${eligibility.reason}` }, { status: 403 });
  }

  // Atomic: decrement bundlesRemaining + create instance
  const [instance] = await prisma.$transaction([
    prisma.bundleInstance.create({
      data: {
        campaignId,
        templateId:     campaign.templateId,
        recipientId:    auth.userId,
        status:         "REQUESTED",
        deliveryAddress,
      },
    }),
    prisma.campaign.update({
      where: { id: campaignId },
      data:  { bundlesRemaining: { decrement: 1 } },
    }),
  ]);

  await prisma.user.update({
    where: { id: auth.userId },
    data:  { activeBundleId: instance.id },
  });

  // Notifications (fire-and-forget)
  const firstName = user.name.split(" ")[0];
  const city = deliveryAddress.city ?? user.location?.split(",")[0] ?? "";
  sendBundleRequestReceived({ firstName, email: user.email, templateName: campaign.template.name }).catch(() => {});
  sendAdminNewBundleRequest({ firstName, city, templateName: campaign.template.name, instanceId: instance.id }).catch(() => {});

  return NextResponse.json({ instance: { id: instance.id, status: instance.status } }, { status: 201 });
}
