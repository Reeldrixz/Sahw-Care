import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireAdmin(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } });
  return user?.role === "ADMIN" ? payload : null;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING";

  const users = await prisma.user.findMany({
    where: { docStatus: status as "PENDING" | "VERIFIED" | "REJECTED" | "UNVERIFIED" },
    select: {
      id: true, name: true, email: true, phone: true, avatar: true,
      docStatus: true, documentUrl: true, documentType: true,
      documentNote: true, verifiedAt: true, createdAt: true,
      phoneVerified: true, emailVerified: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
