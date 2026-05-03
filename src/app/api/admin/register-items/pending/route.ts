import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const items = await prisma.registerItem.findMany({
    where: { status: "PENDING_APPROVAL" },
    orderBy: { createdAt: "asc" },
    include: {
      register: {
        select: {
          id: true,
          title: true,
          city: true,
          creator: { select: { id: true, name: true } },
        },
      },
      catalogItem: {
        select: { id: true, name: true, sku: true, category: true, requiresApproval: true },
      },
    },
  });

  return NextResponse.json({ items });
}
