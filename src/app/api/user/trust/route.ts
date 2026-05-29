import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: {
      impactScore: true, donorLevel: true,
      bundleRestrictedUntil: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rbwDaysLeft = user.bundleRestrictedUntil && user.bundleRestrictedUntil > new Date()
    ? Math.ceil((user.bundleRestrictedUntil.getTime() - Date.now()) / (86400 * 1000))
    : null;

  return NextResponse.json({
    impactScore: user.impactScore,
    donorLevel:  user.donorLevel,
    rbwDaysLeft,
  });
}
