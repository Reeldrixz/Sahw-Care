import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      item: { select: { id: true, title: true, donorId: true } },
      coordination: true,
      preferredLocation: true,
    },
  });

  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  const isDonor = request.item.donorId === user.userId;
  if (!isDonor && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // If coordination already exists and is past PENDING, idempotently return it
  if (request.coordination && request.coordination.status !== "PENDING") {
    return NextResponse.json({ coordination: request.coordination });
  }

  const locationId = request.pickupLocationId;

  const coordination = request.coordination
    ? await prisma.pickupCoordination.update({
        where: { requestId },
        data: { status: "LOCATION_CONFIRMED", locationId: locationId ?? undefined },
      })
    : await prisma.pickupCoordination.create({
        data: {
          requestId,
          locationId: locationId ?? undefined,
          status: "LOCATION_CONFIRMED",
        },
      });

  // Update request status to reflect coordination started
  await prisma.request.update({
    where: { id: requestId },
    data: { status: "PICKUP_AGREED" },
  });

  // Notify recipient
  const location = request.preferredLocation;
  prisma.notification.create({
    data: {
      userId: request.requesterId,
      type: "COORDINATION_ACCEPTED",
      message: `Your pickup location has been confirmed${location ? ` at ${location.name}` : ""}. Let's coordinate a time!`,
      link: `/coordination/${requestId}`,
      triggeredByUserId: user.userId,
    },
  }).catch(() => {});

  return NextResponse.json({ coordination });
}
