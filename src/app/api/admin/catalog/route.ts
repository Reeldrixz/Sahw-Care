import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const items = await prisma.itemCatalog.findMany({
      orderBy: [{ category: "asc" }, { sku: "asc" }],
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
    const {
      id, sku, name, category, standardPriceCents, priceCentsMin, priceCentsMax,
      description, imageUrl, preferredVendor, preferredVendorUrl,
      substituteNote, ageStage, requiresSize, isActive,
    } = await req.json();

    if (!name || !category || typeof standardPriceCents !== "number") {
      return NextResponse.json({ error: "name, category and standardPriceCents are required" }, { status: 400 });
    }

    if (id) {
      // Update — sku optional (omitting it leaves it unchanged)
      const data: Prisma.ItemCatalogUpdateInput = {
        name, category, standardPriceCents, isActive: isActive ?? true,
        lastVerifiedAt: new Date(),
        ...(sku                             && { sku: String(sku).toUpperCase() }),
        ...(priceCentsMin  !== undefined     && { priceCentsMin }),
        ...(priceCentsMax  !== undefined     && { priceCentsMax }),
        ...(description    !== undefined     && { description: description ?? null }),
        ...(imageUrl       !== undefined     && { imageUrl: imageUrl ?? null }),
        ...(preferredVendor !== undefined    && { preferredVendor: preferredVendor ?? null }),
        ...(preferredVendorUrl !== undefined && { preferredVendorUrl: preferredVendorUrl ?? null }),
        ...(substituteNote !== undefined     && { substituteNote: substituteNote ?? null }),
        ...(ageStage       !== undefined     && { ageStage: ageStage ?? null }),
        ...(requiresSize   !== undefined     && { requiresSize: Boolean(requiresSize) }),
      };
      const updated = await prisma.itemCatalog.update({ where: { id }, data });
      return NextResponse.json({ item: updated });
    }

    // Create — sku required
    if (!sku) return NextResponse.json({ error: "sku is required" }, { status: 400 });

    const created = await prisma.itemCatalog.create({
      data: {
        sku: String(sku).toUpperCase(), name, category, standardPriceCents,
        priceCentsMin: priceCentsMin ?? 0, priceCentsMax: priceCentsMax ?? 0,
        description: description ?? null, imageUrl: imageUrl ?? null,
        preferredVendor: preferredVendor ?? null, preferredVendorUrl: preferredVendorUrl ?? null,
        substituteNote: substituteNote ?? null, ageStage: ageStage ?? null,
        requiresSize: requiresSize ?? false, isActive: isActive ?? true,
        lastVerifiedAt: new Date(),
      },
    });
    return NextResponse.json({ item: created }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "A catalog item with that SKU already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
