import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { notifyNewPosts: true, notifyReplies: true, notifyThreadReplies: true },
  });
  return NextResponse.json({ prefs: user });
}

export async function PATCH(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, boolean> = {};
  if (typeof body.notifyNewPosts === "boolean")      data.notifyNewPosts = body.notifyNewPosts;
  if (typeof body.notifyReplies === "boolean")       data.notifyReplies = body.notifyReplies;
  if (typeof body.notifyThreadReplies === "boolean") data.notifyThreadReplies = body.notifyThreadReplies;

  const user = await prisma.user.update({
    where: { id: auth.userId },
    data,
    select: { notifyNewPosts: true, notifyReplies: true, notifyThreadReplies: true },
  });
  return NextResponse.json({ prefs: user });
}
