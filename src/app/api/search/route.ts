import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = (searchParams.get("q") ?? "").trim();
  const type = searchParams.get("type") ?? "all";

  if (q.length < 2) {
    return NextResponse.json({ items: [], bundles: [], registers: [], total: 0, query: q });
  }

  const [items, bundles, registers] = await Promise.all([
    type === "bundles" || type === "registers" ? Promise.resolve([]) :
    prisma.item.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { title:       { contains: q, mode: "insensitive" } },
          { category:    { contains: q, mode: "insensitive" } },
          { location:    { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      include: {
        donor: {
          select: {
            id: true, name: true, avatar: true,
            trustRating: true, verificationLevel: true, countryFlag: true,
          },
        },
      },
      take: 20,
      orderBy: { createdAt: "desc" },
    }),

    type === "items" || type === "registers" ? Promise.resolve([]) :
    prisma.bundleTemplate.findMany({
      where: {
        isActive: true,
        OR: [
          { name:        { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { targetStage: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
    }),

    type === "items" || type === "bundles" ? Promise.resolve([]) :
    prisma.register.findMany({
      where: {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { city:  { contains: q, mode: "insensitive" } },
        ],
      },
      include: {
        creator: { select: { name: true, verificationLevel: true } },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    items,
    bundles,
    registers,
    total: items.length + bundles.length + registers.length,
    query: q,
  });
}
