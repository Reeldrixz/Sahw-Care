import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [
    totalItems,
    activeItems,
    totalUsers,
    activeUsers,
    totalRequests,
    fulfilledRequests,
    pendingReports,
    verifiedUsers,
    lowTrustUsers,
    pendingOverrides,
    totalRegisters,
    pendingDocuments,
  ] = await Promise.all([
    prisma.item.count(),
    prisma.item.count({ where: { status: "ACTIVE" } }),
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.request.count(),
    prisma.request.count({ where: { status: "FULFILLED" } }),
    prisma.report.count({ where: { status: "PENDING" } }),
    prisma.user.count({ where: { verificationLevel: { gte: 1 } } }),
    prisma.user.count({ where: { trustScore: { lt: 40 } } }),
    prisma.urgentOverride.count({ where: { reviewed: false } }),
    prisma.register.count(),
    prisma.user.count({ where: { docStatus: "PENDING" } }),
  ]);

  const fulfilmentRate =
    totalRequests > 0 ? Math.round((fulfilledRequests / totalRequests) * 100) : 0;

  const recentActivity = await prisma.item.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
    include: { donor: { select: { name: true } } },
  });

  return NextResponse.json({
    stats: {
      totalItems,
      activeItems,
      totalUsers,
      activeUsers,
      totalRequests,
      fulfilledRequests,
      fulfilmentRate,
      pendingReports,
      verifiedUsers,
      lowTrustUsers,
      pendingOverrides,
      totalRegisters,
      pendingDocuments,
    },
    recentActivity,
  });
}
