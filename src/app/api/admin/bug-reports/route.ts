import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await prisma.user.findUnique({ where: { id: auth.userId }, select: { role: true } });
  if (admin?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url      = new URL(req.url);
  const status   = url.searchParams.get("status")   ?? "";
  const priority = url.searchParams.get("priority") ?? "";
  const page     = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit    = 30;

  const where: Record<string, unknown> = {};
  if (status)   where.status   = status;
  if (priority) where.priority = priority;

  const [reports, total] = await Promise.all([
    prisma.bugReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:    (page - 1) * limit,
      take:    limit,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.bugReport.count({ where }),
  ]);

  return NextResponse.json({ reports, total, page, pages: Math.ceil(total / limit) });
}
