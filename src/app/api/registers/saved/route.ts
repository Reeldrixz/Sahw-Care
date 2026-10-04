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
          // Reduced to { id, firstName } below, like the browse list: no
          // surname, and no circleContext, which she set as a label for her
          // circle ("Only visible to other moms"), not for donors.
          creator: { select: { id: true, name: true } },
        },
      },
    },
  });

  const items = saved.map((s) => ({
    ...s.item,
    savedByMe: true,
    register: {
      ...s.register,
      creator: { id: s.register.creator.id, firstName: s.register.creator.name.split(" ")[0] || s.register.creator.name },
    },
  }));
  return NextResponse.json({ items });
}
