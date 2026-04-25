import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculateTrustScore, syncTrustRating } from "@/lib/trust";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth || auth.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {

  const { status, adminNote, userAction } = await req.json();
  // status: RESOLVED | DISMISSED
  // userAction: null | "FLAG" | "SUSPEND" | "WARN"

  if (!["RESOLVED", "DISMISSED"].includes(status)) {
    return NextResponse.json({ error: "status must be RESOLVED or DISMISSED" }, { status: 400 });
  }

  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.report.update({
    where: { id },
    data: { status, adminNote: adminNote ?? null },
  });

  // Optionally action the reported user
  if (report.targetUserId && userAction) {
    const statusMap: Record<string, string> = { FLAG: "FLAGGED", SUSPEND: "SUSPENDED", WARN: "ACTIVE" };
    if (statusMap[userAction]) {
      await prisma.user.update({
        where: { id: report.targetUserId },
        data: { status: statusMap[userAction] as "ACTIVE" | "FLAGGED" | "SUSPENDED" },
      });
    }
    // Recalculate trust after user action
    const newScore = await recalculateTrustScore(report.targetUserId);
    await syncTrustRating(report.targetUserId, newScore);
  }

  return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
