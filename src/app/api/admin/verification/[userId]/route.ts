import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { awardTrust } from "@/lib/trust";
import { logAbuseEvent } from "@/lib/abuse";

export const dynamic = "force-dynamic";

async function requireAdmin(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } });
  return user?.role === "ADMIN" ? payload : null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
  const { userId } = await params;
  const { action, note } = await req.json(); // action: "approve" | "reject"

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  }

  const APPROVE_NOTE = "Your document has been verified — welcome to Kradəl! You can now create your Register of Needs. 💛";
  const DEFAULT_REJECT = "We weren't able to verify this document. Please upload a clearer photo or a different document (hospital letter, scan, birth certificate, or immunisation card).";

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      docStatus: action === "approve" ? "VERIFIED" : "REJECTED",
      verifiedAt: action === "approve" ? new Date() : null,
      documentNote: action === "approve" ? APPROVE_NOTE : (note?.trim() || DEFAULT_REJECT),
    },
    select: { id: true, name: true, docStatus: true, documentNote: true, verifiedAt: true },
  });

  if (action === "approve") {
    awardTrust(userId, "DOC_VERIFIED", { reason: "motherhood document verified" }).catch(() => {});
    logAbuseEvent(userId, "VERIFICATION_APPROVED", user.docStatus === "VERIFIED" ? 15 : 0, { action: "approve", reviewedBy: admin.userId }, undefined).catch(() => {});
  } else {
    logAbuseEvent(userId, "VERIFICATION_REJECTED", 0, { action: "reject", reviewedBy: admin.userId }, undefined).catch(() => {});
  }

  return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
