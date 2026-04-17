import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { trustScore: true, trustFrozen: true, trustFrozenUntil: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const events = await prisma.trustEvent.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    trustScore: user.trustScore,
    trustFrozen: user.trustFrozen,
    trustFrozenUntil: user.trustFrozenUntil,
    recentEvents: events.map(e => ({
      id: e.id,
      eventType: e.eventType,
      pointsDelta: e.pointsDelta,
      reason: e.reason,
      createdAt: e.createdAt,
    })),
  });
}
