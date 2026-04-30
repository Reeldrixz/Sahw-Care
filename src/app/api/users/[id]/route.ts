import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { countryCodeToFlag } from "@/lib/stage";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      avatar: true,
      location: true,
      countryCode: true,
      role: true,
      isPremium: true,
      trustRating: true,
      verificationLevel: true,
      createdAt: true,
      _count: { select: { items: true } },
      reviewsReceived: {
        include: {
          reviewer: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      items: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          title: true,
          category: true,
          condition: true,
          quantity: true,
          images: true,
          urgent: true,
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // compute average ratings
  const reviews = user.reviewsReceived;
  const avgPickup = reviews.length ? reviews.reduce((s, r) => s + r.pickupRating, 0) / reviews.length : 0;
  const avgQuality = reviews.length ? reviews.reduce((s, r) => s + r.qualityRating, 0) / reviews.length : 0;
  const avgQty = reviews.length ? reviews.reduce((s, r) => s + r.quantityRating, 0) / reviews.length : 0;

  return NextResponse.json({
    user: { ...user, countryFlag: user.countryCode ? countryCodeToFlag(user.countryCode) : null },
    ratings: { pickup: avgPickup, quality: avgQuality, quantity: avgQty },
  });
}
