import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DISCOVER_TYPES = ["listing_completed", "donation"];
const REGISTER_TYPES = ["register_fulfilled"];
const BUNDLE_TYPES   = ["bundle_delivered"];
const OUTCOME_TYPES  = [...DISCOVER_TYPES, ...REGISTER_TYPES, ...BUNDLE_TYPES];

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

  const [allActions, memberships] = await Promise.all([
    prisma.missionAction.findMany({
      where:   { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      select:  { id: true, actionType: true, blocks: true, humanLabel: true, createdAt: true, teamId: true },
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

  const hasActions = allActions.length > 0;

  // oldest membership = when they first became a contributor
  const careContributorSince = memberships.length > 0
    ? memberships[memberships.length - 1].joinedAt
    : null;

  const identity = {
    name:   user.name,
    avatar: user.avatar,
    location: user.location,
    bio:    user.bio,
    careContributorSince,
    isVerified: user.phoneVerified || user.emailVerified,
  };

  const stats = {
    mothersSupported:    allActions.filter(a => OUTCOME_TYPES.includes(a.actionType)).length,
    essentialsDelivered: allActions.filter(a => REGISTER_TYPES.includes(a.actionType)).length,
    bundlesSupported:    allActions.filter(a => BUNDLE_TYPES.includes(a.actionType)).length,
    discoverPickups:     allActions.filter(a => DISCOVER_TYPES.includes(a.actionType)).length,
    peopleReached:       allActions.filter(a => ["click", "signup"].includes(a.actionType)).length,
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
