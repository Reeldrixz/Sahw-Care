import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DISCOVER_TYPES = ["listing_completed", "donation"];
const REGISTER_TYPES = ["register_fulfilled"];
const BUNDLE_TYPES   = ["bundle_delivered"];
const OUTCOME_TYPES  = [...DISCOVER_TYPES, ...REGISTER_TYPES, ...BUNDLE_TYPES];

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [user, allActions, memberships] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: auth.userId },
      select: { name: true, avatar: true, location: true, bio: true, phoneVerified: true, emailVerified: true },
    }),
    prisma.missionAction.findMany({
      where:   { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      select:  { actionType: true, blocks: true },
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

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const careContributorSince = memberships.length > 0
    ? memberships[memberships.length - 1].joinedAt
    : null;

  const currentMem = memberships[0];

  const snapshotData = {
    identity: {
      name:   user.name,
      avatar: user.avatar,
      location: user.location,
      bio:    user.bio,
      careContributorSince,
      isVerified: user.phoneVerified || user.emailVerified,
    },
    stats: {
      mothersSupported:    allActions.filter(a => OUTCOME_TYPES.includes(a.actionType)).length,
      essentialsDelivered: allActions.filter(a => REGISTER_TYPES.includes(a.actionType)).length,
      bundlesSupported:    allActions.filter(a => BUNDLE_TYPES.includes(a.actionType)).length,
      discoverPickups:     allActions.filter(a => DISCOVER_TYPES.includes(a.actionType)).length,
      peopleReached:       allActions.filter(a => ["click", "signup"].includes(a.actionType)).length,
    },
    currentMission: currentMem ? {
      name:        currentMem.team.mission.name,
      month:       currentMem.team.mission.month,
      totalBlocks: currentMem.team.totalBlocks,
      goalBlocks:  currentMem.team.mission.goalBlocks,
      myBlocks:    currentMem.team.actions.reduce((s, a) => s + a.blocks, 0),
      memberCount: currentMem.team._count.members,
      isComplete:  currentMem.team.isComplete,
    } : null,
    pastMissions: memberships.slice(1).map(m => ({
      id:          m.id,
      missionName: m.team.mission.name,
      month:       m.team.mission.month,
      teamBlocks:  m.team.totalBlocks,
      goalBlocks:  m.team.mission.goalBlocks,
      myBlocks:    m.team.actions.reduce((s, a) => s + a.blocks, 0),
      isComplete:  m.team.isComplete,
      joinedAt:    m.joinedAt,
    })),
    snapshotAt: new Date().toISOString(),
  };

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const snapshot = await prisma.profileSnapshot.create({
    data: { userId: auth.userId, snapshotData, expiresAt },
  });

  return NextResponse.json({ url: `/u/${snapshot.id}` });
}
