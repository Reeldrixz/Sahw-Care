import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Ordered by journey progression
const STAGE_ORDER: Record<string, number> = {
  "pregnancy-0-3":    0,
  "pregnancy-4-6":    1,
  "pregnancy-7-9":    2,
  "postpartum-0-3":   3,
  "postpartum-4-6":   4,
  "postpartum-7-12":  5,
  "postpartum-13-24": 6,
};

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [circles, user] = await Promise.all([
    prisma.circle.findMany({
      where:   { stageKey: { not: null } },
      select: {
        id: true,
        name: true,
        emoji: true,
        stageKey: true,
        groupLetter: true,
        _count: { select: { members: true, posts: true } },
      },
    }),
    prisma.user.findUnique({
      where:  { id: auth.userId },
      select: {
        currentCircleId:    true,
        graduatedCircleIds: true,
        circleMembers: { select: { circleId: true, accessType: true } },
      },
    }),
  ]);

  const membershipMap = new Map(
    (user?.circleMembers ?? []).map((m) => [m.circleId, m.accessType as string]),
  );
  const graduatedSet = new Set(user?.graduatedCircleIds ?? []);

  const result = circles
    .map((c) => ({
      id:          c.id,
      name:        c.name,
      emoji:       c.emoji,
      stageKey:    c.stageKey!,
      groupLetter: c.groupLetter,
      memberCount: c._count.members,
      postCount:   c._count.posts,
      isPrimary:   user?.currentCircleId === c.id,
      isGraduated: graduatedSet.has(c.id),
      accessType:  membershipMap.get(c.id) ?? null,
      order:       STAGE_ORDER[c.stageKey!] ?? 99,
    }))
    .sort((a, b) => a.order - b.order);

  return NextResponse.json({ circles: result });
}
