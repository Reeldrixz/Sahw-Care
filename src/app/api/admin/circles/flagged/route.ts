import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { role: true } });
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING";

  const flagged = await prisma.flaggedPost.findMany({
    where: { status: status as never },
    orderBy: { createdAt: "desc" },
    include: {
      post: {
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          circle: { select: { name: true } },
          reports: { select: { reason: true, reportedBy: true } },
        },
      },
    },
  });

  return NextResponse.json({ flagged });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
