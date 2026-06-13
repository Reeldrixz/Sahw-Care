import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Marks the register guided tour as seen for the current user (finished OR
// skipped). Idempotent — only stamps the first time so the original
// completion time is preserved.
export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.user.updateMany({
    where: { id: auth.userId, tourCompletedAt: null },
    data:  { tourCompletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
