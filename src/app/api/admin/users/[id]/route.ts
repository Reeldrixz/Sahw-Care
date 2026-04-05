import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status, role, isPremium } = await req.json();

  const validStatuses = ["ACTIVE", "PENDING", "FLAGGED", "SUSPENDED"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(role && { role }),
      ...(isPremium !== undefined && { isPremium }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      isPremium: true,
    },
  });

  return NextResponse.json({ user: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
