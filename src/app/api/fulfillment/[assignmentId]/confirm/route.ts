import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculateTrustScore, syncTrustRating } from "@/lib/trust";
import { recordFulfilment } from "@/lib/cooldown";

export const dynamic = "force-dynamic";

/**
 * POST /api/fulfillment/[assignmentId]/confirm
 *
 * Called by the mom (register creator) to confirm she received the item.
 * When both donor status = DELIVERED and mom confirms → full fulfilment:
 *   - FulfillmentLog updated
 *   - Category cooldown recorded for the mom
 *   - Trust score recalculated for both parties
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await params;
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assignment = await prisma.itemAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      item: { include: { register: true } },
      fulfillmentLog: true,
    },
  });

  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  // Only the register creator (mom) can confirm receipt
  if (assignment.item.register.creatorId !== auth.userId) {
    return NextResponse.json({ error: "Only the register creator can confirm receipt" }, { status: 403 });
  }

  // Donor must have marked as DELIVERED first
  if (assignment.status !== "DELIVERED") {
    return NextResponse.json({
      error: "The donor must mark the item as delivered before you can confirm receipt.",
    }, { status: 400 });
  }

  const now = new Date();
  const donorConfirmed = assignment.status === "DELIVERED";

  // Upsert FulfillmentLog
  let log = assignment.fulfillmentLog;
  if (!log) {
    log = await prisma.fulfillmentLog.create({
      data: {
        assignmentId,
        donorConfirmed,
        donorConfirmedAt: donorConfirmed ? now : null,
        momConfirmed: true,
        momConfirmedAt: now,
      },
    });
  } else {
    if (log.momConfirmed) {
      return NextResponse.json({ error: "You already confirmed receipt of this item." }, { status: 400 });
    }
    log = await prisma.fulfillmentLog.update({
      where: { id: log.id },
      data: { momConfirmed: true, momConfirmedAt: now },
    });
  }

  // Check for mismatch (donor said delivered but mom denies — here mom confirms, so no mismatch)
  const mismatch = donorConfirmed !== log.momConfirmed && log.momConfirmed;
  if (mismatch) {
    await prisma.fulfillmentLog.update({ where: { id: log.id }, data: { mismatch: true } });
  }

  // ── Trigger downstream effects when both sides confirmed ──────────────
  if (donorConfirmed && log.momConfirmed && !mismatch) {
    const category = assignment.item.category;
    const momId = assignment.item.register.creatorId;

    // Record cooldown for mom
    await recordFulfilment(momId, category);

    // Recalculate trust for both parties
    const [momScore, donorScore] = await Promise.all([
      recalculateTrustScore(momId),
      recalculateTrustScore(assignment.donorId),
    ]);
    await Promise.all([
      syncTrustRating(momId, momScore),
      syncTrustRating(assignment.donorId, donorScore),
    ]);
  }

  return NextResponse.json({ confirmed: true, fullyFulfilled: donorConfirmed && log.momConfirmed });
}

/**
 * POST /api/fulfillment/[assignmentId]/dispute
 * Mom says item was NOT received as described → flag for admin review
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await params;
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reason } = await req.json();

  const assignment = await prisma.itemAssignment.findUnique({
    where: { id: assignmentId },
    include: { item: { include: { register: true } } },
  });
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (assignment.item.register.creatorId !== auth.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.fulfillmentLog.upsert({
      where: { assignmentId },
      update: { mismatch: true, momConfirmed: false, momConfirmedAt: new Date() },
      create: {
        assignmentId,
        donorConfirmed: assignment.status === "DELIVERED",
        momConfirmed: false,
        momConfirmedAt: new Date(),
        mismatch: true,
      },
    }),
    prisma.report.create({
      data: {
        reason: reason ?? "Fulfilment dispute: item not received as described",
        reporterId: auth.userId,
        targetUserId: assignment.donorId,
      },
    }),
  ]);

  return NextResponse.json({ disputed: true });
}
