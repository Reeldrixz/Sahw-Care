import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateStage, countryCodeToFlag, countryNameToCode, extractCountryFromLocation } from "@/lib/stage";
import { sendNewSignupNotification } from "@/lib/email";
import { detectGeoFromRequest } from "@/lib/geoip";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    journeyType,   // "pregnant" | "postpartum" | "donor"
    gender,        // "male" | "female" | "unspecified" — required
    dueMonth,      // 1-12 (pregnant only)
    dueYear,       // full year e.g. 2025 (pregnant only)
    babyAgeMonths, // decimal months old (postpartum only)
    subTags,       // string[]
  } = await req.json();

  if (!["pregnant", "postpartum", "donor"].includes(journeyType)) {
    return NextResponse.json({ error: "Invalid journeyType" }, { status: 400 });
  }

  // Only update gender if explicitly provided (preserve existing value on journey-type switches)
  const safeGender = ["male", "female", "unspecified"].includes(gender) ? gender : undefined;

  // ── Donors skip stage assignment entirely ────────────────────────────────
  if (journeyType === "donor") {
    // Detect country from request IP (fire-and-forget — donor path is fast)
    detectGeoFromRequest(req).then((geo) => {
      if (!geo) return;
      return prisma.user.updateMany({
        where: { id: auth.userId, countryCode: null },
        data:  { countryCode: geo.countryCode, countryFlag: geo.countryFlag },
      });
    }).catch(() => {});

    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data:  { onboardingComplete: true, journeyType, ...(safeGender && { gender: safeGender }), subTags: subTags ?? [] },
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        avatar: true, location: true, isPremium: true,
        trustScore: true, verificationLevel: true, phoneVerified: true,
        emailVerified: true,
        docStatus: true, documentUrl: true, documentType: true, documentNote: true,
        verifiedAt: true, status: true, createdAt: true,
        onboardingComplete: true, journeyType: true, currentStage: true,
        countryFlag: true, subTags: true, currentCircleId: true,
        _count: { select: { items: true, requests: true } },
      },
    });
    fireSignupNotification(updated.name, journeyType, updated.createdAt);
    return NextResponse.json({ user: updated, circleId: null });
  }

  // ── Mother role is referral-only ─────────────────────────────────────────
  // The RECIPIENT (mother) role is granted ONLY through the referral/partner
  // path — never self-serve. If a user who is not already a RECIPIENT selects
  // pregnant/postpartum, do NOT promote them or run mother onboarding. Complete
  // a donor-role account and route them to the partner directory instead.
  const currentUser = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: { role: true },
  });

  if (currentUser?.role !== "RECIPIENT") {
    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data:  {
        onboardingComplete: true,
        journeyType: "donor",
        ...(safeGender && { gender: safeGender }),
        subTags: subTags ?? [],
      },
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        avatar: true, location: true, isPremium: true,
        trustScore: true, verificationLevel: true, phoneVerified: true,
        emailVerified: true,
        docStatus: true, documentUrl: true, documentType: true, documentNote: true,
        verifiedAt: true, status: true, createdAt: true,
        onboardingComplete: true, journeyType: true, currentStage: true,
        countryFlag: true, subTags: true, currentCircleId: true,
        _count: { select: { items: true, requests: true } },
      },
    });
    fireSignupNotification(updated.name, "donor", updated.createdAt);
    return NextResponse.json({
      user: updated,
      circleId: null,
      redirectTo: "/find-help?from=onboarding",
      motherRoleRequiresReferral: true,
    });
  }

  // ── Compute dueDate / babyBirthDate ─────────────────────────────────────
  // (Only reached by users who are already RECIPIENT — i.e. granted the mother
  // role through the referral/partner path. Their onboarding is unchanged.)
  let dueDate:       Date | null = null;
  let babyBirthDate: Date | null = null;

  if (journeyType === "pregnant") {
    if (!dueMonth || !dueYear) return NextResponse.json({ error: "dueMonth and dueYear required" }, { status: 400 });
    dueDate = new Date(dueYear, dueMonth - 1, 15);
  } else {
    if (babyAgeMonths === undefined || babyAgeMonths === null) {
      return NextResponse.json({ error: "babyAgeMonths required" }, { status: 400 });
    }
    const msAgo = babyAgeMonths * 30.44 * 24 * 60 * 60 * 1000;
    babyBirthDate = new Date(Date.now() - msAgo);
  }

  // ── Calculate stage ──────────────────────────────────────────────────────
  const stageKey = calculateStage(journeyType, dueDate, babyBirthDate);
  if (!stageKey) return NextResponse.json({ error: "Could not determine stage" }, { status: 400 });

  // ── Find cohort circle ───────────────────────────────────────────────────
  const circle = await prisma.circle.findUnique({ where: { stageKey } });
  if (!circle) return NextResponse.json({ error: "Cohort circle not found — run seed" }, { status: 500 });

  // ── Derive country code: try location first, fall back to request IP ─────
  const dbUser = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { location: true, countryCode: true, role: true },
  });

  let countryCode: string | null = dbUser?.countryCode ?? null;
  let countryFlag: string | null = countryCode ? countryCodeToFlag(countryCode) : null;

  if (!countryCode) {
    // Try to derive from stored location string
    const countryName  = extractCountryFromLocation(dbUser?.location ?? null);
    const codeFromLoc  = countryNameToCode(countryName);
    if (codeFromLoc) {
      countryCode = codeFromLoc;
      countryFlag = countryCodeToFlag(codeFromLoc);
    } else {
      // Last resort: IP-based detection
      const geo = await detectGeoFromRequest(req);
      if (geo) {
        countryCode = geo.countryCode;
        countryFlag = geo.countryFlag;
      }
    }
  }

  // ── Join cohort circle (upsert CircleMember) ────────────────────────────
  await prisma.circleMember.upsert({
    where: { userId_circleId: { userId: auth.userId, circleId: circle.id } },
    create: { userId: auth.userId, circleId: circle.id },
    update: {},
  });

  // ── Update user ──────────────────────────────────────────────────────────
  const updated = await prisma.user.update({
    where: { id: auth.userId },
    data: {
      onboardingComplete: true,
      journeyType,
      ...(safeGender && { gender: safeGender }),
      dueDate,
      babyBirthDate,
      currentStage: stageKey,
      currentCircleId: circle.id,
      subTags: subTags ?? [],
      ...(countryCode && { countryCode }),
      ...(countryFlag && { countryFlag }),
      // Role is intentionally NOT set here. This block is reached only by users
      // who are already RECIPIENT (granted via the referral/partner path); the
      // self-serve DONOR → RECIPIENT promotion has been removed.
      // The referral grant (src/lib/referral.ts `referralGrantFields`, applied
      // in api/auth/register, api/auth/google, and api/referral/redeem) is the
      // ONLY place that sets role=RECIPIENT. It sets onboardingComplete=false
      // and journeyType=null precisely so the newly-granted mother re-runs this
      // onboarding here (stage + cohort circle assignment).
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      avatar: true,
      location: true,
      isPremium: true,
      trustScore: true,
      verificationLevel: true,
      phoneVerified: true,
      emailVerified: true,
      docStatus: true,
      documentUrl: true,
      documentType: true,
      documentNote: true,
      verifiedAt: true,
      status: true,
      createdAt: true,
      onboardingComplete: true,
      journeyType: true,
      currentStage: true,
      countryFlag: true,
      subTags: true,
      currentCircleId: true,
      _count: { select: { items: true, requests: true } },
    },
  });

  fireSignupNotification(updated.name, journeyType, updated.createdAt);
  return NextResponse.json({ user: updated, circleId: circle.id });
}

// ── Fire-and-forget signup notification ─────────────────────────────────────
function fireSignupNotification(name: string, journeyType: string, createdAt: Date) {
  prisma.user.count({ where: { onboardingComplete: true } })
    .then((total) =>
      sendNewSignupNotification({
        firstName:   name.split(" ")[0],
        journeyType,
        signedUpAt:  createdAt,
        totalUsers:  total,
      })
    )
    .catch(() => {}); // never let notification errors affect the response
}
