import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// PATCH — revoke an UNUSED code. A USED code can never be revoked (the mother
// already redeemed it); the conditional update makes that race-safe.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { action } = await req.json().catch(() => ({}));
  if (action !== "revoke") return NextResponse.json({ error: "Unsupported action" }, { status: 400 });

  const res = await prisma.referralCode.updateMany({
    where: { id, status: "UNUSED" },
    data:  { status: "REVOKED" },
  });

  if (res.count !== 1) {
    return NextResponse.json({ error: "Only unused codes can be revoked" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
