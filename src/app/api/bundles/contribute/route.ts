import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { awardImpactPoints } from "@/lib/trust";
import { logAbuseEvent } from "@/lib/abuse";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, role: true, journeyType: true, trustScore: true, impactScore: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { bundleCount } = await req.json();
  if (!bundleCount || bundleCount < 1 || bundleCount > 100) {
    return NextResponse.json({ error: "Bundle count must be between 1 and 100" }, { status: 400 });
  }

  const goal = await prisma.monthlyBundleGoal.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      contributions: { where: { status: "CONFIRMED" }, select: { bundleCount: true } },
    },
  });
  if (!goal) return NextResponse.json({ error: "No active funding goal" }, { status: 404 });

  const amountCents = bundleCount * goal.costPerBundle;

  const contribution = await prisma.bundleContribution.create({
    data: {
      goalId: goal.id,
      donorId: user.id,
      bundleCount,
      amountCents,
      status: "CONFIRMED",
    },
  });

  // Update goal's funded-today counter (fire-and-forget)
  prisma.monthlyBundleGoal.update({
    where: { id: goal.id },
    data: { bundlesFundedToday: { increment: bundleCount } },
  }).catch(() => {});

  // Award impact points: +20 per bundle
  awardImpactPoints(user.id, "BUNDLE_FUNDED").catch(() => {});
  // (awardImpactPoints is per-event; call once per bundle)
  if (bundleCount > 1) {
    for (let i = 1; i < bundleCount; i++) {
      awardImpactPoints(user.id, "BUNDLE_FUNDED").catch(() => {});
    }
  }

  // Abuse event log
  logAbuseEvent(user.id, "BUNDLE_REQUESTED", user.trustScore, {
    bundleCount, amountCents, goalId: goal.id,
  }, req).catch(() => {});

  // Recalculate funded bundles for response
  const fundedBundles = goal.contributions.reduce((s, c) => s + c.bundleCount, 0) + bundleCount;
  const percentFunded = Math.min(100, Math.round((fundedBundles / goal.targetBundles) * 100));
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysRemaining = Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return NextResponse.json({
    contribution: { id: contribution.id, bundleCount, amountCents },
    goal: { fundedBundles, targetBundles: goal.targetBundles, percentFunded, daysRemaining },
  });
}
