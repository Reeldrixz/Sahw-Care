import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAbuseEvent } from "@/lib/abuse";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/requests/[id]/fulfill
 * Donor marks a request as sent/fulfilled with an optional note and photo.
 * Creates a RequestFulfillment record (status=PENDING) and notifies the recipient.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id: requestId } = await params;
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const request = await prisma.request.findUnique({
    where:   { id: requestId },
    include: {
      item:        { select: { id: true, title: true, donorId: true } },
      requester:   { select: { id: true, name: true } },
      fulfillment: true,
    },
  });

  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (request.item.donorId !== auth.userId) {
    return NextResponse.json({ error: "Only the donor can mark this as fulfilled" }, { status: 403 });
  }
  if (request.status !== "APPROVED") {
    return NextResponse.json({ error: "Request must be APPROVED before marking fulfilled" }, { status: 400 });
  }
  if (request.fulfillment) {
    return NextResponse.json({ error: "Fulfillment already recorded for this request" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const donorNote     = typeof body.donorNote     === "string" ? body.donorNote.trim().slice(0, 500) : null;
  const donorPhotoUrl = typeof body.donorPhotoUrl === "string" ? body.donorPhotoUrl.trim()           : null;

  await prisma.requestFulfillment.create({
    data: { requestId, donorNote, donorPhotoUrl },
  });

  // Notify the recipient
  await prisma.notification.create({
    data: {
      userId:            request.requesterId,
      type:              "FULFILLMENT_PENDING",
      message:           `${request.requester.name.split(" ")[0]}, your donor says they've sent your item — please confirm you received it.`,
      link:              `/?confirm=${requestId}`,
      triggeredByUserId: auth.userId,
    },
  });

  // Log abuse event (fire-and-forget)
  logAbuseEvent(auth.userId, "FULFILLMENT_MARKED", 0, { requestId }, req).catch(() => {});

  return NextResponse.json({ fulfilled: true });
}
