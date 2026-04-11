import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET user's active cohort circle + channels + member info */
export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: { currentCircleId: true, onboardingComplete: true },
  });

  if (!user?.currentCircleId) {
    return NextResponse.json({ circle: null, member: null, channels: [] });
  }

  const circle = await prisma.circle.findUnique({
    where: { id: user.currentCircleId },
    include: {
      channels:  { orderBy: { order: "asc" } },
      _count:    { select: { members: true, posts: true } },
    },
  });

  if (!circle) return NextResponse.json({ circle: null, member: null, channels: [] });

  const membership = await prisma.circleMember.findUnique({
    where: { userId_circleId: { userId: auth.userId, circleId: circle.id } },
    select: { joinedAt: true, isLeader: true, lastViewedAt: true },
  });

  return NextResponse.json({
    circle: {
      id:          circle.id,
      name:        circle.name,
      emoji:       circle.emoji,
      stageKey:    circle.stageKey,
      groupLetter: circle.groupLetter,
      _count:      circle._count,
    },
    channels: circle.channels,
    member:   membership
      ? { joinedAt: membership.joinedAt, isLeader: membership.isLeader, lastViewedAt: membership.lastViewedAt }
      : null,
  });
}
