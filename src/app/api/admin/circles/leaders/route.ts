import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** POST — assign or remove a circle leader */
export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminUser = await prisma.user.findUnique({ where: { id: auth.userId }, select: { role: true } });
  if (adminUser?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, circleId, action } = await req.json(); // action: "assign" | "remove"

  const candidate = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, trustScore: true } });
  if (!candidate) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (action === "assign" && candidate.trustScore < 80) {
    return NextResponse.json({ error: "User must have a trust score of 80 or above to become a Circle Leader" }, { status: 400 });
  }

  const membership = await prisma.circleMember.findUnique({
    where: { userId_circleId: { userId, circleId } },
  });

  if (!membership) {
    if (action === "assign") {
      await prisma.circleMember.create({ data: { userId, circleId, isLeader: true } });
    } else {
      return NextResponse.json({ error: "User is not a member of this circle" }, { status: 400 });
    }
  } else {
    await prisma.circleMember.update({
      where: { userId_circleId: { userId, circleId } },
      data: { isLeader: action === "assign" },
    });
  }

  return NextResponse.json({ ok: true, isLeader: action === "assign" });
}
