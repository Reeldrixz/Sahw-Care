import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DISCOVER_TYPES  = ["listing_posted",    "listing_completed"]   as const;
const REGISTER_TYPES  = ["register_committed", "register_fulfilled"]  as const;

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: { location: true, journeyType: true, impactCardUnlockedAt: true },
  });

  if (user?.journeyType !== "donor") {
    return NextResponse.json({ error: "Donors only" }, { status: 403 });
  }

  // ── Pull all qualifying actions ──────────────────────────────────────────
  const actions = await prisma.missionAction.findMany({
    where: {
      userId:     auth.userId,
      actionType: { in: [...DISCOVER_TYPES, ...REGISTER_TYPES] },
    },
    select: { actionType: true, recipientUserId: true, itemCount: true },
  });

  const discoverActions = actions.filter(a => (DISCOVER_TYPES as readonly string[]).includes(a.actionType));
  const registerActions = actions.filter(a => (REGISTER_TYPES as readonly string[]).includes(a.actionType));

  const hasDiscover = discoverActions.length > 0;
  const hasRegister = registerActions.length > 0;

  const variant =
    hasDiscover && hasRegister ? "combined"  :
    hasDiscover               ? "discover"  :
    hasRegister               ? "register"  : "none";

  // ── Compute stats ────────────────────────────────────────────────────────
  const listingCompleted  = actions.filter(a => a.actionType === "listing_completed");
  const registerFulfilled = actions.filter(a => a.actionType === "register_fulfilled");

  const discoverMotherIds  = new Set(listingCompleted.map(a => a.recipientUserId).filter(Boolean));
  const registerFamilyIds  = new Set(registerFulfilled.map(a => a.recipientUserId).filter(Boolean));

  const itemsShared         = listingCompleted.reduce((s, a)  => s + (a.itemCount ?? 1), 0);
  const essentialsDelivered = registerFulfilled.reduce((s, a) => s + (a.itemCount ?? 1), 0);

  const stats = {
    mothersSupported:    discoverMotherIds.size,
    itemsShared,
    requestsFulfilled:   registerFulfilled.length,
    familiesSupported:   registerFamilyIds.size,
    essentialsDelivered,
  };

  // ── City + month ─────────────────────────────────────────────────────────
  const loc    = user.location ?? "";
  const city   = loc.includes(",") ? loc.split(",")[0].trim() : loc || null;
  const now    = new Date();
  const month  = now.toLocaleString("en", { month: "long", year: "numeric" });

  return NextResponse.json({
    variant,
    stats,
    city,
    month,
    unlocked: !!user.impactCardUnlockedAt,
  });
}
