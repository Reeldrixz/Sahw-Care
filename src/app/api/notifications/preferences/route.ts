import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

const PREF_FIELDS = ["notifyNewPosts", "notifyReplies", "notifyThreadReplies", "notifyBundleUpdates", "notifyVerification"] as const;

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { notifyNewPosts: true, notifyReplies: true, notifyThreadReplies: true, notifyBundleUpdates: true, notifyVerification: true },
  });
  return NextResponse.json({ prefs: user });
}

export async function PATCH(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, boolean> = {};
  for (const field of PREF_FIELDS) {
    if (typeof body[field] === "boolean") data[field] = body[field];
  }

  const user = await prisma.user.update({
    where: { id: auth.userId },
    data,
    select: { notifyNewPosts: true, notifyReplies: true, notifyThreadReplies: true, notifyBundleUpdates: true, notifyVerification: true },
  });
  return NextResponse.json({ prefs: user });
}
