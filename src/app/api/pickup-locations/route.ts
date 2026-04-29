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

  // Fetch all active locations once
  const allLocations = await prisma.publicPickupLocation.findMany({
    where: { isActive: true },
    select: { id: true, name: true, type: true, address: true, city: true },
    orderBy: [{ name: "asc" }],
  });

  // Build category buckets — city-first, up to 3 suggestions each
  const categories = PICKUP_CATEGORIES.map((cat) => {
    const matching = allLocations.filter((l) => l.type === cat.id);

    // City rows first, then rest; cap at 3
    const cityRows = matching.filter(
      (l) => userCity && l.city.toLowerCase() === userCity.toLowerCase()
    );
    const otherRows = matching.filter(
      (l) => !userCity || l.city.toLowerCase() !== userCity.toLowerCase()
    );
    const suggestions = [...cityRows, ...otherRows].slice(0, 3).map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      city: l.city,
    }));

    return {
      id: cat.id,
      label: cat.label,
      icon: cat.icon,
      suggestions,
    };
  });

  return NextResponse.json({ categories });
}
