import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
  const { id } = await params;
  const { status, deliveryAddress, notes } = await req.json();

  const validStatuses = ["QUEUED", "APPROVED", "DISPATCHED", "DELIVERED"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const allocation = await prisma.bundleAllocation.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(status === "DISPATCHED" && { dispatchedAt: new Date() }),
      ...(deliveryAddress !== undefined && { deliveryAddress }),
      ...(notes !== undefined && { notes }),
    },
    include: {
      recipient: { select: { id: true, name: true } },
    },
  });

  // Notify mother when dispatched
  if (status === "DISPATCHED") {
    prisma.notification.create({
      data: {
        userId: allocation.recipientId,
        type: "RBW_RESTRICTION", // using an available type — ideally add BUNDLE_DISPATCHED
        message: `Your care bundle (${allocation.bundleType}) has been dispatched! Keep an eye out for delivery.`,
        link: "/bundles",
      },
    }).catch(() => {});

    // Update deliveredBundles on goal when dispatched
    prisma.monthlyBundleGoal.update({
      where: { id: allocation.goalId },
      data: { deliveredBundles: { increment: 1 } },
    }).catch(() => {});
  }

  return NextResponse.json({ allocation });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
