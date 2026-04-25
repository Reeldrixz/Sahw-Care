import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculateTrustScore, syncTrustRating } from "@/lib/trust";

export const dynamic = "force-dynamic";

// GET — list all users with trust data
export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth || auth.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {

  const users = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, phone: true,
      trustScore: true, trustRating: true,
      verificationLevel: true, phoneVerified: true, emailVerified: true,
      status: true, urgentOverridesUsed: true,
      _count: { select: { categoryCooldowns: true, urgentOverrides: true } },
    },
    orderBy: { trustScore: "asc" }, // lowest trust first (most at-risk)
    take: 100,
  });

  return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — manually recalculate trust for a single user
export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth || auth.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const newScore = await recalculateTrustScore(userId);
  await syncTrustRating(userId, newScore);

  return NextResponse.json({ userId, trustScore: newScore });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
