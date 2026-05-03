import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { itemId } = await params;

  const item = await prisma.registerItem.findUnique({
    where: { id: itemId },
    include: { register: { select: { creatorId: true, title: true } } },
  });

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.status !== "PENDING_APPROVAL") {
    return NextResponse.json({ error: "Item is not pending approval" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.registerItem.update({
      where: { id: itemId },
      data: { status: "AVAILABLE" },
    });
    await tx.notification.create({
      data: {
        userId:  item.register.creatorId,
        type:    "REGISTER_ITEM_APPROVED",
        message: `Your item "${item.name}" has been approved and is now visible on your register.`,
        link:    `/registers/${item.registerId}`,
      },
    });
    return result;
  });

  return NextResponse.json({ item: updated });
}
