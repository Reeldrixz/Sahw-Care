import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, activeRequestLockedUntil: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.user.update({
    where: { id },
    data: { activeRequestLockedUntil: null, requestCountSinceReset: 0 },
  });

  // Log as an abuse event so there's an audit trail
  await prisma.abuseEventLog.create({
    data: {
      userId:    id,
      eventType: "TRUST_SCORE_CHANGED",
      trustScore: 0,
      metadata:  { action: "ADMIN_REQUEST_LOCK_RESET", adminId: admin.userId },
      timestamp: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
