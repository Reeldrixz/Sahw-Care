import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth || auth.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // PENDING | RESOLVED | DISMISSED

  const reports = await prisma.report.findMany({
    where: { ...(status ? { status: status as "PENDING" | "RESOLVED" | "DISMISSED" } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      reporter: { select: { id: true, name: true, email: true, phone: true } },
      targetUser: { select: { id: true, name: true, email: true, phone: true, status: true, trustScore: true } },
      item: { select: { id: true, title: true, category: true, status: true } },
    },
  });

  return NextResponse.json({ reports });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
