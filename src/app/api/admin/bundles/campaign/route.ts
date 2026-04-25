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

  try {

  const body = await req.json();

  if (!body.title || !body.templateId) {
    return NextResponse.json({ error: "title and templateId are required" }, { status: 400 });
  }

  const campaign = await prisma.campaign.create({
    data: {
      title:           body.title,
      description:     body.description ?? "",
      sponsorName:     body.sponsorName ?? "Kradəl Care",
      totalBudget:     Number(body.totalBudget) || 0,
      costPerBundle:   Number(body.costPerBundle) || 0,
      totalBundles:    Number(body.totalBundles) || 0,
      bundlesRemaining: Number(body.totalBundles) || 0,
      status:          body.status ?? "DRAFT",
      targetStage:     body.targetStage || null,
      targetRegion:    body.targetRegion || null,
      templateId:      body.templateId,
    },
  });

  return NextResponse.json({ campaign }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
