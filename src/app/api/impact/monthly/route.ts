import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
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
    // Union of mothers with an active or recently-resolved need during this month.
    // Carryover: a mother who created a register in March and got fulfilled in May
    // counts in May's denominator AND numerator — so helped ≤ total always holds.
    const [needReqs, needRegs, needBundles] = await Promise.all([

      // Discover requests: not cancelled/declined, created before month-end,
      // either still unfulfilled OR updated this month (covers fulfillments this month)
      prisma.request.findMany({
        where: {
          createdAt: { lte: monthEnd },
          status:    { notIn: ["CANCELLED", "DECLINED", "REJECTED"] },
          OR: [
            { status: { notIn: ["FULFILLED", "CONFIRMED"] } },
            { updatedAt: { gte: monthStart } },
          ],
        },
        select: { requesterId: true },
      }),

      // Registers: not abandoned, created before month-end,
      // not completed AND not closed before this month started
      prisma.register.findMany({
        where: {
          status:    { notIn: ["ABANDONED"] },
          createdAt: { lte: monthEnd },
          AND: [
            { OR: [{ completedAt: null }, { completedAt: { gte: monthStart } }] },
            { OR: [{ closedAt: null },    { closedAt:    { gte: monthStart } }] },
          ],
        },
        select: { creatorId: true },
      }),

      // Bundle applications: not rejected, requested before month-end,
      // either never delivered OR delivered this month
      prisma.bundleInstance.findMany({
        where: {
          requestedAt: { lte: monthEnd },
          status:      { notIn: ["REJECTED"] },
          OR: [
            { deliveredAt: null },
            { deliveredAt: { gte: monthStart } },
          ],
        },
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
      // Safety net: fall back to all active recipients if platform has no activity yet
      totalMothersInNeed = await prisma.user.count({
        where: { role: "RECIPIENT", status: "ACTIVE" },
      });
    }
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
      bundles:       { helped: bundlesHelped,   percent: pct(bundlesHelped)   },
      registers:     { helped: registersHelped, percent: pct(registersHelped) },
      discover:      { helped: discoverHelped,  percent: pct(discoverHelped)  },
      allThreeAreas: { helped: allThreeHelped,  percent: pct(allThreeHelped)  },
      overallPercent: pct(anyHelped),
      tagline: "You show up. They feel it. We all rise together.",
    });
  } catch (e) {
    console.error("[/api/impact/monthly]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
