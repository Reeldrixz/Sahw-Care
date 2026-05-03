import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { itemId } = await params;

  const body = await req.json();
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
  if (reason.length > 200) return NextResponse.json({ error: "Reason must be 200 characters or less" }, { status: 400 });

  const item = await prisma.registerItem.findUnique({
    where: { id: itemId },
    include: { register: { select: { creatorId: true } } },
  });

  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.status !== "PENDING_APPROVAL") {
    return NextResponse.json({ error: "Item is not pending approval" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.registerItem.update({
      where: { id: itemId },
      data: { status: "CANCELLED" },
    });
    await tx.notification.create({
      data: {
        userId:  item.register.creatorId,
        type:    "REGISTER_ITEM_REJECTED",
        message: `Your item "${item.name}" was not approved. Reason: ${reason}`,
        link:    `/registers/${item.registerId}`,
      },
    });
    return result;
  });

  return NextResponse.json({ item: updated });
}
