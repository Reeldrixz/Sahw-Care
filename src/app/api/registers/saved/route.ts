import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const saved = await prisma.savedItem.findMany({
    where: { userId: auth.userId },
    orderBy: { savedAt: "desc" },
    include: {
      item: {
        select: {
          id: true,
          name: true,
          quantity: true,
          status: true,
          fundingStatus: true,
          standardPriceCents: true,
          totalFundedCents: true,
          registerId: true,
          catalogItem: { select: { imageUrl: true } },
        },
      },
      register: {
        select: {
          id: true,
          city: true,
          dueDate: true,
          creator: { select: { id: true, name: true, verificationLevel: true, circleContext: true } },
        },
      },
    },
  });

  const items = saved.map((s) => ({
    ...s.item,
    savedByMe: true,
    register: s.register,
  }));
  return NextResponse.json({ items });
}
