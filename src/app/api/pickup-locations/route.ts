import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city") ?? "";

  const locations = await prisma.publicPickupLocation.findMany({
    where: {
      isActive: true,
      ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ locations });
}
