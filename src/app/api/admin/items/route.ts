import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status) where.status = status;

  const items = await prisma.item.findMany({
    where,
    include: {
      donor: { select: { id: true, name: true, email: true } },
      _count: { select: { requests: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ items });
}
