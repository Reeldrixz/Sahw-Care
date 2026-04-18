import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: {
      trustScore: true, trustFrozen: true, trustFrozenUntil: true,
      impactScore: true, donorLevel: true,
      bundleRestrictedUntil: true,
      streakCurrentDays: true, streakWeeksCompleted: true,
      dailyPointsEarned: true, dailyPointsDate: true,
      graceRequestsUsed: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const logs = await prisma.trustScoreLog.findMany({
    where:   { userId: auth.userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const lastDate = user.dailyPointsDate ? new Date(user.dailyPointsDate) : null;
  if (lastDate) lastDate.setHours(0, 0, 0, 0);
  const isToday = !!lastDate && lastDate.getTime() === today.getTime();
  const dailyPointsEarned = isToday ? user.dailyPointsEarned : 0;

  const rbwDaysLeft = user.bundleRestrictedUntil && user.bundleRestrictedUntil > new Date()
    ? Math.ceil((user.bundleRestrictedUntil.getTime() - Date.now()) / (86400 * 1000))
    : null;

  return NextResponse.json({
    trustScore:        user.trustScore,
    trustFrozen:       user.trustFrozen,
    trustFrozenUntil:  user.trustFrozenUntil,
    impactScore:       user.impactScore,
    donorLevel:        user.donorLevel,
    rbwDaysLeft,
    streakCurrentDays: user.streakCurrentDays,
    streakWeeksCompleted: user.streakWeeksCompleted,
    dailyPointsEarned,
    dailyPointsCap: 5,
    graceRequestsUsed: user.graceRequestsUsed,
    recentEvents: logs.map(e => ({
      id:          e.id,
      eventType:   e.eventType,
      pointsDelta: e.pointsDelta,
      newScore:    e.newScore,
      createdAt:   e.createdAt,
    })),
  });
}
