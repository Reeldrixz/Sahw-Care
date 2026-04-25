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

// GET /api/admin/bundles — all instances (filterable)
export async function GET(req: NextRequest) {
  const auth = await adminGuard(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search") ?? "";
  const tab    = searchParams.get("tab") ?? "instances"; // "instances" | "campaigns"

  if (tab === "campaigns") {
    const campaigns = await prisma.campaign.findMany({
      include: { template: { select: { name: true } }, _count: { select: { instances: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ campaigns });
  }

  const instances = await prisma.bundleInstance.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(search ? {
        recipient: { name: { contains: search, mode: "insensitive" as never } },
      } : {}),
    },
    include: {
      recipient: { select: { id: true, name: true, email: true, location: true } },
      campaign:  { select: { title: true } },
      template:  { select: { name: true } },
    },
    orderBy: { requestedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ instances });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
