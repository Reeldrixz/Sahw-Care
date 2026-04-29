import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const status  = searchParams.get("status") ?? "";
  const city    = searchParams.get("city") ?? "";
  const reported = searchParams.get("reported") === "1";

  const coordinations = await prisma.pickupCoordination.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(reported ? { status: "REPORTED" } : {}),
      ...(city ? { location: { city: { contains: city, mode: "insensitive" } } } : {}),
    },
    include: {
      request: {
        include: {
          item: { select: { id: true, title: true } },
          requester: { select: { id: true, name: true, email: true } },
        },
      },
      location: { select: { name: true, city: true, type: true } },
      reports: { select: { id: true, reason: true, notes: true, reviewed: true, createdAt: true } },
      messages: {
        include: { sender: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { reports: true, messages: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ coordinations });
}
