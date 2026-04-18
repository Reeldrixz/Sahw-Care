import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { urgentOverrideLimit, resetOverridesIfNeeded } from "@/lib/trust";
import { logAbuseEvent, runAbuseChecks } from "@/lib/abuse";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { category, reason } = await req.json();
  if (!category || !reason?.trim()) {
    return NextResponse.json({ error: "Category and reason are required" }, { status: 400 });
  }

  // Reset counter if new month
  await resetOverridesIfNeeded(auth.userId);

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const limit = urgentOverrideLimit(user.trustScore);
  if (user.urgentOverridesUsed >= limit) {
    return NextResponse.json({
      error: `You have used all ${limit} urgent override${limit !== 1 ? "s" : ""} this month.`,
      overridesUsed: user.urgentOverridesUsed,
      overrideLimit: limit,
    }, { status: 429 });
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.urgentOverride.create({
      data: {
        userId: auth.userId,
        category,
        reason: reason.trim(),
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
    }),
    prisma.user.update({
      where: { id: auth.userId },
      data: { urgentOverridesUsed: { increment: 1 } },
    }),
  ]);

  const remaining = limit - (user.urgentOverridesUsed + 1);

  // Log + run checks (fire-and-forget)
  Promise.all([
    logAbuseEvent(auth.userId, "URGENT_OVERRIDE_USED", user.trustScore, { category, reason: reason.trim(), overridesUsed: user.urgentOverridesUsed + 1 }, req),
    runAbuseChecks(auth.userId),
  ]).catch(() => {});

  return NextResponse.json({
    approved: true,
    overridesRemaining: remaining,
    overrideLimit: limit,
  }, { status: 201 });
}

// GET — current override status for the logged-in user
export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await resetOverridesIfNeeded(auth.userId);

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const limit = urgentOverrideLimit(user.trustScore);
  return NextResponse.json({
    overridesUsed: user.urgentOverridesUsed,
    overrideLimit: limit,
    overridesRemaining: Math.max(0, limit - user.urgentOverridesUsed),
  });
}
