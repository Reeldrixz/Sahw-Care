import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await prisma.user.findUnique({ where: { id: auth.userId }, select: { role: true } });
  if (admin?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { status, priority, adminNotes } = body;

  const VALID_STATUSES  = ["new", "investigating", "resolved", "wontfix", "duplicate"];
  const VALID_PRIORITIES = ["low", "normal", "high", "critical"];

  if (status   && !VALID_STATUSES.includes(status))    return NextResponse.json({ error: "Invalid status"   }, { status: 400 });
  if (priority && !VALID_PRIORITIES.includes(priority)) return NextResponse.json({ error: "Invalid priority" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (status !== undefined)     data.status     = status;
  if (priority !== undefined)   data.priority   = priority;
  if (adminNotes !== undefined) data.adminNotes = adminNotes;
  if (status === "resolved" || status === "wontfix") data.resolvedAt = new Date();

  const updated = await prisma.bugReport.update({ where: { id }, data });
  return NextResponse.json({ ok: true, report: updated });
}
