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
      sponsorName: b.sponsorName,
      sponsorUrl: b.sponsorUrl,
      totalApplications: b._count.applications,
      monthPending: pending,
      monthApproved: approved,
      slotsUsed,
      slotsRemaining: Math.max(0, b.slotsPerMonth - slotsUsed),
    };
  });

  return NextResponse.json({ bundles: data });
}

// PATCH — toggle isActive, update slotsPerMonth, or set/clear sponsor fields.
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, isActive, slotsPerMonth, sponsorName, sponsorUrl } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Sponsor fields are manual/admin-set. Trim; empty string clears (null).
  // sponsorUrl must be http(s) so it can never become a javascript:/data: sink.
  let sponsorNameUpdate: { sponsorName: string | null } | undefined;
  if (sponsorName !== undefined) {
    const trimmed = typeof sponsorName === "string" ? sponsorName.trim() : "";
    sponsorNameUpdate = { sponsorName: trimmed.length ? trimmed : null };
  }

  let sponsorUrlUpdate: { sponsorUrl: string | null } | undefined;
  if (sponsorUrl !== undefined) {
    const trimmed = typeof sponsorUrl === "string" ? sponsorUrl.trim() : "";
    if (trimmed.length && !/^https?:\/\//i.test(trimmed)) {
      return NextResponse.json({ error: "Sponsor link must start with http:// or https://" }, { status: 400 });
    }
    sponsorUrlUpdate = { sponsorUrl: trimmed.length ? trimmed : null };
  }

  const bundle = await prisma.bundle.update({
    where: { id },
    data: {
      ...(isActive !== undefined && { isActive }),
      ...(slotsPerMonth !== undefined && { slotsPerMonth }),
      ...sponsorNameUpdate,
      ...sponsorUrlUpdate,
    },
  });

  return NextResponse.json({ bundle });
}
