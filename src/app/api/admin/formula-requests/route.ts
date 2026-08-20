import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Human review list. Read-only; decisions happen via the [id] PATCH route.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING";
  const limit  = Math.min(Number(searchParams.get("limit") ?? "50"), 100);
  const offset = Number(searchParams.get("offset") ?? "0");

  const where = status !== "ALL" ? { status: status as never } : {};

  const [requests, total] = await Promise.all([
    prisma.formulaRequest.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: limit,
      skip: offset,
      include: { user: { select: { id: true, name: true, email: true, phone: true, location: true } } },
    }),
    prisma.formulaRequest.count({ where }),
  ]);

  const data = requests.map((r) => ({
    id:           r.id,
    formulaBrand: r.formulaBrand,
    formulaType:  r.formulaType,
    formulaStage: r.formulaStage,
    formulaForm:  r.formulaForm,
    babyDob:      r.babyDob,
    note:         r.note,
    breastfeedingResourcesRequested: r.breastfeedingResourcesRequested,
    status:       r.status,
    adminNote:    r.adminNote,
    reviewedAt:   r.reviewedAt,
    createdAt:    r.createdAt,
    mother: {
      id:       r.user.id,
      name:     r.user.name,
      email:    r.user.email,
      phone:    r.user.phone,
      location: r.user.location,
    },
  }));

  return NextResponse.json({ requests: data, total });
}
