import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const BLOCKS: Record<string, number>     = { click: 1, listing: 2, donation: 4 };
const LABELS: Record<string, string>     = {
  click:    "Someone discovered Kradel through a shared link. That awareness helps more mothers find support.",
  listing:  "A new donor joined and listed their first item. That's one more family ready to help.",
  donation: "A donation was completed through your mission. That directly helped fund maternal essentials.",
};

// POST /api/missions/action — records a link-click action for a specific team
// Used when a visitor lands on /missions?ref={teamId} while logged in.
export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId, actionType } = await req.json();

  if (!teamId || !actionType) {
    return NextResponse.json({ error: "teamId and actionType required" }, { status: 400 });
  }
  if (!BLOCKS[actionType]) {
    return NextResponse.json({ error: "Invalid actionType" }, { status: 400 });
  }

  const team = await prisma.missionTeam.findUnique({
    where:   { id: teamId },
    include: { mission: true },
  });
  if (!team || !team.mission.isActive) {
    return NextResponse.json({ error: "Team not found or mission inactive" }, { status: 404 });
  }

  const blocks     = BLOCKS[actionType];
  const humanLabel = LABELS[actionType];

  await prisma.$transaction([
    prisma.missionAction.create({
      data: { teamId, userId: auth.userId, actionType, blocks, humanLabel },
    }),
    prisma.missionTeam.update({
      where: { id: teamId },
      data:  { totalBlocks: { increment: blocks } },
    }),
  ]);

  // Check completion
  const updated = await prisma.missionTeam.findUnique({
    where:   { id: teamId },
    include: { mission: true },
  });
  if (updated && !updated.isComplete && updated.totalBlocks >= updated.mission.goalBlocks) {
    await prisma.missionTeam.update({ where: { id: teamId }, data: { isComplete: true } });
  }

  return NextResponse.json({ ok: true, blocks });
}
