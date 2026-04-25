import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {

  const goal = await prisma.monthlyBundleGoal.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: {
      contributions: {
        orderBy: { createdAt: "desc" },
        include: { donor: { select: { id: true, name: true, email: true } } },
      },
      allocations: {
        select: { id: true, bundleType: true, status: true, allocatedAt: true },
      },
    },
  });

  if (!goal) return NextResponse.json({ goal: null });

  const fundedBundles = goal.contributions
    .filter(c => c.status === "CONFIRMED")
    .reduce((s, c) => s + c.bundleCount, 0);

  const allocationStats = {
    queued: goal.allocations.filter(a => a.status === "QUEUED").length,
    approved: goal.allocations.filter(a => a.status === "APPROVED").length,
    dispatched: goal.allocations.filter(a => a.status === "DISPATCHED").length,
    delivered: goal.allocations.filter(a => a.status === "DELIVERED").length,
  };

  return NextResponse.json({ goal: { ...goal, fundedBundles, allocationStats } });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {

  const { targetBundles, costPerBundle, month } = await req.json();
  if (!targetBundles || !costPerBundle) {
    return NextResponse.json({ error: "targetBundles and costPerBundle are required" }, { status: 400 });
  }

  // Only one ACTIVE goal at a time
  const existing = await prisma.monthlyBundleGoal.findFirst({ where: { status: "ACTIVE" } });
  if (existing) {
    return NextResponse.json({ error: "An active goal already exists. Close it before creating a new one." }, { status: 409 });
  }

  const now = new Date();
  const goalMonth = month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const goal = await prisma.monthlyBundleGoal.create({
    data: { month: goalMonth, targetBundles: Number(targetBundles), costPerBundle: Number(costPerBundle) },
  });

  return NextResponse.json({ goal }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {

  const { goalId, status } = await req.json();
  if (!goalId) return NextResponse.json({ error: "goalId required" }, { status: 400 });

  const goal = await prisma.monthlyBundleGoal.update({
    where: { id: goalId },
    data: { ...(status && { status }), },
  });

  return NextResponse.json({ goal });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
