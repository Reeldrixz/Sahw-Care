import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { autoJoinCircle } from "@/lib/countryCircle";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, location: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Try to auto-join if not yet in any circle
  await autoJoinCircle(user.id, user.location);

  const membership = await prisma.circleMember.findFirst({
    where: { userId: auth.userId },
    include: {
      circle: {
        include: { _count: { select: { members: true, posts: true } } },
      },
    },
  });

  if (!membership) {
    return NextResponse.json({ circle: null, member: null });
  }

  return NextResponse.json({
    circle: membership.circle,
    member: {
      joinedAt: membership.joinedAt,
      isLeader: membership.isLeader,
      lastViewedAt: membership.lastViewedAt,
    },
  });
}

/** Update lastViewedAt to mark circle as seen */
export async function PATCH(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.circleMember.updateMany({
    where: { userId: auth.userId },
    data: { lastViewedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
