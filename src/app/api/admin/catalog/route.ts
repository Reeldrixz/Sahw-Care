import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const items = await prisma.itemCatalog.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: { _count: { select: { registerItems: true } } },
    });
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id, name, category, standardPriceCents, description, isActive } = await req.json();

    if (!name || !category || typeof standardPriceCents !== "number") {
      return NextResponse.json({ error: "name, category and standardPriceCents are required" }, { status: 400 });
    }

    if (id) {
      const updated = await prisma.itemCatalog.update({
        where: { id },
        data:  { name, category, standardPriceCents, description, isActive: isActive ?? true },
      });
      return NextResponse.json({ item: updated });
    }

    const created = await prisma.itemCatalog.create({
      data: { name, category, standardPriceCents, description, isActive: isActive ?? true },
    });
    return NextResponse.json({ item: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
