import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STAGE_META, type StageKey } from "@/lib/stage";

export const dynamic = "force-dynamic";

// Admin review queue for reflections. requireAdmin ONLY. This is the single
// place author identity (name + email) is exposed, and solely so a human can
// moderate and, in a crisis, reach out. It must never be surfaced to any
// donor/partner/public path.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING";
  const limit  = Math.min(Number(searchParams.get("limit") ?? "50"), 100);

  const where = status !== "ALL" ? { status: status as never } : {};

  const reflections = await prisma.reflection.findMany({
    where,
    orderBy: [{ aiFlagCrisis: "desc" }, { createdAt: "asc" }], // crisis-flagged first
    take: limit,
    select: {
      id: true, title: true, body: true, stageKey: true, status: true,
      aiFlagNonReflective: true, aiFlagCrisis: true, aiNote: true,
      rejectionCategory: true, rejectionNote: true,
      createdAt: true, reviewedAt: true,
      author: { select: { id: true, name: true, email: true } },
    },
  });

  const data = reflections.map((r) => ({
    ...r,
    stageLabel: STAGE_META[r.stageKey as StageKey]?.label ?? r.stageKey,
  }));

  return NextResponse.json({ reflections: data });
}
