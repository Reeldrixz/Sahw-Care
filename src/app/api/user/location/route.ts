import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { city, radius, setByGPS } = body;

  if (!city || typeof city !== "string" || !city.trim()) {
    return NextResponse.json({ error: "city is required" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: auth.userId },
    data: {
      preferredCity: city.trim(),
      preferredRadius: typeof radius === "number" ? Math.max(1, radius) : 10,
      locationSetByGPS: setByGPS === true,
    },
    select: { id: true, preferredCity: true, preferredRadius: true, locationSetByGPS: true },
  });

  return NextResponse.json({ user: updated });
}
