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
    return NextResponse.json({ error: "Givers only" }, { status: 403 });
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
    hasDiscover && hasRegister ? "combined" :
    hasDiscover               ? "discover" :
    hasRegister               ? "register" : "none";

  // ── Compute stats ────────────────────────────────────────────────────────
  const listingCompleted  = actions.filter(a => a.actionType === "listing_completed");
  const registerFulfilled = actions.filter(a => a.actionType === "register_fulfilled");

  // Mothers supported: COUNT DISTINCT recipientUserId from Discover listing_completed
  const discoverMotherIds = new Set(listingCompleted.map(a => a.recipientUserId).filter(Boolean));
  const mothersSupported  = discoverMotherIds.size;

  // Essentials: item counts per channel
  const discoverItems = listingCompleted.reduce((s, a)  => s + (a.itemCount ?? 1), 0); // SUM Discover
  const needsMet      = registerFulfilled.reduce((s, a) => s + (a.itemCount ?? 1), 0); // SUM Register
  const essentialsShared = discoverItems + needsMet;                                    // total both

  const stats = {
    mothersSupported,  // COUNT DISTINCT Discover recipients
    needsMet,          // SUM itemCount Register register_fulfilled
    discoverItems,     // SUM itemCount Discover listing_completed
    essentialsShared,  // discoverItems + needsMet
  };

  // ── Location + month ─────────────────────────────────────────────────────
  const loc      = user.location ?? "";
  const location = loc.trim() || null;
  const now      = new Date();
  const month    = now.toLocaleString("en", { month: "long", year: "numeric" });

  return NextResponse.json({
    variant,
    stats,
    location,
    month,
    unlocked: !!user.impactCardUnlockedAt,
  });
}
