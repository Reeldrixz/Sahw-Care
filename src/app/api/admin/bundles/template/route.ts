import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function adminGuard(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return null;
  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { role: true } });
  return user?.role === "ADMIN" ? auth : null;
}

export async function POST(req: NextRequest) {
  const auth = await adminGuard(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();

  const template = await prisma.bundleTemplate.create({
    data: {
      name:          body.name,
      description:   body.description ?? "",
      estimatedCost: Number(body.estimatedCost) || 0,
      items:         body.items ?? [],
      targetStage:   body.targetStage || null,
      isActive:      true,
    },
  });

  return NextResponse.json({ template }, { status: 201 });
}
