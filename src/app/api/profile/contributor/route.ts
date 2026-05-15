import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const COMPLETED_TYPES = ["donation", "listing_completed", "register_fulfilled", "bundle_delivered"];
const ACTIVITY_TYPES  = ["listing",  "listing_posted",    "register_committed"];

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // All actions ever recorded for this user
  const allActions = await prisma.missionAction.findMany({
    where:   { userId: auth.userId },
    orderBy: { createdAt: "desc" },
    select:  { id: true, actionType: true, blocks: true, humanLabel: true, createdAt: true, teamId: true },
  });

  if (allActions.length === 0) {
    return NextResponse.json({ hasActions: false });
  }

  // Lifetime stat breakdown
  const stats = {
    clicks:      allActions.filter(a => a.actionType === "click").length,
    signups:     allActions.filter(a => a.actionType === "signup").length,
    activity:    allActions.filter(a => ACTIVITY_TYPES.includes(a.actionType)).length,
    outcomes:    allActions.filter(a => COMPLETED_TYPES.includes(a.actionType)).length,
    totalBlocks: allActions.reduce((s, a) => s + a.blocks, 0),
  };

  // All mission memberships — most recent first
  const memberships = await prisma.missionMember.findMany({
    where:   { userId: auth.userId },
    include: {
      team: {
        include: {
          mission: true,
          actions: {
            where:  { userId: auth.userId },
            select: { blocks: true },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const missionHistory = memberships.map(m => ({
    id:          m.id,
    missionName: m.team.mission.name,
    month:       m.team.mission.month,
    teamBlocks:  m.team.totalBlocks,
    goalBlocks:  m.team.mission.goalBlocks,
    myBlocks:    m.team.actions.reduce((s, a) => s + a.blocks, 0),
    isComplete:  m.team.isComplete,
    joinedAt:    m.joinedAt,
  }));

  // Recent action feed (last 60 entries, deduplicated by content)
  const recentActions = allActions.slice(0, 60).map(a => ({
    id:         a.id,
    actionType: a.actionType,
    blocks:     a.blocks,
    humanLabel: a.humanLabel,
    createdAt:  a.createdAt,
  }));

  // Highlight moments — 3 most recent +4 outcome actions
  const highlightMoments = allActions
    .filter(a => COMPLETED_TYPES.includes(a.actionType))
    .slice(0, 3)
    .map(a => ({
      id:         a.id,
      actionType: a.actionType,
      blocks:     a.blocks,
      humanLabel: a.humanLabel,
      createdAt:  a.createdAt,
    }));

  return NextResponse.json({
    hasActions: true,
    stats,
    missionHistory,
    recentActions,
    highlightMoments,
  });
}
