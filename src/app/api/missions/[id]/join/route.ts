import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST /api/missions/[id]/join
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: missionId } = await params;
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mission = await prisma.mission.findUnique({ where: { id: missionId } });
  if (!mission || !mission.isActive) {
    return NextResponse.json({ error: "Mission not found or inactive" }, { status: 404 });
  }

  // Donor can only be in one active mission at a time
  const existing = await prisma.missionMember.findFirst({
    where: { userId: auth.userId, isActive: true },
  });
  if (existing) {
    return NextResponse.json({ error: "You are already in an active mission. Leave it first." }, { status: 409 });
  }

  // Find a team with fewer than 5 active members
  const teams = await prisma.missionTeam.findMany({
    where:   { missionId },
    include: { _count: { select: { members: { where: { isActive: true } } } } },
  });

  const existing2 = teams.find((t) => t._count.members < 5) ?? null;

  let teamId: string;
  if (existing2) {
    teamId = existing2.id;
  } else {
    const newTeam = await prisma.missionTeam.create({ data: { missionId } });
    teamId = newTeam.id;
  }

  await prisma.missionMember.create({
    data: { teamId, userId: auth.userId },
  });

  return NextResponse.json({ ok: true, teamId, missionId });
}
