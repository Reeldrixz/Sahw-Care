import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { autoJoinCircle } from "@/lib/countryCircle";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { location, name, role } = await req.json();

  const updated = await prisma.user.update({
    where: { id: user.userId },
    data: {
      ...(location !== undefined && { location }),
      ...(name && { name }),
      ...(role && ["DONOR", "RECIPIENT"].includes(role) && { role }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      avatar: true,
      location: true,
      isPremium: true,
      trustRating: true,
    },
  });

  // Auto-join circle when location is set for the first time
  if (location !== undefined) {
    autoJoinCircle(user.userId, location ?? updated.location).catch(() => {});
  }

  return NextResponse.json({ user: updated });
}
