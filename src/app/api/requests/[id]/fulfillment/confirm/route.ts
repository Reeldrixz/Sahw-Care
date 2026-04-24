import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { awardTrust, deductTrustPoints, awardImpactPoints } from "@/lib/trust";
import { createAbuseFlag, logAbuseEvent } from "@/lib/abuse";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/requests/[id]/fulfillment/confirm
 * Recipient responds YES or NO to a pending fulfillment.
 *
 * YES → VERIFIED: donor +10 trust + impact, recipient +5 trust, request FULFILLED
 * NO  → DISPUTED: donor -10 trust, report created, notify donor
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id: requestId } = await params;
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const response = body.response as string | undefined;
  if (!response || !["YES", "NO"].includes(response)) {
    return NextResponse.json({ error: 'response must be "YES" or "NO"' }, { status: 400 });
  }

  const request = await prisma.request.findUnique({
    where:   { id: requestId },
    include: {
      item:        { select: { id: true, title: true, donorId: true, donor: { select: { name: true } } } },
      requester:   { select: { id: true, name: true } },
      fulfillment: true,
    },
  });

  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (request.requesterId !== auth.userId) {
    return NextResponse.json({ error: "Only the recipient can confirm fulfillment" }, { status: 403 });
  }
  if (!request.fulfillment) {
    return NextResponse.json({ error: "No fulfillment has been recorded for this request" }, { status: 400 });
  }
  if (request.fulfillment.status !== "PENDING") {
    return NextResponse.json({ error: "Fulfillment already resolved" }, { status: 409 });
  }

  const now = new Date();
  const donorId     = request.item.donorId;
  const recipientId = request.requesterId;
  const fulfillId   = request.fulfillment.id;

  if (response === "YES") {
    await prisma.$transaction([
      prisma.requestFulfillment.update({
        where: { id: fulfillId },
        data:  { status: "VERIFIED", recipientResponse: "YES", respondedAt: now },
      }),
      prisma.request.update({
        where: { id: requestId },
        data:  { status: "FULFILLED" },
      }),
    ]);

    // Trust + impact awards (fire-and-forget)
    Promise.all([
      awardTrust(donorId,     "REQUEST_FULFILLMENT_VERIFIED",      { referenceId: fulfillId, referenceType: "RequestFulfillment", reason: "recipient confirmed receipt" }),
      awardTrust(recipientId, "REQUEST_RECEIPT_CONFIRMED",         { referenceId: fulfillId, referenceType: "RequestFulfillment", reason: "confirmed item received" }),
      awardImpactPoints(donorId, "FULFILLED_REQUEST", requestId),
    ]).catch(() => {});

    // Notify donor
    prisma.notification.create({
      data: {
        userId:            donorId,
        type:              "FULFILLMENT_CONFIRMED",
        message:           `${request.requester.name.split(" ")[0]} confirmed they received your item — thank you! 💛`,
        link:              "/",
        triggeredByUserId: recipientId,
      },
    }).catch(() => {});

    return NextResponse.json({ confirmed: true, status: "VERIFIED" });
  }

  // NO — disputed
  const disputeReason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "Item not received as described";

  await prisma.$transaction([
    prisma.requestFulfillment.update({
      where: { id: fulfillId },
      data:  { status: "DISPUTED", recipientResponse: "NO", respondedAt: now },
    }),
    prisma.report.create({
      data: {
        reason:       disputeReason,
        reporterId:   recipientId,
        targetUserId: donorId,
      },
    }),
  ]);

  // Deduct trust from donor (fire-and-forget)
  deductTrustPoints(donorId, "FULFILLMENT_DISPUTED", 10, {
    referenceId: fulfillId, referenceType: "RequestFulfillment",
    reason: "fulfillment disputed by recipient",
  }).catch(() => {});

  // Log abuse event + check for high-dispute pattern (fire-and-forget)
  Promise.all([
    logAbuseEvent(donorId, "FULFILLMENT_DISPUTED", 0, { requestId, fulfillId }, req),
    checkHighDisputePattern(donorId),
  ]).catch(() => {});

  // Notify donor
  prisma.notification.create({
    data: {
      userId:            donorId,
      type:              "FULFILLMENT_DISPUTED",
      message:           `${request.requester.name.split(" ")[0]} reported they did not receive your item. Our team will review it.`,
      link:              "/",
      triggeredByUserId: recipientId,
    },
  }).catch(() => {});

  return NextResponse.json({ confirmed: false, status: "DISPUTED" });
}

async function checkHighDisputePattern(donorId: string): Promise<void> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const disputes = await prisma.requestFulfillment.count({
    where: {
      request: { item: { donorId } },
      status:  "DISPUTED",
      respondedAt: { gte: since },
    },
  });
  if (disputes >= 3) {
    await createAbuseFlag(donorId, "HIGH_UNVERIFIED_FULFILLMENTS", "HIGH", {
      disputes30d: disputes,
      detectedAt: new Date().toISOString(),
    });
  }
}
