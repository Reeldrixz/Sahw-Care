import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalculateTrustScore, awardTrust } from "@/lib/trust";
import { referralGrantFields } from "@/lib/referral";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const body = await req.json();
    const { action, status, role, isPremium, trustScore, reason } = body;

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

      // Step 2: award contact verification trust events idempotently via new engine
      for (const eventType of ["EMAIL_VERIFIED", "PHONE_VERIFIED"]) {
        await awardTrust(id, eventType, { reason: "manual admin verification" });
      }

      const finalScore = await recalculateTrustScore(id);

      const updated = await prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, trustScore: true, verificationLevel: true, phoneVerified: true, emailVerified: true, docStatus: true, onboardingComplete: true },
      });
      return NextResponse.json({ user: updated });
    }

    // ── Grant recipient access (admin override of the referral gate) ─────────
    // The RECIPIENT role is referral-only by design; a partner issuing a code
    // IS the vetting. This is the escape hatch for the case that path cannot
    // serve — a verified mother in front of you with no code to give her.
    //
    // It reuses referralGrantFields() DIRECTLY rather than re-listing the
    // fields. That is deliberate and load-bearing: the grant sets
    // onboardingComplete=false and journeyType=null so she re-runs onboarding
    // and receives a stage and a cohort circle. Setting role alone would leave
    // a RECIPIENT with null currentStage and null currentCircleId who never
    // re-onboards — breaking Circles, Reflections (which requires
    // currentStage), and the stage-transition cron. Sharing the function means
    // this can never drift from the referral path.
    if (action === "grantRecipient") {
      if (!reason?.trim()) {
        return NextResponse.json(
          { error: "A written reason is required — this bypasses partner vetting." },
          { status: 400 }
        );
      }

      const target = await prisma.user.findUnique({
        where:  { id },
        select: { id: true, name: true, role: true },
      });
      if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

      // Already a mother — nothing to grant. Mirrors the redeem route, which
      // returns alreadyRecipient rather than re-running the grant.
      if (target.role === "RECIPIENT") {
        return NextResponse.json({ ok: true, alreadyRecipient: true });
      }
      // Refuse anything that is not a plain donor, so an admin account cannot
      // be silently converted into a mother account.
      if (target.role !== "DONOR") {
        return NextResponse.json(
          { error: `Only a DONOR account can be granted recipient access (this one is ${target.role}).` },
          { status: 400 }
        );
      }

      await prisma.user.update({
        where: { id },
        data: {
          ...referralGrantFields(),
          manualReviewedByAdminId:   admin.userId,
          recipientGrantedByAdminId: admin.userId,
          recipientGrantedAt:        new Date(),
          recipientGrantNote:        reason.trim().slice(0, 1000),
        },
      });

      // No referral code is consumed or created. Inventing one would credit a
      // partner with a referral they never made and corrupt their stats.

      // Trust baseline, matching the referral path exactly.
      await awardTrust(id, "EMAIL_VERIFIED", { reason: "admin recipient grant" });

      // She is not at her screen, and the grant is not finished until she
      // re-runs onboarding — so tell her, and say what to do next. The note is
      // admin-only and deliberately not included: she is told she has access,
      // never that her admission was an exception.
      await notifyUser({
        userId:  id,
        type:    "ADMIN_MESSAGE",
        message:
          "You've been given access to care support on Kradel. There are a couple of quick questions " +
          "left — how far along you are, or your baby's age — so we can place you with mothers at the " +
          "same stage. Open the app whenever you're ready and we'll pick up there.",
        link:    "/",
        context: "admin:grant-recipient",
      });

      const updated = await prisma.user.findUnique({
        where:  { id },
        select: {
          id: true, name: true, role: true, onboardingComplete: true,
          journeyType: true, manualReviewStatus: true, recipientGrantedAt: true,
        },
      });
      return NextResponse.json({ user: updated, granted: true });
    }

    // ── Account hold ─────────────────────────────────────────────────────────
    if (action === "placeHold") {
      if (!reason?.trim()) return NextResponse.json({ error: "Reason is required" }, { status: 400 });
      const updated = await prisma.user.update({
        where: { id },
        data: {
          accountHold: true,
          accountHoldReason: reason.trim(),
          accountHoldAt: new Date(),
          accountHoldByAdminId: admin.userId,
        },
        select: { id: true, accountHold: true, accountHoldReason: true, accountHoldAt: true },
      });
      return NextResponse.json({ user: updated });
    }

    if (action === "releaseHold") {
      const updated = await prisma.user.update({
        where: { id },
        data: {
          accountHold: false,
          accountHoldReason: null,
          accountHoldAt: null,
          accountHoldByAdminId: null,
        },
        select: { id: true, accountHold: true },
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
