import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCreatorDashboard } from "@/lib/creators";

export const dynamic = "force-dynamic";

// Private to the creator. Never exposes any mother's identity. Counts only.
export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { isCreator: true } });
  if (!user?.isCreator) return NextResponse.json({ error: "Not a creator" }, { status: 403 });

  const data = await getCreatorDashboard(auth.userId);
  return NextResponse.json(data);
}
