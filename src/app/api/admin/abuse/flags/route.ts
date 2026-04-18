import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAllOpenFlags } from "@/lib/abuseQueries";

export const dynamic = "force-dynamic";

async function requireAdmin(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } });
  return user?.role === "ADMIN" ? payload : null;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const status   = searchParams.get("status")   ?? undefined;
  const severity = searchParams.get("severity") ?? undefined;

  const flags = await getAllOpenFlags({ status, severity });

  return NextResponse.json({ flags });
}
