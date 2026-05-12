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
    "ADMIN_MESSAGE", "MODERATION_ACTION",
  ],
};

const EMPTY = { discover: 0, pickups: 0, registers: 0, bundles: 0, circles: 0, profile: 0 };

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json(EMPTY);

  const allTypes = Object.values(SECTION_TYPES).flat();
  const rows = await prisma.notification.findMany({
    where: { userId: user.userId, isRead: false, type: { in: allTypes } },
    select: { type: true },
  });

  const typeCounts = rows.reduce<Record<string, number>>((acc, { type }) => {
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {});

  const result: Record<string, number> = {};
  for (const [section, types] of Object.entries(SECTION_TYPES)) {
    result[section] = types.reduce((sum, t) => sum + (typeCounts[t] ?? 0), 0);
  }

  return NextResponse.json(result);
}
