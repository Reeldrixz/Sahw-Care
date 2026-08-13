import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canApplyForBundle } from "@/lib/access";
import { monthlyCooldown, formatCooldownDate } from "@/lib/cooldowns";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const {
    bundleId, fullName, phone, email, city, province,
    dueDate, babyDob, story,
    streetAddress, unit, postalCode,
    disclaimerAcknowledged,
  } = body;

  if (!bundleId || !fullName || !phone || !city || !province || !story || !streetAddress || !postalCode) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Safety acknowledgment is required before an application can be submitted.
  if (!disclaimerAcknowledged) {
    return NextResponse.json({ error: "Please confirm the healthcare provider acknowledgment before submitting." }, { status: 400 });
  }

  // Auth + role guard — must be a logged-in RECIPIENT
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) {
    return NextResponse.json({ error: "Only verified mothers can apply for bundles" }, { status: 403 });
  }

  const applicant = await prisma.user.findUnique({
    where:  { id: currentUser.userId },
    select: { role: true, identityVerified: true, manualReviewStatus: true, accountHold: true },
  });

  if (applicant?.role !== "RECIPIENT") {
    return NextResponse.json({ error: "Only verified mothers can apply for bundles" }, { status: 403 });
  }

  const bundle = await prisma.bundle.findUnique({ where: { id: bundleId } });
  if (!bundle || !bundle.isActive) {
    return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
  }

  const bundleAccess = canApplyForBundle(applicant);
  if (!bundleAccess.allowed) {
    return NextResponse.json({
      error: bundleAccess.message,
      code:  bundleAccess.code,
    }, { status: 403 });
  }

  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // 12-bundle lifetime cap. Only DELIVERED bundles permanently consume one of
  // the twelve, but the cap is enforced against DELIVERED + in-flight APPROVED
  // (approved, not yet delivered) so deliveries lagging behind approvals can
  // never overshoot 12. An approved application that later expires without
  // delivering (Piece B) releases its in-flight reservation.
  const lifetimeCount = await prisma.bundleApplication.count({
    where: { userId: currentUser.userId, status: { in: ["APPROVED", "DELIVERED"] } },
  });
  if (lifetimeCount >= 12) {
    return NextResponse.json({
      error: "You've received all 12 Kradel bundles — the full programme. Thank you for letting us support your journey.",
    }, { status: 400 });
  }

  // Monthly receipt cooldown: one bundle per month, keyed off the last approval
  // /receipt (reviewedAt of an APPROVED/DELIVERED row), independent of formula.
  const lastApprovedBundle = await prisma.bundleApplication.findFirst({
    where:   { userId: currentUser.userId, status: { in: ["APPROVED", "DELIVERED"] } },
    orderBy: { reviewedAt: "desc" },
    select:  { reviewedAt: true },
  });
  const bundleCooldown = monthlyCooldown(lastApprovedBundle?.reviewedAt ?? null);
  if (bundleCooldown.active && bundleCooldown.lastApprovedAt && bundleCooldown.nextEligibleAt) {
    return NextResponse.json({
      error: `You received a bundle on ${formatCooldownDate(bundleCooldown.lastApprovedAt)}. So support can reach as many mothers as possible, each mother receives one bundle a month. You're welcome to apply again from ${formatCooldownDate(bundleCooldown.nextEligibleAt)}.`,
      code:  "BUNDLE_MONTHLY_COOLDOWN",
    }, { status: 409 });
  }

  // One open application at a time: any PENDING or APPROVED application blocks
  // a new one (no calendar-month window). She frees herself by withdrawing a
  // PENDING, or it auto-expires after 90 days; an APPROVED clears when it is
  // delivered or released.
  const existing = await prisma.bundleApplication.findFirst({
    where: {
      userId: currentUser.userId,
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({
      error: "You have an open application under review. You can withdraw it below if you'd like to apply for a different bundle, or wait for a decision.",
    }, { status: 409 });
  }

  // Check slot availability for current month
  const used = await prisma.bundleApplication.count({
    where: {
      bundleId,
      status:    { in: ["PENDING", "APPROVED"] },
      createdAt: { gte: monthStart, lt: monthEnd },
    },
  });
  if (used >= bundle.slotsPerMonth) {
    return NextResponse.json({ error: "No spaces available this month" }, { status: 409 });
  }

  const application = await prisma.bundleApplication.create({
    data: {
      bundleId,
      fullName:      fullName.trim(),
      phone:         phone.trim(),
      email:         email?.trim() || null,
      city:          city.trim(),
      province:      province.trim(),
      dueDate:       dueDate ? new Date(dueDate) : null,
      babyDob:       babyDob ? new Date(babyDob) : null,
      story:         story.trim(),
      streetAddress: streetAddress.trim(),
      unit:          unit?.trim() || null,
      postalCode:    postalCode.trim(),
      userId:        currentUser.userId,
      disclaimerAcknowledgedAt: new Date(),
    },
  });

  prisma.notification.create({
    data: {
      userId:  currentUser.userId,
      type:    "BUNDLE_UPDATE",
      message: `Your application for the ${bundle.name} has been received. Our team will review it privately and be in touch soon.`,
      link:    "/bundles",
    },
  }).catch(() => {});

  return NextResponse.json({ applicationId: application.id }, { status: 201 });
}
