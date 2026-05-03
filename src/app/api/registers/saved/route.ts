import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const saved = await prisma.savedRegister.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
    include: {
      register: {
        include: {
          creator: { select: { id: true, name: true, location: true, verificationLevel: true } },
          items: {
            select: {
              id: true,
              status: true,
              fundingStatus: true,
              standardPriceCents: true,
              totalFundedCents: true,
              _count: { select: { funding: true } },
              catalogItem: { select: { imageUrl: true } },
            },
          },
        },
      },
    },
  });

  const registers = saved.map((s) => ({ ...s.register, savedByMe: true }));
  return NextResponse.json({ registers });
}
