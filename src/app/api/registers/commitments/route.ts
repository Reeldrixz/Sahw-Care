import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assignments = await prisma.itemAssignment.findMany({
    where: { donorId: auth.userId },
    orderBy: { createdAt: "desc" },
    include: {
      item: {
        include: {
          register: {
            select: { id: true, title: true, city: true, creator: { select: { name: true } } },
          },
        },
      },
    },
  });

  return NextResponse.json({ assignments });
}
