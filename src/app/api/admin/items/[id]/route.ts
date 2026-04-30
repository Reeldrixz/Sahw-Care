import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelActiveRequestsForItem } from "@/lib/cancel-item-requests";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const body = await req.json();
    const { status, adminBlurred, frozenReason } = body;

    const validStatuses = ["PENDING", "ACTIVE", "FULFILLED", "REMOVED", "FROZEN", "RESERVED"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const previous = status
      ? await prisma.item.findUnique({ where: { id }, select: { status: true } })
      : null;

    const item = await prisma.item.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(adminBlurred !== undefined && { adminBlurred }),
        ...(frozenReason !== undefined && { frozenReason }),
        ...(status === "FROZEN" && { frozenAt: new Date() }),
        ...(status !== "FROZEN" && { frozenAt: null, frozenReason: null }),
      },
    });

    if (status === "REMOVED") {
      await cancelActiveRequestsForItem(
        id,
        item.title,
        "Item removed by admin",
        admin.userId,
      ).catch(() => {});
    }

    if (status === "ACTIVE" && previous?.status === "PENDING") {
      prisma.notification.create({
        data: {
          userId:            item.donorId,
          type:              "REQUEST_RECEIVED",
          title:             "Your listing is live",
          message:           `Your ${item.title} listing is now visible to mothers in ${item.location}. Tap to view.`,
          link:              `/items/${item.id}`,
          triggeredByUserId: null,
        },
      }).catch(() => {});
    }

    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(_req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    await prisma.item.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
