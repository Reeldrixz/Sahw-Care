import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculateTrustScore, syncTrustRating } from "@/lib/trust";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ instanceId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { instanceId } = await params;

  const instance = await prisma.bundleInstance.findUnique({
    where: { id: instanceId },
  });

  if (!instance || instance.recipientId !== auth.userId) {
    return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
  }

  if (!["SHIPPED", "DELIVERED"].includes(instance.status)) {
    return NextResponse.json({ error: "Bundle is not yet shipped" }, { status: 400 });
  }

  await prisma.bundleInstance.update({
    where: { id: instanceId },
    data:  { status: "COMPLETED", confirmedAt: new Date() },
  });

  await prisma.user.update({
    where: { id: auth.userId },
    data:  {
      activeBundleId:       null,
      lastBundleCompletedAt: new Date(),
    },
  });

  // Trust score +10 for confirming receipt
  const newScore = await recalculateTrustScore(auth.userId);
  await syncTrustRating(auth.userId, Math.min(100, newScore + 10));

  return NextResponse.json({ confirmed: true });
}
