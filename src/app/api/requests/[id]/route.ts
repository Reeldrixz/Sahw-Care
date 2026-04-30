import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { awardImpactPoints } from "@/lib/trust";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      item: { select: { id: true, title: true, donorId: true } },
      requester: { select: { id: true, name: true } },
      conversation: true,
    },
  });

  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  const isDonor = request.item.donorId === user.userId;
  const isAdmin = user.role === "ADMIN";

  if (!isDonor && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { action, status, note } = body;

  // ── Accept: create pickup coordination, notify recipient ─────────────────
  if (action === "accept") {
    const updated = await prisma.request.update({
      where: { id },
      data: { status: "ACCEPTED", reviewedAt: new Date() },
      include: { preferredLocation: true },
    });

    // Decrement quantityNum; reserve item if it hits 0
    const currentItem = await prisma.item.findUnique({
      where: { id: request.item.id },
      select: { quantityNum: true, status: true },
    });
    if (currentItem) {
      const newQty = Math.max(0, (currentItem.quantityNum ?? 1) - 1);
      await prisma.item.update({
        where: { id: request.item.id },
        data: {
          quantityNum: newQty,
          ...(newQty === 0 ? { status: "RESERVED" } : {}),
        },
      });
    }

    // Create PickupCoordination (idempotent)
    const existingCoord = await prisma.pickupCoordination.findUnique({ where: { requestId: id } });
    if (!existingCoord) {
      await prisma.pickupCoordination.create({
        data: {
          requestId: id,
          locationId: (updated as { pickupLocationId?: string | null }).pickupLocationId ?? undefined,
          status: "PENDING",
        },
      });
    }

    // Notify recipient
    const coordLink = `/coordination/${id}`;
    prisma.notification.create({
      data: {
        userId:            request.requesterId,
        type:              "COORDINATION_ACCEPTED",
        message:           "Your request was accepted! Tap to coordinate your pickup.",
        link:              coordLink,
        triggeredByUserId: request.item.donorId,
      },
    }).catch(() => {});

    // Notify donor — gives them a persistent trail back to the coordination view
    prisma.notification.create({
      data: {
        userId:            request.item.donorId,
        type:              "REQUEST_RECEIVED",
        title:             "Coordination started",
        message:           `You accepted a request for ${request.item.title}. Tap to coordinate the pickup.`,
        link:              coordLink,
        triggeredByUserId: request.requesterId,
      },
    }).catch(() => {});

    return NextResponse.json({ request: updated, coordinationLink: coordLink });
  }

  // ── Decline: set DECLINED, notify recipient ──────────────────────────────
  if (action === "decline") {
    // Restore item if it was reserved due to this acceptance
    const currentItem = await prisma.item.findUnique({
      where: { id: request.item.id },
      select: { status: true, quantityNum: true },
    });
    if (currentItem?.status === "RESERVED") {
      await prisma.item.update({
        where: { id: request.item.id },
        data: { status: "ACTIVE", quantityNum: (currentItem.quantityNum ?? 0) + 1 },
      });
    }

    const updated = await prisma.request.update({
      where: { id },
      data: {
        status:    "DECLINED",
        reviewedAt: new Date(),
        reviewNote: note ?? null,
      },
    });

    prisma.notification.create({
      data: {
        userId:            request.requesterId,
        type:              "FULFILLMENT_PENDING",
        message:           "Your request wasn't accepted this time. Keep browsing — there are more items available!",
        link:              "/",
        triggeredByUserId: request.item.donorId,
      },
    }).catch(() => {});

    return NextResponse.json({ request: updated });
  }

  // ── Legacy status-based update (backward compat) ─────────────────────────
  const validStatuses = ["APPROVED", "REJECTED", "FULFILLED", "ACCEPTED", "DECLINED", "CANCELLED"];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid action or status" }, { status: 400 });
  }

  // Restore item reservation on cancel
  if (status === "CANCELLED") {
    const cancellableItem = await prisma.item.findUnique({
      where: { id: request.item.id },
      select: { status: true, quantityNum: true },
    });
    if (cancellableItem?.status === "RESERVED") {
      await prisma.item.update({
        where: { id: request.item.id },
        data: { status: "ACTIVE", quantityNum: (cancellableItem.quantityNum ?? 0) + 1 },
      });
    }
  }

  const updated = await prisma.request.update({
    where: { id },
    data: { status },
  });

  if (status === "FULFILLED") {
    awardImpactPoints(request.item.donorId, "FULFILLED_REQUEST", id).catch(() => {});
  }

  if ((status === "APPROVED" || status === "ACCEPTED") && !request.conversation) {
    const conv = await prisma.conversation.create({
      data: {
        requestId: id,
        participants: {
          create: [
            { userId: request.item.donorId },
            { userId: request.requesterId },
          ],
        },
      },
    });
    return NextResponse.json({ request: updated, conversationId: conv.id });
  }

  return NextResponse.json({ request: updated });
}
