import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { monthlyCooldown } from "@/lib/cooldowns";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [bundles, currentUser] = await Promise.all([
    prisma.bundle.findMany({
      where: { isActive: true },
      orderBy: [{ stage: "asc" }, { code: "asc" }],
      include: {
        _count: {
          select: {
            applications: {
              where: {
                status: { in: ["PENDING", "APPROVED"] },
                createdAt: { gte: monthStart, lt: monthEnd },
              },
            },
          },
        },
      },
    }),
    getCurrentUser().catch(() => null),
  ]);

  let myActiveApplicationBundleId: string | null = null;
  let myLifetimeApproved = 0;
  let isRecipient = false;
  let bundleCooldownUntil: string | null = null;
  let bundleLastApprovedAt: string | null = null;

  if (currentUser) {
    const [existing, lifetimeCount, userRecord, lastApprovedBundle] = await Promise.all([
      prisma.bundleApplication.findFirst({
        where: {
          userId: currentUser.userId,
          status: { in: ["PENDING", "APPROVED"] },
          createdAt: { gte: monthStart, lt: monthEnd },
        },
        select: { bundleId: true },
      }),
      prisma.bundleApplication.count({
        where: {
          userId: currentUser.userId,
          status: { in: ["APPROVED", "DELIVERED"] },
        },
      }),
      prisma.user.findUnique({
        where:  { id: currentUser.userId },
        select: { role: true },
      }),
      prisma.bundleApplication.findFirst({
        where:   { userId: currentUser.userId, status: { in: ["APPROVED", "DELIVERED"] } },
        orderBy: { reviewedAt: "desc" },
        select:  { reviewedAt: true },
      }),
    ]);
    myActiveApplicationBundleId = existing?.bundleId ?? null;
    myLifetimeApproved = lifetimeCount;
    isRecipient = userRecord?.role === "RECIPIENT";

    // Monthly receipt cooldown (keyed off last approval, independent of formula).
    const cd = monthlyCooldown(lastApprovedBundle?.reviewedAt ?? null);
    if (cd.active) {
      bundleCooldownUntil  = cd.nextEligibleAt?.toISOString() ?? null;
      bundleLastApprovedAt = cd.lastApprovedAt?.toISOString() ?? null;
    }
  }

  const data = bundles.map((b) => ({
    id:               b.id,
    code:             b.code,
    name:             b.name,
    stage:            b.stage,
    description:      b.description,
    contentsMarkdown: b.contentsMarkdown,
    slotsPerMonth:    b.slotsPerMonth,
    slotsUsed:        b._count.applications,
    slotsRemaining:   Math.max(0, b.slotsPerMonth - b._count.applications),
    itemCount:        b.contentsMarkdown.split("\n").filter((l) => l.startsWith("- ")).length,
    sponsorName:      b.sponsorName,
    sponsorUrl:       b.sponsorUrl,
  }));

  return NextResponse.json({ bundles: data, myActiveApplicationBundleId, myLifetimeApproved, isRecipient, bundleCooldownUntil, bundleLastApprovedAt });
}
