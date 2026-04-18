import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getUserAbuseFlags,
  getRequestCount,
  getTimeToFirstRequest,
  getEngagementRatio,
} from "@/lib/abuseQueries";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function requireAdmin(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } });
  return user?.role === "ADMIN" ? payload : null;
}

/**
 * GET /api/admin/abuse/flags/[userId]
 * Returns all flags + evidence + event log for a specific user
 */
export async function GET(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: userId } = await params;

  const [user, flags, eventLog, requestCount7d, requestCount30d, timeToFirst, engagement] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, name: true, email: true, phone: true, trustScore: true, createdAt: true, status: true },
    }),
    getUserAbuseFlags(userId),
    prisma.abuseEventLog.findMany({
      where:   { userId },
      orderBy: { timestamp: "desc" },
      take:    50,
    }),
    getRequestCount(userId, 7),
    getRequestCount(userId, 30),
    getTimeToFirstRequest(userId),
    getEngagementRatio(userId),
  ]);

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    user,
    flags,
    eventLog: eventLog.map(e => ({
      id:        e.id,
      eventType: e.eventType,
      timestamp: e.timestamp,
      trustScore: e.trustScore,
      metadata:  e.metadata,
      // Never expose raw IP in UI — just flag presence
      hasIpAddress: !!e.ipAddress,
    })),
    stats: {
      requestCount7d,
      requestCount30d,
      timeToFirstRequestHours: timeToFirst,
      engagement,
    },
  });
}

/**
 * PATCH /api/admin/abuse/flags/[flagId]
 * Update flag status + reviewer + notes
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: flagId } = await params;
  const { status, notes } = await req.json();

  const validStatuses = ["REVIEWED", "CLOSED", "ESCALATED"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const flag = await prisma.abuseFlag.update({
    where: { id: flagId },
    data:  { status, notes: notes ?? null, reviewedAt: new Date(), reviewedBy: admin.userId },
  });

  return NextResponse.json({ flag });
}
