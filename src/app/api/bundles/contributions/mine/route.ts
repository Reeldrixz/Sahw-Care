import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contributions = await prisma.bundleContribution.findMany({
    where: { donorId: payload.userId },
    orderBy: { createdAt: "desc" },
    include: {
      goal: {
        select: { month: true, targetBundles: true, deliveredBundles: true, status: true },
      },
    },
  });

  const totalBundles = contributions
    .filter(c => c.status === "CONFIRMED")
    .reduce((s, c) => s + c.bundleCount, 0);

  return NextResponse.json({ contributions, totalBundles });
}
