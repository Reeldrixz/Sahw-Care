import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status   = searchParams.get("status") ?? "PENDING";
  const bundleId = searchParams.get("bundleId") ?? undefined;
  const limit    = Math.min(Number(searchParams.get("limit") ?? "50"), 100);
  const offset   = Number(searchParams.get("offset") ?? "0");

  const where = {
    ...(status !== "ALL" && { status: status as never }),
    ...(bundleId && { bundleId }),
  };

  const [applications, total] = await Promise.all([
    prisma.bundleApplication.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: limit,
      skip: offset,
      include: {
        bundle: { select: { id: true, code: true, name: true, stage: true } },
      },
    }),
    prisma.bundleApplication.count({ where }),
  ]);

  return NextResponse.json({ applications, total });
}
