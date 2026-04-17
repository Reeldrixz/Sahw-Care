import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectGeoFromRequest } from "@/lib/geoip";
import { countryCodeToFlag } from "@/lib/stage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      avatar: true,
      location: true,
      isPremium: true,
      trustRating: true,
      trustScore: true,
      verificationLevel: true,
      phoneVerified: true,
      emailVerified: true,
      urgentOverridesUsed: true,
      urgentOverridesResetAt: true,
      docStatus: true,
      documentUrl: true,
      documentType: true,
      documentNote: true,
      verifiedAt: true,
      status: true,
      createdAt: true,
      onboardingComplete: true,
      journeyType: true,
      currentStage: true,
      countryCode: true,
      countryFlag: true,
      subTags: true,
      currentCircleId: true,
      lastBundleCompletedAt: true,
      activeBundleId: true,
      circleIdentitySet: true,
      circleContext: true,
      circleDisplayName: true,
      circleIdentitySkippedAt: true,
      notifyNewPosts: true,
      notifyReplies: true,
      notifyThreadReplies: true,
      _count: { select: { items: true, requests: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // ── Auto-detect country on first session if missing ──────────────────────
  let countryFlag = user.countryCode
    ? countryCodeToFlag(user.countryCode) // always compute fresh from code
    : (user.countryFlag ?? null);

  if (!user.countryCode) {
    const geo = await detectGeoFromRequest(req);
    if (geo) {
      await prisma.user.update({
        where: { id: payload.userId },
        data:  {
          countryCode: geo.countryCode,
          countryFlag: geo.countryFlag,
          ...(!user.location && geo.location ? { location: geo.location } : {}),
        },
      });
      countryFlag = geo.countryFlag;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { countryCode: _cc, ...userWithoutCode } = user;
  return NextResponse.json({ user: { ...userWithoutCode, countryFlag } });
}
