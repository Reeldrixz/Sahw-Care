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

  // Block breakdown — handles both old (click/listing/donation) and new action types
  const completedBlocks = team.actions.reduce((s, a) => COMPLETED_TYPES.includes(a.actionType) ? s + a.blocks : s, 0);
  const activityBlocks  = team.actions.reduce((s, a) => ACTIVITY_TYPES.includes(a.actionType)  ? s + a.blocks : s, 0);
  const signupBlocks    = team.actions.reduce((s, a) => a.actionType === "signup"               ? s + a.blocks : s, 0);
  const clickBlocks     = team.actions.reduce((s, a) => a.actionType === "click"                ? s + a.blocks : s, 0);

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
        // Legacy field aliases for backwards compat
        donationBlocks: completedBlocks,
        listingBlocks:  activityBlocks,
        members:        team.members.map((m) => ({
          id:       m.id,
          userId:   m.user.id,
          name:     m.user.name,
          avatar:   m.user.avatar,
          isMe:     m.userId === auth.userId,
          joinedAt: m.joinedAt,
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
