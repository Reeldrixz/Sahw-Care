import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {

  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Users with a recent DISPATCHED or DELIVERED allocation
  const recentlyAllocated = await prisma.bundleAllocation.findMany({
    where: {
      status: { in: ["DISPATCHED", "DELIVERED"] },
      allocatedAt: { gte: sixtyDaysAgo },
    },
    select: { recipientId: true },
  });
  const excludedIds = new Set(recentlyAllocated.map(a => a.recipientId));

  const mothers = await prisma.user.findMany({
    where: {
      journeyType: { in: ["pregnant", "postpartum"] },
      verificationLevel: { gte: 2 },
      trustScore: { gte: 60 },
      status: "ACTIVE",
      createdAt: { lte: sevenDaysAgo },
      id: { notIn: [...excludedIds] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatar: true,
      trustScore: true,
      verificationLevel: true,
      journeyType: true,
      currentStage: true,
      dueDate: true,
      babyBirthDate: true,
      createdAt: true,
      location: true,
    },
    orderBy: [
      { trustScore: "desc" },
      { createdAt: "asc" },
    ],
  });

  // Sort by due date proximity first (those with due dates soonest), then trust, then wait time
  const now = new Date();
  const sorted = mothers.sort((a, b) => {
    // If both have due dates, sort by proximity
    if (a.dueDate && b.dueDate) {
      const diffA = Math.abs(new Date(a.dueDate).getTime() - now.getTime());
      const diffB = Math.abs(new Date(b.dueDate).getTime() - now.getTime());
      return diffA - diffB;
    }
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    // Otherwise by trust score desc, then wait time asc
    if (b.trustScore !== a.trustScore) return b.trustScore - a.trustScore;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return NextResponse.json({ mothers: sorted });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
