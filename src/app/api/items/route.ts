import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { countryCodeToFlag } from "@/lib/stage";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { TRUST_THRESHOLDS } from "@/lib/trust";

export const dynamic = "force-dynamic";

// RANKING PHILOSOPHY — Kradəl is NOT a marketplace
// The following signals are INTENTIONALLY EXCLUDED from ranking:
// - Item likes or saves (favourites count)
// - Number of requests received on an item
// - Donor profile views
// - Engagement metrics of any kind
// - Popularity of item category
// These exclusions are permanent product decisions, not oversights.

interface RankableItem {
  createdAt: Date;
  images: string[];
  location: string;
  donor: {
    verificationLevel: number;
    countryCode: string | null;
    _count: { items: number };
  };
}

function scoreItem(
  item: RankableItem,
  preferredCity: string | null,
  userCountryCode: string | null,
): number {
  let score = 0;

  // 1. LOCATION MATCH — highest weight
  if (preferredCity && item.location.toLowerCase().includes(preferredCity.toLowerCase())) {
    score += 40; // Exact city match
  } else if (userCountryCode && item.donor.countryCode === userCountryCode) {
    score += 15; // Same country fallback
  }

  // 2. RECENCY — recent items ranked higher
  const hoursAgo = (Date.now() - item.createdAt.getTime()) / 3600000;
  if      (hoursAgo < 2)  score += 30; // just listed
  else if (hoursAgo < 24) score += 20; // today
  else if (hoursAgo < 72) score += 10; // this week
  // Older than 72h: no recency bonus — still shown, just lower

  // 3. DONOR VERIFICATION — verified donors ranked higher
  if      (item.donor.verificationLevel >= 2) score += 20;
  else if (item.donor.verificationLevel >= 1) score += 10;

  // 4. DONOR TRUST HISTORY — fulfilled donations = reliable donor
  const fulfilledCount = item.donor._count.items;
  if      (fulfilledCount >= 5) score += 15;
  else if (fulfilledCount >= 1) score += 8;

  // 5. ITEM COMPLETENESS — items with photos ranked higher
  if (item.images.length > 0) score += 10;

  return score;
}

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;

  // Fetch caller info (trust score for requestable flag + countryCode for ranking)
  let callerTrustScore  = 0;
  let userCountryCode: string | null = null;
  if (auth) {
    const caller = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { trustScore: true, countryCode: true },
    });
    callerTrustScore = caller?.trustScore ?? 0;
    userCountryCode  = caller?.countryCode ?? null;
  }
  const canRequest = callerTrustScore >= TRUST_THRESHOLDS.MARKETPLACE;

  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category");
  const search   = searchParams.get("search");
  const location = searchParams.get("location"); // user's preferred city string
  const limit    = parseInt(searchParams.get("limit")  ?? "50");
  const offset   = parseInt(searchParams.get("offset") ?? "0");
  const donorId  = searchParams.get("donorId");

  const where: Record<string, unknown> = donorId ? { donorId } : { status: "ACTIVE" };

  if (category && category !== "All") {
    where.category = category;
  }
  if (search) {
    where.OR = [
      { title:       { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { category:    { contains: search, mode: "insensitive" } },
    ];
  }
  if (location) {
    where.location = { contains: location, mode: "insensitive" };
  }

  // ── Profile page / donorId path — original ordering, no ranking ─────────────
  if (donorId) {
    const [items, total] = await Promise.all([
      prisma.item.findMany({
        where,
        include: {
          donor: { select: { id: true, name: true, avatar: true, trustRating: true, countryCode: true, verificationLevel: true } },
          _count: { select: { requests: true } },
        },
        orderBy: [{ urgent: "desc" }, { createdAt: "desc" }],
        take:  limit,
        skip:  offset,
      }),
      prisma.item.count({ where }),
    ]);

    const formatted = items.map((item) => ({
      ...item,
      requestable: canRequest,
      requestLockedReason: canRequest ? null : `You need a trust score of ${TRUST_THRESHOLDS.MARKETPLACE} to request items.`,
      donor: {
        id:                item.donor.id,
        name:              item.donor.name,
        avatar:            item.donor.avatar,
        trustRating:       item.donor.trustRating,
        countryFlag:       item.donor.countryCode ? countryCodeToFlag(item.donor.countryCode) : null,
        verificationLevel: item.donor.verificationLevel,
      },
    }));

    return NextResponse.json({ items: formatted, total });
  }

  // ── Discover feed path — ranked ──────────────────────────────────────────────
  // Fetch all matching items (capped at 200 for in-memory ranking)
  const [rawItems, total] = await Promise.all([
    prisma.item.findMany({
      where,
      include: {
        donor: {
          select: {
            id: true, name: true, avatar: true, trustRating: true,
            countryCode: true, verificationLevel: true,
            _count: { select: { items: { where: { status: "FULFILLED" } } } },
          },
        },
      },
      take: 200, // pre-filtering cap; add DB country filter if item base exceeds 500
    }),
    prisma.item.count({ where }),
  ]);

  // Score, sort, slice — score is never returned to the client
  const preferredCity = location ?? null;
  const ranked = rawItems
    .map((item) => ({ ...item, _score: scoreItem(item, preferredCity, userCountryCode) }))
    .sort((a, b) => b._score - a._score)
    .slice(offset, offset + limit)
    .map(({ _score, ...item }) => item);

  const formatted = ranked.map((item) => ({
    ...item,
    requestable: canRequest,
    requestLockedReason: canRequest ? null : `You need a trust score of ${TRUST_THRESHOLDS.MARKETPLACE} to request items.`,
    donor: {
      id:                item.donor.id,
      name:              item.donor.name,
      avatar:            item.donor.avatar,
      trustRating:       item.donor.trustRating,
      countryFlag:       item.donor.countryCode ? countryCodeToFlag(item.donor.countryCode) : null,
      verificationLevel: item.donor.verificationLevel,
    },
  }));

  return NextResponse.json({ items: formatted, total });
}

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const user  = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { title, category, condition, quantity, location, description, images, urgent } = body;

    if (!title || !category || !condition || !quantity || !location) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const item = await prisma.item.create({
      data: {
        title,
        category,
        condition,
        quantity,
        location,
        description: description ?? null,
        images:      images      ?? [],
        urgent:      urgent      ?? false,
        status:      "PENDING",
        donorId:     user.userId,
      },
      include: {
        donor: { select: { id: true, name: true, avatar: true } },
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Create item error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
