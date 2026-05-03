import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const register = await prisma.register.findUnique({ where: { id }, select: { id: true } });
  if (!register) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.savedRegister.findFirst({
    where: { userId: auth.userId, registerId: id },
  });

  if (existing) {
    await prisma.savedRegister.delete({ where: { id: existing.id } });
    return NextResponse.json({ saved: false });
  }

  await prisma.savedRegister.create({ data: { userId: auth.userId, registerId: id } });
  return NextResponse.json({ saved: true });
}
