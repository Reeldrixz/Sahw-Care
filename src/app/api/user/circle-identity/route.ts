import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { context, displayName, skip } = await req.json();

  if (skip) {
    await prisma.user.update({
      where: { id: auth.userId },
      data:  { circleIdentitySkippedAt: new Date() },
    });
    return NextResponse.json({ ok: true, skipped: true });
  }

  // Validate displayName
  const trimmedName = typeof displayName === "string" ? displayName.trim().slice(0, 20) : null;
  const validContexts = ["First-time Mom", "Experienced Mom", "Single Mom", "Teen Mom", "Other"];
  const safeContext = validContexts.includes(context) ? context : null;

  await prisma.user.update({
    where: { id: auth.userId },
    data:  {
      circleIdentitySet:       true,
      circleContext:           safeContext,
      circleDisplayName:       trimmedName || null,
      circleIdentityUpdatedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, skipped: false });
}
