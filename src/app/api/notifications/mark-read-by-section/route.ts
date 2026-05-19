import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { NotifType } from "@prisma/client";

export const dynamic = "force-dynamic";

const SECTION_TYPES: Record<string, NotifType[]> = {
  discover:  ["REQUEST_RECEIVED", "REQUEST_ACCEPTED", "REQUEST_DECLINED", "REQUEST_LOCK_CLEARED"],
  pickups:   [
    "COORDINATION_ACCEPTED", "COORDINATION_TIME_PROPOSED", "COORDINATION_SCHEDULED",
    "COORDINATION_CANCELLED", "COORDINATION_DELIVERED", "DELIVERY_CONFIRMED",
    "FULFILLMENT_PENDING", "FULFILLMENT_CONFIRMED", "FULFILLMENT_REMINDER", "FULFILLMENT_DISPUTED",
  ],
  registers: [
    "ITEM_FULLY_FUNDED", "ITEM_PURCHASED", "ITEM_DISPATCHED", "ITEM_DELIVERED",
    "ADDRESS_REMINDER", "ADDRESS_TIMEOUT_CANCELLED",
    "REGISTER_ITEM_APPROVED", "REGISTER_ITEM_REJECTED",
  ],
  bundles:   ["BUNDLE_UPDATE", "BUNDLE_DISPATCHED", "BUNDLE_DELIVERED"],
  circles:   [
    "CIRCLE_REPLY", "CIRCLE_THREAD_REPLY", "CIRCLE_NEW_POST", "CIRCLE_MILESTONE",
    "NEW_POST", "REPLY", "THREAD_REPLY",
  ],
  profile:   [
    "TRUST_MILESTONE", "TRUST_WARNING", "DONOR_LEVEL_UP",
    "VERIFICATION_APPROVED", "VERIFICATION_REJECTED", "MANUAL_VERIFIED",
    "ADMIN_MESSAGE", "MODERATION_ACTION", "IMPACT_CARD_UNLOCKED",
  ],
};

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { section } = await req.json();
  const types = SECTION_TYPES[section];
  if (!types) return NextResponse.json({ error: "Invalid section" }, { status: 400 });

  const result = await prisma.notification.updateMany({
    where: { userId: user.userId, isRead: false, type: { in: types } },
    data: { isRead: true },
  });

  return NextResponse.json({ updated: result.count });
}
