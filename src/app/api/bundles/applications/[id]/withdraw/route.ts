import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Piece B: a mother withdraws her own PENDING bundle application (self-service,
// no penalty). Only her own, and only while PENDING — an APPROVED application
// means "we're delivering it" and is released by an admin, not withdrawn.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const application = await prisma.bundleApplication.findUnique({
    where:  { id },
    select: { id: true, userId: true, status: true },
  });

  if (!application || application.userId !== currentUser.userId) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (application.status !== "PENDING") {
    return NextResponse.json(
      { error: "Only an application still under review can be withdrawn." },
      { status: 409 }
    );
  }

  await prisma.bundleApplication.update({
    where: { id },
    data:  { status: "CANCELLED" },
  });

  return NextResponse.json({ ok: true });
}
