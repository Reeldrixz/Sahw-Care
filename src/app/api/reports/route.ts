import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reason, targetUserId, itemId } = await req.json();
  if (!reason?.trim()) return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  if (!targetUserId && !itemId) return NextResponse.json({ error: "Provide targetUserId or itemId" }, { status: 400 });

  // Prevent self-reporting
  if (targetUserId === auth.userId) {
    return NextResponse.json({ error: "Cannot report yourself" }, { status: 400 });
  }

  // Limit: 3 reports per user per 24 hours (anti-abuse)
  const oneDayAgo = new Date(Date.now() - 86400000);
  const recentReports = await prisma.report.count({
    where: { reporterId: auth.userId, createdAt: { gte: oneDayAgo } },
  });
  if (recentReports >= 3) {
    return NextResponse.json({ error: "Report limit reached. Try again tomorrow." }, { status: 429 });
  }

  const report = await prisma.report.create({
    data: {
      reason: reason.trim(),
      reporterId: auth.userId,
      ...(targetUserId && { targetUserId }),
      ...(itemId && { itemId }),
    },
  });

  return NextResponse.json({ report }, { status: 201 });
}
