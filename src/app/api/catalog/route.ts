import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await prisma.itemCatalog.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { sku: "asc" }],
      select: {
        id: true, sku: true, name: true, category: true,
        standardPriceCents: true,
        description: true, imageUrl: true,
        preferredVendor: true, ageStage: true, requiresSize: true,
        isActive: true, lastVerifiedAt: true, createdAt: true, updatedAt: true,
        // preferredVendorUrl and substituteNote are admin-only — omitted
      },
    });

    const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});

    return NextResponse.json({ catalog: grouped, items });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
