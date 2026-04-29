import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { role: true, journeyType: true, impactScore: true, donorLevel: true, totalFundedCents: true, fundingCount: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "ADMIN") {
    const [totalUsers, pendingReports, activeItems, pendingDocuments, bundlesPending] = await Promise.all([
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.report.count({ where: { status: "PENDING" } }),
      prisma.item.count({ where: { status: "ACTIVE" } }),
      prisma.user.count({ where: { docStatus: "PENDING" } }),
      prisma.bundleInstance.count({ where: { status: { in: ["REQUESTED", "APPROVED"] } } }),
    ]);
    return NextResponse.json({ role: "ADMIN", totalUsers, pendingReports, activeItems, pendingDocuments, bundlesPending });
  }

  if (user.journeyType === "donor") {
    const [itemsTotal, itemsActive, itemsFulfilled] = await Promise.all([
      prisma.item.count({ where: { donorId: auth.userId } }),
      prisma.item.count({ where: { donorId: auth.userId, status: "ACTIVE" } }),
      prisma.item.count({ where: { donorId: auth.userId, status: "FULFILLED" } }),
    ]);
    return NextResponse.json({
      role: "DONOR",
      itemsTotal, itemsActive, itemsFulfilled,
      impactScore: user.impactScore,
      donorLevel: user.donorLevel,
      totalFundedCents: user.totalFundedCents,
      fundingCount: user.fundingCount,
    });
  }

  // Recipient
  const [requestsTotal, requestsPending, requestsFulfilled, registersCount] = await Promise.all([
    prisma.request.count({ where: { requesterId: auth.userId } }),
    prisma.request.count({ where: { requesterId: auth.userId, status: "PENDING" } }),
    prisma.request.count({ where: { requesterId: auth.userId, status: "FULFILLED" } }),
    prisma.register.count({ where: { creatorId: auth.userId } }),
  ]);
  return NextResponse.json({ role: "RECIPIENT", requestsTotal, requestsPending, requestsFulfilled, registersCount });
}
