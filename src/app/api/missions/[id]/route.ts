import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/missions/[id] — single mission detail with team stats
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const mission = await prisma.mission.findUnique({
    where:   { id },
    include: {
      teams: {
        include: {
          _count: { select: { members: { where: { isActive: true } } } },
          actions: { select: { actionType: true, blocks: true } },
        },
      },
    },
  });

  if (!mission) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const teams = mission.teams.map((t) => ({
    id:           t.id,
    memberCount:  t._count.members,
    totalBlocks:  t.totalBlocks,
    isComplete:   t.isComplete,
    spotsLeft:    Math.max(0, 5 - t._count.members),
    clickBlocks:    t.actions.filter(a => a.actionType === "click").reduce((s, a) => s + a.blocks, 0),
    listingBlocks:  t.actions.filter(a => a.actionType === "listing").reduce((s, a) => s + a.blocks, 0),
    donationBlocks: t.actions.filter(a => a.actionType === "donation").reduce((s, a) => s + a.blocks, 0),
  }));

  return NextResponse.json({
    mission: {
      id:          mission.id,
      name:        mission.name,
      description: mission.description,
      month:       mission.month,
      category:    mission.category,
      goalBlocks:  mission.goalBlocks,
      isActive:    mission.isActive,
      teams,
    },
  });
}
