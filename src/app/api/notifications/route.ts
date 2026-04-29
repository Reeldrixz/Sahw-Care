import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

// Which NotifType values belong to each filter tab
const FILTER_TYPES: Record<string, string[]> = {
  requests: [
    "REQUEST_ACCEPTED", "REQUEST_DECLINED", "REQUEST_RECEIVED",
    "ITEM_RESERVED", "ITEM_FULFILLED", "DELIVERY_CONFIRMED",
    "FULFILLMENT_CONFIRMED", "FULFILLMENT_PENDING", "FULFILLMENT_DISPUTED",
    "FULFILLMENT_REMINDER",
  ],
  circles: [
    "CIRCLE_REPLY", "CIRCLE_THREAD_REPLY", "CIRCLE_NEW_POST",
    "CIRCLE_MILESTONE", "NEW_POST", "REPLY", "THREAD_REPLY",
  ],
  bundles: [
    "BUNDLE_UPDATE", "BUNDLE_GOAL_MET", "BUNDLE_DELIVERED",
    "BUNDLE_ALLOCATION_CONFIRM", "ITEM_FULLY_FUNDED",
    "ITEM_PURCHASED", "ITEM_DISPATCHED", "ITEM_DELIVERED",
  ],
};

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const limit  = Math.min(parseInt(searchParams.get("limit")  ?? "20"), 50);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const filter = searchParams.get("filter") ?? "all";

  const where: Record<string, unknown> = { userId: auth.userId };
  if (filter === "unread") where.isRead = false;
  if (FILTER_TYPES[filter]) where.type = { in: FILTER_TYPES[filter] };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: auth.userId, isRead: false } }),
  ]);

  const triggerIds = [...new Set(
    notifications.map((n) => n.triggeredByUserId).filter(Boolean)
  )] as string[];

  const triggerUsers = triggerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: triggerIds } },
        select: { id: true, name: true, avatar: true },
      })
    : [];
  const triggerMap = Object.fromEntries(triggerUsers.map((u) => [u.id, u]));

  const formatted = notifications.map((n) => ({
    id:          n.id,
    type:        n.type,
    title:       n.title,
    message:     n.message,
    isRead:      n.isRead,
    actionLabel: n.actionLabel,
    metadata:    n.metadata,
    readAt:      n.readAt,
    link:        n.link,
    createdAt:   n.createdAt,
    triggeredBy: n.triggeredByUserId ? (triggerMap[n.triggeredByUserId] ?? null) : null,
  }));

  return NextResponse.json({ notifications: formatted, unreadCount, total });
}

export async function POST(req: NextRequest) {
  // Legacy mark-all-read (kept for backward compat)
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { userId: auth.userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
