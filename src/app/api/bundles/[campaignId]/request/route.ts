import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkEligibility } from "@/app/api/bundles/route";
import { checkRBW } from "@/lib/trust";
import { logAbuseEvent, runAbuseChecks } from "@/lib/abuse";
import {
  sendBundleRequestReceived,
  sendAdminNewBundleRequest,
} from "@/lib/email";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ campaignId: string }> };

const SAFE_STRING = /^[\w\s,.''\-#/()&]+$/;
const MAX_ADDR    = 200;

function validateAddress(addr: unknown): string | null {
  if (!addr || typeof addr !== "object") return "Delivery address is required";
  const a = addr as Record<string, unknown>;
  if (!a.fullName || typeof a.fullName !== "string" || !a.fullName.trim())
    return "fullName is required";
  if (!a.address  || typeof a.address  !== "string" || !a.address.trim())
    return "address is required";
  if (!a.city     || typeof a.city     !== "string" || !a.city.trim())
    return "city is required";
  if (a.fullName.length > MAX_ADDR || a.address.length > MAX_ADDR || a.city.length > MAX_ADDR)
    return "Address fields must be 200 characters or less";
  if (!SAFE_STRING.test(a.fullName) || !SAFE_STRING.test(a.city))
    return "Address contains invalid characters";
  return null;
}

export async function POST(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { campaignId } = await params;
  const { deliveryAddress } = await req.json();

  const addrError = validateAddress(deliveryAddress);
  if (addrError) return NextResponse.json({ error: addrError }, { status: 400 });

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

  const rbwRestriction = await checkRBW(auth.userId);
  if (rbwRestriction) {
    const daysLeft = Math.ceil((rbwRestriction.getTime() - Date.now()) / (86400 * 1000));
    return NextResponse.json({
      error: `Bundle access is temporarily restricted due to recent activity. Try again in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.`,
      code:     "RBW_RESTRICTED",
      daysLeft,
    }, { status: 403 });
  }

  // Atomic race-safe claim: decrement stock first (fails if 0), then create instance
  let instance;
  try {
    instance = await prisma.$transaction(async (tx) => {
      const updated = await tx.campaign.updateMany({
        where: { id: campaignId, bundlesRemaining: { gt: 0 } },
        data:  { bundlesRemaining: { decrement: 1 } },
      });
      if (updated.count === 0) {
        throw Object.assign(new Error("No bundles remaining"), { code: "OUT_OF_STOCK" });
      }
      return tx.bundleInstance.create({
        data: {
          campaignId,
          templateId:     campaign.templateId,
          recipientId:    auth.userId,
          status:         "REQUESTED",
          deliveryAddress,
        },
      });
    });
  } catch (err) {
    if ((err as { code?: string }).code === "OUT_OF_STOCK") {
      return NextResponse.json({ error: "This campaign is fully claimed. No bundles remaining." }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // activeBundleId set separately — non-critical, failure doesn't corrupt the claim
  prisma.user.update({
    where: { id: auth.userId },
    data:  { activeBundleId: instance.id },
  }).catch(() => {});

  // Log + run abuse checks (fire-and-forget)
  Promise.all([
    logAbuseEvent(auth.userId, "BUNDLE_REQUESTED", user.trustScore, { instanceId: instance.id, campaignId }, req),
    runAbuseChecks(auth.userId),
  ]).catch(() => {});

  // Notifications (fire-and-forget)
  const firstName = user.name.split(" ")[0];
  const city      = (deliveryAddress as Record<string, string>).city ?? user.location?.split(",")[0] ?? "";
  sendBundleRequestReceived({ firstName, email: user.email, templateName: campaign.template.name }).catch(() => {});
  sendAdminNewBundleRequest({ firstName, city, templateName: campaign.template.name, instanceId: instance.id }).catch(() => {});

  return NextResponse.json({ instance: { id: instance.id, status: instance.status } }, { status: 201 });
}
