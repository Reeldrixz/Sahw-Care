import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const month      = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // ── Bundles channel ──────────────────────────────────────────────────────
    // Distinct RECIPIENT mothers who received a delivered BundleInstance this month
    const bundleRows = await prisma.bundleInstance.findMany({
      where: {
        status:      { in: ["DELIVERED", "COMPLETED"] },
        deliveredAt: { gte: monthStart },
      },
      select: { recipientId: true },
    });
    const bundleMotherIds = new Set(bundleRows.map(r => r.recipientId));

    // ── Registers channel ────────────────────────────────────────────────────
    // Distinct mothers (register creators) whose item was delivered via FulfillmentQueue this month
    const regRows = await prisma.fulfillmentQueue.findMany({
      where: {
        status:      "DELIVERED",
        deliveredAt: { gte: monthStart },
      },
      select: {
        registerItem: {
          select: { register: { select: { creatorId: true } } },
        },
      },
    });
    const registerMotherIds = new Set(regRows.map(r => r.registerItem.register.creatorId));

    // ── Discover channel ─────────────────────────────────────────────────────
    // Distinct mothers (requesters) whose discover request was fulfilled/confirmed this month
    const discoverRows = await prisma.request.findMany({
      where: {
        status:    { in: ["FULFILLED", "CONFIRMED"] },
        updatedAt: { gte: monthStart },
      },
      select: { requesterId: true },
    });
    const discoverMotherIds = new Set(discoverRows.map(r => r.requesterId));

    // ── All three areas ───────────────────────────────────────────────────────
    const allThreeIds = new Set(
      [...bundleMotherIds].filter(id => registerMotherIds.has(id) && discoverMotherIds.has(id)),
    );
    const anyChannelIds = new Set([
      ...bundleMotherIds,
      ...registerMotherIds,
      ...discoverMotherIds,
    ]);

    // ── Total mothers in need this month ──────────────────────────────────────
    // Union of all RECIPIENT users who showed any need this month
    const [needReqs, needRegs, needBundles] = await Promise.all([
      prisma.request.findMany({
        where: { createdAt: { gte: monthStart }, status: { not: "CANCELLED" } },
        select: { requesterId: true },
      }),
      prisma.register.findMany({
        where: { createdAt: { gte: monthStart } },
        select: { creatorId: true },
      }),
      prisma.bundleInstance.findMany({
        where: { requestedAt: { gte: monthStart }, status: { notIn: ["REJECTED"] } },
        select: { recipientId: true },
      }),
    ]);

    const needIds = new Set([
      ...needReqs.map(r => r.requesterId),
      ...needRegs.map(r => r.creatorId),
      ...needBundles.map(b => b.recipientId),
    ]);

    let totalMothersInNeed = needIds.size;
    if (totalMothersInNeed === 0) {
      // Fall back to all active recipients on the platform
      totalMothersInNeed = await prisma.user.count({
        where: { role: "RECIPIENT", status: "ACTIVE" },
      });
    }
    // Ensure denominator is never 0 to avoid division-by-zero
    const denom = Math.max(totalMothersInNeed, 1);

    const pct = (n: number) => Math.min(100, Math.round((n / denom) * 100));

    const bundlesHelped   = bundleMotherIds.size;
    const registersHelped = registerMotherIds.size;
    const discoverHelped  = discoverMotherIds.size;
    const allThreeHelped  = allThreeIds.size;
    const anyHelped       = anyChannelIds.size;

    // Privacy: only aggregate counts — no IDs, no names, ever
    return NextResponse.json({
      month,
      totalMothersInNeed,
      bundles:      { helped: bundlesHelped,   percent: pct(bundlesHelped)   },
      registers:    { helped: registersHelped, percent: pct(registersHelped) },
      discover:     { helped: discoverHelped,  percent: pct(discoverHelped)  },
      allThreeAreas: { helped: allThreeHelped, percent: pct(allThreeHelped)  },
      overallPercent: pct(anyHelped),
      tagline: "You show up. They feel it. We all rise together.",
    });
  } catch (e) {
    console.error("[/api/impact/monthly]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
