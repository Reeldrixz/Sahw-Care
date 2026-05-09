import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status   = searchParams.get("status") ?? "PENDING";
  const bundleId = searchParams.get("bundleId") ?? undefined;
  const limit    = Math.min(Number(searchParams.get("limit") ?? "50"), 100);
  const offset   = Number(searchParams.get("offset") ?? "0");

  const where = {
    ...(status !== "ALL" && { status: status as never }),
    ...(bundleId && { bundleId }),
  };

  const [applications, total] = await Promise.all([
    prisma.bundleApplication.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: limit,
      skip: offset,
      include: {
        bundle: { select: { id: true, code: true, name: true, stage: true, contentsMarkdown: true } },
        user:   { select: { email: true, currentStage: true } },
      },
    }),
    prisma.bundleApplication.count({ where }),
  ]);

  // Batch lifetime approved count
  const linkedUserIds  = applications.map(a => a.userId).filter((id): id is string => !!id);
  const unlinkedPhones = applications.filter(a => !a.userId).map(a => a.phone);

  const [userIdCounts, phoneCounts] = await Promise.all([
    linkedUserIds.length > 0
      ? prisma.bundleApplication.groupBy({
          by: ["userId"],
          where: { status: "APPROVED", userId: { in: linkedUserIds } },
          _count: { id: true },
        })
      : Promise.resolve([]),
    unlinkedPhones.length > 0
      ? prisma.bundleApplication.groupBy({
          by: ["phone"],
          where: { status: "APPROVED", phone: { in: unlinkedPhones }, userId: null },
          _count: { id: true },
        })
      : Promise.resolve([]),
  ]);

  const userIdCountMap = new Map(userIdCounts.map(r => [r.userId as string, r._count.id]));
  const phoneCountMap  = new Map(phoneCounts.map(r => [r.phone, r._count.id]));

  const now = Date.now();
  const data = applications.map(a => {
    const itemCount = a.bundle.contentsMarkdown.split("\n").filter(l => l.startsWith("- ")).length;
    const lifetimeApproved = a.userId
      ? (userIdCountMap.get(a.userId) ?? 0)
      : (phoneCountMap.get(a.phone) ?? 0);
    const daysSince = Math.floor((now - new Date(a.createdAt).getTime()) / 86400000);

    return {
      id:            a.id,
      bundleId:      a.bundleId,
      fullName:      a.fullName,
      phone:         a.phone,
      city:          a.city,
      province:      a.province,
      dueDate:       a.dueDate,
      babyDob:       a.babyDob,
      story:         a.story,
      streetAddress: a.streetAddress,
      unit:          a.unit,
      postalCode:    a.postalCode,
      status:        a.status,
      adminNote:     a.adminNote,
      reviewedAt:    a.reviewedAt,
      createdAt:     a.createdAt,
      bundle: {
        id:        a.bundle.id,
        code:      a.bundle.code,
        name:      a.bundle.name,
        stage:     a.bundle.stage,
        itemCount,
      },
      userEmail:        a.user?.email        ?? null,
      currentStage:     a.user?.currentStage ?? null,
      lifetimeApproved,
      daysSince,
    };
  });

  return NextResponse.json({ applications: data, total });
}
