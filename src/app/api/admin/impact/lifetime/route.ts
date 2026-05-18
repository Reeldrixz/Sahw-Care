import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CARE_TYPES = ["register_fulfilled", "listing_completed", "bundle_delivered"];

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: { role: true },
  });
  if (admin?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [
    bundleApps,
    regRows,
    discoverRows,
    allCareActions,
    missionTeams,
    totalContributors,
    totalMissions,
    firstAction,
  ] = await Promise.all([
    prisma.bundleApplication.findMany({
      where:  { status: { in: ["APPROVED", "DELIVERED"] }, userId: { not: null } },
      select: { userId: true, status: true },
    }),
    prisma.fulfillmentQueue.findMany({
      where:  { status: "DELIVERED" },
      select: { registerItem: { select: { register: { select: { creatorId: true } } } } },
    }),
    prisma.request.findMany({
      where:  { status: { in: ["FULFILLED", "CONFIRMED"] } },
      select: { requesterId: true },
    }),
    prisma.missionAction.findMany({
      where:  { actionType: { in: CARE_TYPES } },
      select: { actionType: true, itemCount: true, createdAt: true, teamId: true },
    }),
    prisma.missionTeam.findMany({
      include: {
        mission: { select: { name: true, month: true } },
        _count:  { select: { members: true } },
        actions: {
          where:  { actionType: { in: CARE_TYPES } },
          select: { itemCount: true },
        },
      },
    }),
    prisma.user.count({ where: { journeyType: "donor" } }),
    prisma.mission.count(),
    prisma.missionAction.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);

  // ── Venn sets ────────────────────────────────────────────────────────────────
  const bundleMotherIds   = new Set(bundleApps.map(a => a.userId as string));
  const registerMotherIds = new Set(regRows.map(r => r.registerItem.register.creatorId));
  const discoverMotherIds = new Set(discoverRows.map(r => r.requesterId));
  const allServedIds      = new Set([...bundleMotherIds, ...registerMotherIds, ...discoverMotherIds]);
  const allThreeIds       = new Set([...bundleMotherIds].filter(id => registerMotherIds.has(id) && discoverMotherIds.has(id)));
  const totalMothers      = Math.max(allServedIds.size, 1);
  const pct               = (n: number) => Math.min(100, Math.round((n / totalMothers) * 100));

  // ── Channel card counts ───────────────────────────────────────────────────────
  const [bundlesDelivered, registersDelivered, discoverFulfilled, totalBundleApps, totalRegItems, totalDiscoverReqs] = await Promise.all([
    prisma.bundleApplication.count({ where: { status: "DELIVERED" } }),
    prisma.fulfillmentQueue.count({ where: { status: "DELIVERED" } }),
    prisma.request.count({ where: { status: { in: ["FULFILLED", "CONFIRMED"] } } }),
    prisma.bundleApplication.count(),
    prisma.registerItem.count({ where: { status: { notIn: ["CANCELLED"] } } }),
    prisma.request.count({ where: { status: { notIn: ["CANCELLED", "DECLINED", "REJECTED"] } } }),
  ]);

  // ── Monthly trend ─────────────────────────────────────────────────────────────
  const trendMap: Record<string, { bundles: number; registers: number; discover: number }> = {};
  for (const a of allCareActions) {
    const d  = new Date(a.createdAt);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!trendMap[mk]) trendMap[mk] = { bundles: 0, registers: 0, discover: 0 };
    const n = a.itemCount ?? 1;
    if (a.actionType === "bundle_delivered")   trendMap[mk].bundles   += n;
    if (a.actionType === "register_fulfilled") trendMap[mk].registers += n;
    if (a.actionType === "listing_completed")  trendMap[mk].discover  += n;
  }
  const trend = Object.keys(trendMap).sort().map(month => ({
    month,
    bundles:   trendMap[month].bundles,
    registers: trendMap[month].registers,
    discover:  trendMap[month].discover,
    total:     trendMap[month].bundles + trendMap[month].registers + trendMap[month].discover,
  }));

  // ── Top 5 teams ──────────────────────────────────────────────────────────────
  const topTeams = missionTeams
    .map(t => {
      const lifetimeEssentials = t.actions.reduce((s, a) => s + (a.itemCount ?? 1), 0);
      let remaining = lifetimeEssentials, bv = 5, threshold = 200, tier = 1;
      while (remaining >= threshold) { remaining -= threshold; tier++; bv *= 2; threshold = bv * 40; }
      return {
        id: t.id,
        missionName:       t.mission.name,
        month:             t.mission.month,
        memberCount:       t._count.members,
        lifetimeEssentials,
        tier,
      };
    })
    .sort((a, b) => b.lifetimeEssentials - a.lifetimeEssentials)
    .slice(0, 5);

  const totalEssentials = allCareActions.reduce((s, a) => s + (a.itemCount ?? 1), 0);

  return NextResponse.json({
    firstActionDate: firstAction?.createdAt ?? null,
    venn: {
      totalMothersInNeed: totalMothers,
      bundles:      { helped: bundleMotherIds.size,   percent: pct(bundleMotherIds.size)   },
      registers:    { helped: registerMotherIds.size, percent: pct(registerMotherIds.size) },
      discover:     { helped: discoverMotherIds.size, percent: pct(discoverMotherIds.size) },
      allThreeAreas:{ helped: allThreeIds.size,       percent: pct(allThreeIds.size)       },
    },
    channels: {
      bundles:   { delivered: bundlesDelivered,   momsReached: bundleMotherIds.size,   total: totalBundleApps  },
      registers: { delivered: registersDelivered, momsReached: registerMotherIds.size, total: totalRegItems    },
      discover:  { fulfilled: discoverFulfilled,  momsReached: discoverMotherIds.size, total: totalDiscoverReqs },
    },
    trend,
    topTeams,
    fulfillmentRates: {
      bundles:        totalBundleApps   > 0 ? Math.round((bundlesDelivered   / totalBundleApps)   * 100) : 0,
      registers:      totalRegItems     > 0 ? Math.round((registersDelivered / totalRegItems)     * 100) : 0,
      discover:       totalDiscoverReqs > 0 ? Math.round((discoverFulfilled  / totalDiscoverReqs) * 100) : 0,
      bundlesTotal:   totalBundleApps,
      registersTotal: totalRegItems,
      discoverTotal:  totalDiscoverReqs,
    },
    totals: {
      momsServed:   allServedIds.size,
      contributors: totalContributors,
      essentials:   totalEssentials,
      missions:     totalMissions,
    },
  });
}
