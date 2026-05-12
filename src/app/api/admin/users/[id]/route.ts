import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculateTrustScore, awardTrust } from "@/lib/trust";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const body = await req.json();
    const { action, status, role, isPremium, trustScore } = body;

    // ── Manual verification override ─────────────────────────────────────────
    if (action === "manualVerify") {
      // Step 1: set all access flags so the user is fully unlocked
      await prisma.user.update({
        where: { id },
        data: {
          phoneVerified:     true,
          emailVerified:     true,
          verificationLevel: 2,
          docStatus:         "VERIFIED",
          verifiedAt:        new Date(),
          hasPostedIntro:    true,    // skip intro prompt
          onboardingComplete: true,   // grants circles access
        },
      });

      // Step 2: award verification trust events idempotently via new engine
      for (const eventType of ["EMAIL_VERIFIED", "PHONE_VERIFIED", "DOC_VERIFIED"]) {
        await awardTrust(id, eventType, { reason: "manual admin verification" });
      }

      const finalScore = await recalculateTrustScore(id);

      const updated = await prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, trustScore: true, verificationLevel: true, phoneVerified: true, emailVerified: true, docStatus: true, onboardingComplete: true },
      });
      return NextResponse.json({ user: updated });
    }

    // ── Standard field updates ────────────────────────────────────────────────
    const validStatuses = ["ACTIVE", "PENDING", "FLAGGED", "SUSPENDED"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(status    !== undefined && { status }),
        ...(role      !== undefined && { role }),
        ...(isPremium !== undefined && { isPremium }),
        ...(trustScore !== undefined && { trustScore: Math.max(0, Math.min(100, Number(trustScore))) }),
      },
      select: { id: true, name: true, role: true, status: true, isPremium: true, trustScore: true },
    });

    const newScore = await recalculateTrustScore(id);
    return NextResponse.json({ user: { ...updated, trustScore: newScore } });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(_req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
