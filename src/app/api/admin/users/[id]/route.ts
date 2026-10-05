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
    const { action, status, role, isPremium, trustScore, reason, basis } = body;

    // ── Manual verification override ─────────────────────────────────────────
    if (action === "manualVerify") {
      // Step 1: contact + document verification.
      //
      // This does NOT set identityVerified, so it does not unlock what that
      // gates (see lib/access.ts): applying for a care bundle, confirming a
      // shipment address (unless she was partner-referred), and claiming a
      // Discover item after her first. Only Persona or the overrideIdentity
      // action below sets identityVerified; use that for those gates.
      // Register creation and adding register items do not read it at all.
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

    // ── Identity override (admin bypass of Persona ID verification) ──────────
    // identityVerified is read by three gates in lib/access.ts:
    //   canApplyForBundle    — applying for a care bundle
    //   canReceiveShipment   — confirming a register shipment address; a
    //                          partner referral also passes, so this override
    //                          only matters there for mothers with no code
    //   canClaimDiscoverItem — Discover claims after her first (the first
    //                          needs manual review approval instead)
    // Creating a register or adding items to one does not read it. Its only
    // other writer is the Persona webhook on inquiry.approved.
    // Without this action there is no path to it at all for a mother Persona
    // cannot serve — which is not a hypothetical, it is the live blocker.
    //
    // personaInquiryId and personaStatus are deliberately NOT set. They stay
    // null so an override remains permanently distinguishable from a real
    // government-ID pass: identityVerified=true with personaStatus=null means a
    // human vouched, and identityOverrideByAdminId says which human and why.
    // Writing a fake "approved" here would erase that distinction forever.
    //
    // Note what is skipped along with Persona: the duplicate-identity check
    // (identityHash) that runs on a real approval. An overridden account is not
    // deduped, so the same person could in principle be verified twice under
    // two accounts. That is a reason to use this deliberately, not a reason to
    // fake the hash from data we do not have.
    if (action === "overrideIdentity") {
      if (!reason?.trim()) {
        return NextResponse.json(
          { error: "A written reason is required — this vouches for a real person receiving physical goods." },
          { status: 400 }
        );
      }

      const target = await prisma.user.findUnique({
        where:  { id },
        select: { id: true, name: true, identityVerified: true },
      });
      if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

      // Never re-run on someone already verified. If Persona approved her, that
      // record must not be overwritten by an override stamp.
      if (target.identityVerified) {
        return NextResponse.json({ ok: true, alreadyVerified: true });
      }

      await prisma.user.update({
        where: { id },
        data: {
          identityVerified:          true,
          identityVerifiedAt:        new Date(),
          identityOverrideByAdminId: admin.userId,
          identityOverrideReason:    reason.trim().slice(0, 1000),
        },
      });

      // Same notification the Persona path sends, so she sees one consistent
      // outcome regardless of which route got her there. The reason is
      // admin-only and deliberately excluded.
      await notifyUser({
        userId:  id,
        type:    "VERIFICATION_APPROVED",
        message: "Your identity has been verified. You're all set — you can apply for a care bundle whenever you're ready.",
        link:    "/bundles",
        context: "admin:override-identity",
      });

      const updated = await prisma.user.findUnique({
        where:  { id },
        select: {
          id: true, name: true, identityVerified: true, identityVerifiedAt: true,
          identityOverrideByAdminId: true, personaStatus: true,
        },
      });
      return NextResponse.json({ user: updated, overridden: true });
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
      // Which check the admin's judgement stands in for. Required, so a null
      // recipientGrantBasis can only ever mean a grant made before it existed.
      if (basis !== "ID" && basis !== "REFERRAL") {
        return NextResponse.json(
          { error: "A grant basis is required: \"ID\" (you checked her identity) or \"REFERRAL\" (a partner vouched for her without a code)." },
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
          recipientGrantBasis:       basis,
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
          recipientGrantBasis: true,
        },
      });
      return NextResponse.json({ user: updated, granted: true });
    }

    // ── Set or change the basis of an existing admin grant ───────────────────
    // grantRecipient refuses anyone already RECIPIENT, so this is the only way
    // to record a basis on a grant made before the field existed, or to correct
    // one. It writes recipientGrantBasis and nothing else on the user: role,
    // stage, circle, onboarding and the original grant note are untouched.
    // Every change is appended to RecipientGrantBasisChange with its reason, so
    // no earlier justification is overwritten.
    //
    // Only for a mother who holds an admin grant. A mother who redeemed a
    // partner code has no grant to have a basis; her referral is recorded by
    // the code (referralCodeId), and a basis here would misdescribe it.
    if (action === "setGrantBasis") {
      if (basis !== "ID" && basis !== "REFERRAL") {
        return NextResponse.json(
          { error: "basis must be \"ID\" (an admin checked her identity) or \"REFERRAL\" (a partner vouched for her without a code)." },
          { status: 400 }
        );
      }
      if (!reason?.trim()) {
        return NextResponse.json(
          { error: "A written reason is required — this changes what her admission is recorded as resting on." },
          { status: 400 }
        );
      }

      const target = await prisma.user.findUnique({
        where:  { id },
        select: { role: true, recipientGrantedAt: true, recipientGrantBasis: true },
      });
      if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
      if (target.role !== "RECIPIENT" || !target.recipientGrantedAt) {
        return NextResponse.json(
          { error: "Only a mother admitted by an admin grant has a grant basis to set." },
          { status: 400 }
        );
      }
      if (target.recipientGrantBasis === basis) {
        return NextResponse.json({ ok: true, unchanged: true, recipientGrantBasis: basis });
      }

      await prisma.$transaction([
        prisma.user.update({
          where: { id },
          data:  { recipientGrantBasis: basis },
        }),
        prisma.recipientGrantBasisChange.create({
          data: {
            userId:    id,
            fromBasis: target.recipientGrantBasis,
            toBasis:   basis,
            reason:    reason.trim().slice(0, 1000),
            adminId:   admin.userId,
          },
        }),
      ]);

      return NextResponse.json({ ok: true, recipientGrantBasis: basis, fromBasis: target.recipientGrantBasis });
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
    // Only DONOR can be set here. RECIPIENT and ADMIN each have their own path:
    // a bare RECIPIENT write skips referralGrantFields(), leaving a mother with
    // no stage and no cohort circle who never re-onboards, and records no reason
    // or granting admin — grantRecipient does all of that. ADMIN has no in-app
    // path at all, deliberately; it is granted out of band.
    const roleRedirects: Record<string, string> = {
      RECIPIENT: "Use action \"grantRecipient\" with a written reason to grant recipient access.",
      ADMIN:     "Admin access can't be granted here. Use scripts/promote-admin.ts.",
    };
    const validRoles = ["DONOR"];
    if (role !== undefined && !validRoles.includes(role)) {
      return NextResponse.json({ error: roleRedirects[role] ?? "Invalid role" }, { status: 400 });
    }

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
