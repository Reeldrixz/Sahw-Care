import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await prisma.user.findUnique({ where: { id: auth.userId }, select: { role: true } });
  if (admin?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { action, skuData } = await req.json().catch(() => ({}));
  const { id } = await params;

  const suggestion = await prisma.registerSuggestion.findUnique({ where: { id } });
  if (!suggestion) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = new Date();

  if (action === "promote") {
    const { sku, name, category, standardPriceCents, description } = skuData ?? {};
    if (!sku || !name || !category || !standardPriceCents) {
      return NextResponse.json({ error: "sku, name, category and price are required to promote" }, { status: 400 });
    }

    const catalogItem = await prisma.itemCatalog.create({
      data: {
        sku:                sku.trim().toUpperCase(),
        name:               name.trim(),
        category,
        standardPriceCents: Math.round(Number(standardPriceCents)),
        description:        description?.trim() || null,
        isActive:           true,
        lastVerifiedAt:     now,
      },
    });

    // Mark this suggestion and all suggestions with the same name as promoted
    await prisma.registerSuggestion.updateMany({
      where: { itemName: { equals: suggestion.itemName, mode: "insensitive" }, status: "pending" },
      data:  { status: "promoted", reviewedAt: now, reviewedBy: auth.userId, promotedSkuId: catalogItem.id },
    });

    return NextResponse.json({ ok: true, catalogItemId: catalogItem.id });
  }

  if (action === "decline" || action === "duplicate") {
    await prisma.registerSuggestion.update({
      where: { id },
      data:  { status: action, reviewedAt: now, reviewedBy: auth.userId },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action. Use: promote | decline | duplicate" }, { status: 400 });
}
