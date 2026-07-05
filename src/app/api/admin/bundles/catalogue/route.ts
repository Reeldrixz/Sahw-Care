import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const bundles = await prisma.bundle.findMany({
    orderBy: [{ stage: "asc" }, { code: "asc" }],
    include: {
      _count: {
        select: {
          applications: true,
        },
      },
      applications: {
        where: { createdAt: { gte: monthStart, lt: monthEnd } },
        select: { status: true },
      },
    },
  });

  const data = bundles.map((b) => {
    const monthApps  = b.applications;
    const pending    = monthApps.filter((a) => a.status === "PENDING").length;
    const approved   = monthApps.filter((a) => a.status === "APPROVED").length;
    const slotsUsed  = pending + approved;

    return {
      id: b.id,
      code: b.code,
      name: b.name,
      stage: b.stage,
      description: b.description,
      estimatedValue: b.estimatedValue,
      slotsPerMonth: b.slotsPerMonth,
      isActive: b.isActive,
      totalApplications: b._count.applications,
      monthPending: pending,
      monthApproved: approved,
      slotsUsed,
      slotsRemaining: Math.max(0, b.slotsPerMonth - slotsUsed),
    };
  });

  return NextResponse.json({ bundles: data });
}

// PATCH — toggle isActive or update slotsPerMonth
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, isActive, slotsPerMonth } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const bundle = await prisma.bundle.update({
    where: { id },
    data: {
      ...(isActive !== undefined && { isActive }),
      ...(slotsPerMonth !== undefined && { slotsPerMonth }),
    },
  });

  return NextResponse.json({ bundle });
}
