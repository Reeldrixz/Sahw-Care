import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: registerId, itemId } = await params;

  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { fullName, streetAddress, unit, city, province, postalCode, phone } = body;

  if (!fullName?.trim() || !streetAddress?.trim() || !city?.trim() || !province?.trim() || !postalCode?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: "All address fields are required" }, { status: 400 });
  }

  const item = await prisma.registerItem.findUnique({
    where:   { id: itemId },
    include: { register: { select: { id: true, creatorId: true } } },
  });

  if (!item || item.register.id !== registerId) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  if (item.register.creatorId !== auth.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (item.status !== "AWAITING_ADDRESS") {
    return NextResponse.json({ error: "Item is not awaiting address confirmation" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.shipmentAddress.create({
      data: {
        registerItemId: itemId,
        fullName:       fullName.trim(),
        streetAddress:  streetAddress.trim(),
        unit:           unit?.trim() || null,
        city:           city.trim(),
        province:       province.trim(),
        postalCode:     postalCode.trim(),
        phone:          phone.trim(),
      },
    });
    await tx.registerItem.update({
      where: { id: itemId },
      data:  { status: "AWAITING_PURCHASE", fundingStatus: "IN_FULFILLMENT" },
    });
    await tx.fulfillmentQueue.create({
      data: { registerItemId: itemId, totalFundedCents: item.totalFundedCents, status: "QUEUED" },
    });
    await tx.notification.create({
      data: {
        userId:  auth.userId,
        type:    "ITEM_FULLY_FUNDED",
        message: `Address confirmed. We'll order your ${item.name} shortly.`,
        link:    `/registers/${registerId}`,
      },
    });
  });

  return NextResponse.json({ success: true });
}
