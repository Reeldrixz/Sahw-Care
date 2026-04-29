import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const coordination = await prisma.pickupCoordination.findUnique({
    where: { requestId },
    include: { request: { include: { item: { select: { donorId: true } } } } },
  });

  if (!coordination) return NextResponse.json({ error: "Coordination not found" }, { status: 404 });

  const donorId = coordination.request.item.donorId;
  const recipientId = coordination.request.requesterId;
  const isParty = user.userId === donorId || user.userId === recipientId;
  if (!isParty) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { reason, notes } = await req.json();
  if (!reason) return NextResponse.json({ error: "reason is required" }, { status: 400 });

  const report = await prisma.coordinationReport.create({
    data: {
      coordinationId: coordination.id,
      reporterId: user.userId,
      reason,
      notes: notes ?? null,
    },
  });

  // Pause coordination by moving to REPORTED
  await prisma.pickupCoordination.update({
    where: { requestId },
    data: { status: "REPORTED" },
  });

  // Create AbuseFlag for the other party
  const targetUserId = user.userId === donorId ? recipientId : donorId;
  prisma.abuseFlag.create({
    data: {
      userId: targetUserId,
      flagType: "SUSPICIOUS_REPORT_VOLUME",
      severity: "MEDIUM",
      evidence: { coordinationId: coordination.id, reportId: report.id, reason },
    },
  }).catch(() => {});

  return NextResponse.json({ report });
}
