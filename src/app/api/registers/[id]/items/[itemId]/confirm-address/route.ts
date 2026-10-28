import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReceiveShipment } from "@/lib/access";
import { hasPartnerReferral } from "@/lib/referral";
import { confirmAddressForMother, type ConfirmedItem } from "@/lib/addressConfirm";

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

  // Identity gate: recipient must be identity-verified or partner-referred
  // before committing a shipment address
  const [recipient, referredByPartner] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: auth.userId },
      select: { identityVerified: true, manualReviewStatus: true, accountHold: true },
    }),
    hasPartnerReferral(auth.userId),
  ]);
  if (!recipient) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const shipmentAccess = canReceiveShipment({ ...recipient, referredByPartner });
  if (!shipmentAccess.allowed) {
    return NextResponse.json({ error: shipmentAccess.message, code: shipmentAccess.code }, { status: 403 });
  }

  // The address applies to EVERY funded item of hers waiting for one, across
  // all her registers, not only the item in the URL (lib/addressConfirm).
  let confirmed: ConfirmedItem[];
  try {
    confirmed = await prisma.$transaction(async (tx) => {
      const items = await confirmAddressForMother(tx, auth.userId, {
        fullName:      fullName.trim(),
        streetAddress: streetAddress.trim(),
        unit:          unit?.trim() || null,
        city:          city.trim(),
        province:      province.trim(),
        postalCode:    postalCode.trim(),
        phone:         phone.trim(),
      });
      if (items.length > 0) {
        const names = items.map((i) => i.name);
        await tx.notification.create({
          data: {
            userId:  auth.userId,
            type:    "ITEM_FULLY_FUNDED",
            message: names.length === 1
              ? `Address confirmed. We'll order your ${names[0]} shortly.`
              : `Address confirmed. We'll order your ${names.length} items shortly: ${names.join(", ")}.`,
            link:    `/registers/${registerId}`,
          },
        });
      }
      return items;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ADDRESS_RACE") {
      return NextResponse.json({ error: "Your address was just confirmed. Refresh to see your items." }, { status: 409 });
    }
    throw err;
  }
  if (confirmed.length === 0) {
    return NextResponse.json({ error: "Item is not awaiting address confirmation" }, { status: 400 });
  }

  return NextResponse.json({ success: true, confirmedCount: confirmed.length });
}
