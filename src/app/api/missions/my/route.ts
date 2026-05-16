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

  const membership = await prisma.missionMember.findFirst({
    where:   { userId: auth.userId, isActive: true },
    include: {
      team: {
        include: {
          mission: true,
          members: {
            where:   { isActive: true },
            include: { user: { select: { id: true, name: true, avatar: true } } },
            orderBy: { joinedAt: "asc" },
          },
          actions: {
            orderBy: { createdAt: "desc" },
            take:    40,
            include: { user: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  if (!membership) return NextResponse.json({ membership: null });

  const team    = membership.team;
  const mission = team.mission;

  // Team-level block breakdown
  const completedBlocks = team.actions.reduce((s, a) => COMPLETED_TYPES.includes(a.actionType) ? s + a.blocks : s, 0);
  const activityBlocks  = team.actions.reduce((s, a) => ACTIVITY_TYPES.includes(a.actionType)  ? s + a.blocks : s, 0);
  const signupBlocks    = team.actions.reduce((s, a) => a.actionType === "signup"               ? s + a.blocks : s, 0);
  const clickBlocks     = team.actions.reduce((s, a) => a.actionType === "click"                ? s + a.blocks : s, 0);

  // Per-member action breakdown — one groupBy covers all members accurately
  const memberActionGroups = await prisma.missionAction.groupBy({
    by:    ["userId", "actionType"],
    where: { teamId: team.id },
    _sum:  { blocks: true },
  });

  const breakdownByUser: Record<string, {
    completedBlocks: number; activityBlocks: number; signupBlocks: number; clickBlocks: number;
  }> = {};
  for (const row of memberActionGroups) {
    if (!breakdownByUser[row.userId]) {
      breakdownByUser[row.userId] = { completedBlocks: 0, activityBlocks: 0, signupBlocks: 0, clickBlocks: 0 };
    }
    const b = row._sum.blocks ?? 0;
    if      (COMPLETED_TYPES.includes(row.actionType)) breakdownByUser[row.userId].completedBlocks += b;
    else if (ACTIVITY_TYPES.includes(row.actionType))  breakdownByUser[row.userId].activityBlocks  += b;
    else if (row.actionType === "signup")               breakdownByUser[row.userId].signupBlocks    += b;
    else if (row.actionType === "click")                breakdownByUser[row.userId].clickBlocks     += b;
  }

  const emptyBreakdown = { completedBlocks: 0, activityBlocks: 0, signupBlocks: 0, clickBlocks: 0 };

  return NextResponse.json({
    membership: {
      id:      membership.id,
      teamId:  team.id,
      mission: {
        id:          mission.id,
        name:        mission.name,
        description: mission.description,
        month:       mission.month,
        category:    mission.category,
        goalBlocks:  mission.goalBlocks,
      },
      team: {
        id:             team.id,
        totalBlocks:    team.totalBlocks,
        isComplete:     team.isComplete,
        completedBlocks,
        activityBlocks,
        signupBlocks,
        clickBlocks,
        donationBlocks: completedBlocks,
        listingBlocks:  activityBlocks,
        members: team.members.map((m) => ({
          id:              m.id,
          userId:          m.user.id,
          name:            m.user.name,
          avatar:          m.user.avatar,
          isMe:            m.userId === auth.userId,
          joinedAt:        m.joinedAt,
          actionBreakdown: breakdownByUser[m.user.id] ?? emptyBreakdown,
        })),
        recentActions: team.actions.map((a) => ({
          id:         a.id,
          actionType: a.actionType,
          blocks:     a.blocks,
          humanLabel: a.humanLabel,
          userName:   a.user.name,
          isMe:       a.userId === auth.userId,
          createdAt:  a.createdAt,
        })),
      },
    },
  });
}
