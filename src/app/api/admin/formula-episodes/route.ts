import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// D/F3c: list formula episodes for admin. Defaults to AWAITING_CONFIRMATION so
// the admin can resolve flagged corrections. (Richer episode views land in D/F4.)
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "AWAITING_CONFIRMATION";

  const episodes = await prisma.formulaEpisode.findMany({
    where:   status !== "ALL" ? { status: status as never } : {},
    orderBy: { startedAt: "asc" },
    take:    100,
    include: { user: { select: { id: true, name: true, email: true, phone: true } } },
  });

  const data = episodes.map((e) => ({
    id:                    e.id,
    status:                e.status,
    formulaBrand:          e.formulaBrand,
    formulaType:           e.formulaType,
    formulaStage:          e.formulaStage,
    formulaForm:           e.formulaForm,
    confirmationDeadline:  e.confirmationDeadline,
    correctionNote:        e.correctionNote,
    correctionRequestedAt: e.correctionRequestedAt,
    startedAt:             e.startedAt,
    mother: { id: e.user.id, name: e.user.name, email: e.user.email, phone: e.user.phone },
  }));

  return NextResponse.json({ episodes: data });
}
