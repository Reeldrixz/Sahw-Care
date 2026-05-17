import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const COMPLETION_TYPES = ["listing_completed", "register_fulfilled", "bundle_delivered"];

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [user, firstMembership] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: auth.userId },
      select: { name: true, avatar: true, location: true, bio: true, phoneVerified: true, emailVerified: true },
    }),
    prisma.missionMember.findFirst({
      where:   { userId: auth.userId },
      orderBy: { joinedAt: "desc" },
    }),
  ]);

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hasMembership = !!firstMembership;

  if (!hasMembership) {
    return NextResponse.json({
      hasMembership: false,
      hasActions:    false,
      identity: {
        name: user.name, avatar: user.avatar, location: user.location, bio: user.bio,
        careContributorSince: null, isVerified: user.phoneVerified || user.emailVerified,
      },
    });
  }

  const [myDirectActions, referredActions, memberships] = await Promise.all([
    prisma.missionAction.findMany({
      where:   { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      select:  { id: true, actionType: true, blocks: true, humanLabel: true, createdAt: true, teamId: true, recipientUserId: true, itemCount: true },
    }),
    prisma.missionAction.findMany({
      where:   { referredByUserId: auth.userId },
      select:  { actionType: true, recipientUserId: true, itemCount: true },
    }),
    prisma.missionMember.findMany({
      where:   { userId: auth.userId },
      include: {
        team: {
          include: {
            mission: true,
            _count:  { select: { members: true } },
            actions: { where: { userId: auth.userId }, select: { blocks: true } },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    }),
  ]);

  const hasActions = myDirectActions.length > 0;

  const careContributorSince = memberships.length > 0
    ? memberships[memberships.length - 1].joinedAt
    : null;

  const identity = {
    name:     user.name,
    avatar:   user.avatar,
    location: user.location,
    bio:      user.bio,
    careContributorSince,
    isVerified: user.phoneVerified || user.emailVerified,
  };

  const attributionSet = [...myDirectActions, ...referredActions];
  const completionSet  = attributionSet.filter(a => COMPLETION_TYPES.includes(a.actionType));

  const stats = {
    mothersSupported:    new Set(completionSet.map(a => a.recipientUserId).filter(Boolean)).size,
    essentialsDelivered: completionSet.reduce((s, a) => s + (a.itemCount ?? 1), 0),
    bundlesSupported:    attributionSet.filter(a => a.actionType === "bundle_delivered").length,
    peopleReached:       myDirectActions.filter(a => a.actionType === "click").length,
  };

  const currentMem    = memberships[0];
  const currentMission = currentMem ? {
    name:        currentMem.team.mission.name,
    month:       currentMem.team.mission.month,
    teamId:      currentMem.team.id,
    totalBlocks: currentMem.team.totalBlocks,
    goalBlocks:  currentMem.team.mission.goalBlocks,
    myBlocks:    currentMem.team.actions.reduce((s, a) => s + a.blocks, 0),
    memberCount: currentMem.team._count.members,
    isComplete:  currentMem.team.isComplete,
  } : null;

  const pastMissions = memberships.slice(1).map(m => ({
    id:          m.id,
    missionName: m.team.mission.name,
    month:       m.team.mission.month,
    teamBlocks:  m.team.totalBlocks,
    goalBlocks:  m.team.mission.goalBlocks,
    myBlocks:    m.team.actions.reduce((s, a) => s + a.blocks, 0),
    isComplete:  m.team.isComplete,
    joinedAt:    m.joinedAt,
  }));

  // backward compat for profile page ContributorCard
  const activeMission = currentMem ? {
    name:        currentMem.team.mission.name,
    teamId:      currentMem.team.id,
    totalBlocks: currentMem.team.totalBlocks,
    goalBlocks:  currentMem.team.mission.goalBlocks,
    isComplete:  currentMem.team.isComplete,
  } : null;

  return NextResponse.json({
    hasMembership: true,
    hasActions,
    identity,
    stats,
    currentMission,
    pastMissions,
    activeMission,
  });
}
