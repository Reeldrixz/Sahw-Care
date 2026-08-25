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

  // Request.status deliberately stays ACCEPTED here. Only the LOCATION has been
  // chosen — no time is agreed yet, so calling this PICKUP_AGREED (as it used to)
  // described a state that had not happened. The fine-grained progress lives on
  // PickupCoordination.status (now LOCATION_CONFIRMED); Request.status advances to
  // PICKUP_AGREED in confirm-time, where a pickup genuinely has been agreed.

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
