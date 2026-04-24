import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { awardTrust } from "@/lib/trust";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/bundles/allocation/[id]/confirm
 * Recipient confirms they received a BundleAllocation.
 * Sets status → CONFIRMED, records confirmedAt, awards +5 trust to recipient.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token   = await getTokenFromRequest(req);
  const auth    = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allocation = await prisma.bundleAllocation.findUnique({ where: { id } });
  if (!allocation) return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
  if (allocation.recipientId !== auth.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!["DELIVERED", "DISPATCHED"].includes(allocation.status)) {
    return NextResponse.json({ error: "Bundle has not yet been dispatched" }, { status: 400 });
  }
  if (allocation.status === "CONFIRMED") {
    return NextResponse.json({ error: "Already confirmed" }, { status: 409 });
  }

  const now = new Date();

  await prisma.bundleAllocation.update({
    where: { id },
    data:  { status: "CONFIRMED", confirmedAt: now },
  });

  // Trust award for recipient (fire-and-forget)
  awardTrust(auth.userId, "BUNDLE_ALLOCATION_CONFIRMED", {
    referenceId: id, referenceType: "BundleAllocation",
    reason: "confirmed bundle allocation received",
  }).catch(() => {});

  return NextResponse.json({ confirmed: true });
}
