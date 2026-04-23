import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { recipientId, bundleType, goalId, deliveryAddress, notes } = await req.json();
  if (!recipientId || !bundleType || !goalId) {
    return NextResponse.json({ error: "recipientId, bundleType, and goalId are required" }, { status: 400 });
  }

  const goal = await prisma.monthlyBundleGoal.findUnique({ where: { id: goalId } });
  if (!goal || goal.status !== "ACTIVE") {
    return NextResponse.json({ error: "Goal not found or not active" }, { status: 404 });
  }

  const allocation = await prisma.bundleAllocation.create({
    data: { goalId, recipientId, bundleType, deliveryAddress, notes },
  });

  return NextResponse.json({ allocation }, { status: 201 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const allocations = await prisma.bundleAllocation.findMany({
    orderBy: { allocatedAt: "desc" },
    include: {
      recipient: { select: { id: true, name: true, email: true, phone: true, location: true } },
      goal: { select: { month: true } },
    },
  });

  return NextResponse.json({ allocations });
}
