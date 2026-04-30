import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PICKUP_CATEGORIES } from "@/lib/pickup-categories";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city") ?? "";

  // Resolve the requesting user's preferred city when available
  let userCity = city;
  if (!userCity) {
    const token = await getTokenFromRequest(req);
    if (token) {
      const user = await verifyToken(token);
      if (user) {
        const profile = await prisma.user.findUnique({
          where: { id: user.userId },
          select: { preferredCity: true },
        });
        userCity = profile?.preferredCity ?? "";
      }
    }
  }

  // No city → return all categories with empty suggestions
  if (!userCity) {
    const categories = PICKUP_CATEGORIES.map((cat) => ({
      id: cat.id,
      label: cat.label,
      icon: cat.icon,
      suggestions: [],
    }));
    return NextResponse.json({ categories });
  }

  // Strict city filter — no cross-city fallback
  const cityLocations = await prisma.publicPickupLocation.findMany({
    where: { isActive: true, city: { equals: userCity, mode: "insensitive" } },
    select: { id: true, name: true, type: true, address: true, city: true },
    orderBy: [{ name: "asc" }],
  });

  // Build category buckets, up to 3 suggestions each
  const categories = PICKUP_CATEGORIES.map((cat) => {
    const suggestions = cityLocations
      .filter((l) => l.type === cat.id)
      .slice(0, 3)
      .map((l) => ({ id: l.id, name: l.name, address: l.address, city: l.city }));

    return {
      id: cat.id,
      label: cat.label,
      icon: cat.icon,
      suggestions,
    };
  });

  return NextResponse.json({ categories });
}
