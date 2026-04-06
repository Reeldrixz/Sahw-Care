import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalculateTrustScore, syncTrustRating } from "@/lib/trust";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status, role, isPremium, trustScore } = await req.json();

  const validStatuses = ["ACTIVE", "PENDING", "FLAGGED", "SUSPENDED"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(role && { role }),
      ...(isPremium !== undefined && { isPremium }),
      ...(trustScore !== undefined && { trustScore: Math.max(0, Math.min(100, Number(trustScore))) }),
    },
    select: { id: true, name: true, role: true, status: true, isPremium: true, trustScore: true },
  });

  // Re-sync trust rating after any update
  const newScore = await recalculateTrustScore(id);
  await syncTrustRating(id, newScore);

  return NextResponse.json({ user: { ...updated, trustScore: newScore } });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
