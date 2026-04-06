import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");
  const creatorId = searchParams.get("creatorId");

  const registers = await prisma.register.findMany({
    where: {
      ...(city && { city: { contains: city, mode: "insensitive" } }),
      ...(creatorId && { creatorId }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { id: true, name: true, location: true } },
      items: { select: { id: true, status: true } },
    },
  });

  return NextResponse.json({ registers });
}

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, city, dueDate } = await req.json();
  if (!title || !city || !dueDate) {
    return NextResponse.json({ error: "Title, city and due date are required" }, { status: 400 });
  }

  const register = await prisma.register.create({
    data: {
      title,
      city,
      dueDate: new Date(dueDate),
      creatorId: auth.userId,
    },
    include: {
      creator: { select: { id: true, name: true, location: true } },
      items: true,
    },
  });

  return NextResponse.json({ register }, { status: 201 });
}
