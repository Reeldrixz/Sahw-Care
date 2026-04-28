import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [goal, allTimeAgg] = await Promise.all([
    prisma.monthlyBundleGoal.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { contributions: true, allocations: true } },
        contributions: {
          where: { status: "CONFIRMED" },
          select: { bundleCount: true },
        },
        allocations: {
          where: { status: "DELIVERED" },
          select: { id: true },
        },
      },
    }),
    prisma.monthlyBundleGoal.aggregate({ _sum: { deliveredBundles: true } }),
  ]);

  const totalBundlesAllTime = allTimeAgg._sum.deliveredBundles ?? 0;

  if (!goal) {
    return NextResponse.json({ goal: null, totalBundlesAllTime });
  }

  const fundedBundles = goal.contributions.reduce((sum, c) => sum + c.bundleCount, 0);
  const mothersSupportedThisMonth = goal.allocations.length;

  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysRemaining = Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const percentFunded = goal.targetBundles > 0
    ? Math.min(100, Math.round((fundedBundles / goal.targetBundles) * 100))
    : 0;

  const isFullyFunded = fundedBundles >= goal.targetBundles;

  return NextResponse.json({
    goal: {
      id: goal.id,
      month: goal.month,
      targetBundles: goal.targetBundles,
      fundedBundles,
      deliveredBundles: goal.deliveredBundles,
      bundlesFundedToday: goal.bundlesFundedToday,
      costPerBundle: goal.costPerBundle,
      daysRemaining,
      percentFunded,
      contributorCount: goal._count.contributions,
      mothersSupportedThisMonth,
      isFullyFunded,
    },
    totalBundlesAllTime,
  });
}
