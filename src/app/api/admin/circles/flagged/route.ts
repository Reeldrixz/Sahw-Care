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
          reports: { select: { reason: true, reportedBy: true, createdAt: true, resolvedAt: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  // Names for who hid a post by deleting it (author or circle leader) and which
  // admin reviewed it. Both are soft references, so a deleted account shows
  // as unknown rather than failing the list.
  const ids = [...new Set(flagged.flatMap((f) => [f.hiddenByUserId, f.reviewedByAdminId]).filter((x): x is string => !!x))];
  const people = ids.length
    ? new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]))
    : new Map<string, string>();

  return NextResponse.json({
    flagged: flagged.map((f) => ({
      ...f,
      hiddenByName:   f.hiddenByUserId    ? people.get(f.hiddenByUserId)    ?? "unknown account" : null,
      reviewedByName: f.reviewedByAdminId ? people.get(f.reviewedByAdminId) ?? "unknown admin"   : null,
    })),
  });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
