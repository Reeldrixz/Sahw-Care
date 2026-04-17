import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await prisma.notification.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  // For each notification with triggeredByUserId, resolve name
  const triggerIds = [...new Set(notifications.map(n => n.triggeredByUserId).filter(Boolean))] as string[];
  const triggerUsers = triggerIds.length
    ? await prisma.user.findMany({ where: { id: { in: triggerIds } }, select: { id: true, name: true, avatar: true } })
    : [];
  const triggerMap = Object.fromEntries(triggerUsers.map(u => [u.id, u]));

  const formatted = notifications.map(n => ({
    id: n.id,
    type: n.type,
    message: n.message,
    isRead: n.isRead,
    circleId: n.circleId,
    postId: n.postId,
    link: n.link,
    createdAt: n.createdAt,
    triggeredBy: n.triggeredByUserId ? (triggerMap[n.triggeredByUserId] ?? null) : null,
  }));

  const unreadCount = formatted.filter(n => !n.isRead).length;
  return NextResponse.json({ notifications: formatted, unreadCount });
}

export async function POST(req: NextRequest) {
  // Mark all as read
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { userId: auth.userId, isRead: false },
    data: { isRead: true },
  });
  return NextResponse.json({ ok: true });
}
