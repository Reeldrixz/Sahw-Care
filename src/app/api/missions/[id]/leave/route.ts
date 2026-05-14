import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/missions/[id]/leave
// Only allowed once per month — enforced by checking for any inactive membership
// for a mission in the same month.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: missionId } = await params;
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mission = await prisma.mission.findUnique({ where: { id: missionId } });
  if (!mission) return NextResponse.json({ error: "Mission not found" }, { status: 404 });

  // Find the active membership for this mission
  const membership = await prisma.missionMember.findFirst({
    where: { userId: auth.userId, isActive: true, team: { missionId } },
    include: { team: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "You are not a member of this mission" }, { status: 400 });
  }

  // Only allowed once per month — check for prior inactive membership in same month
  const priorLeave = await prisma.missionMember.findFirst({
    where: {
      userId:   auth.userId,
      isActive: false,
      team:     { mission: { month: mission.month } },
    },
  });
  if (priorLeave) {
    return NextResponse.json({
      error: "You can only leave one mission per month.",
    }, { status: 429 });
  }

  // Check if past the 1st of the month (leave disabled after cutoff)
  const now       = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const cutoff     = new Date(monthStart.getTime() + 24 * 60 * 60 * 1000); // 2nd of month
  if (now >= cutoff) {
    return NextResponse.json({
      error: "Leaving a mission is only allowed before the 2nd of the month.",
    }, { status: 403 });
  }

  await prisma.missionMember.update({
    where: { id: membership.id },
    data:  { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
