import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VERIFICATION_BADGE_FIELDS, withVerificationBadge } from "@/lib/verificationBadge";

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
          creator: { select: { id: true, name: true, ...VERIFICATION_BADGE_FIELDS } },
        },
      },
      catalogItem: {
        select: { id: true, name: true, sku: true, category: true, requiresApproval: true },
      },
    },
  });

  return NextResponse.json({
    items: items.map((i) => ({ ...i, register: { ...i.register, creator: withVerificationBadge(i.register.creator) } })),
  });
}
