import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Marks the one-time beta welcome note as seen for the current user.
// Idempotent — only stamps the first time.
export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.user.updateMany({
    where: { id: auth.userId, betaWelcomeSeenAt: null },
    data:  { betaWelcomeSeenAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
