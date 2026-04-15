import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { countryCodeToFlag } from "@/lib/stage";

export const dynamic = "force-dynamic";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const location = searchParams.get("location");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const donorId = searchParams.get("donorId");
  const where: Record<string, unknown> = donorId ? { donorId } : { status: "ACTIVE" };

  if (category && category !== "All") {
    where.category = category;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
    ];
  }

  if (location) {
    where.location = { contains: location, mode: "insensitive" };
  }

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      include: {
        donor: { select: { id: true, name: true, avatar: true, trustRating: true, countryCode: true } },
        _count: { select: { requests: true } },
      },
      orderBy: [{ urgent: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    }),
    prisma.item.count({ where }),
  ]);

  const formatted = items.map((item) => ({
    ...item,
    donor: {
      id:          item.donor.id,
      name:        item.donor.name,
      avatar:      item.donor.avatar,
      trustRating: item.donor.trustRating,
      countryFlag: item.donor.countryCode ? countryCodeToFlag(item.donor.countryCode) : null,
    },
  }));

  return NextResponse.json({ items: formatted, total });
}

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;

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
        images: images ?? [],
        urgent: urgent ?? false,
        status: "PENDING",
        donorId: user.userId,
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
