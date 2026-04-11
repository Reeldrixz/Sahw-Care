import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateStage, countryCodeToFlag, countryNameToCode, extractCountryFromLocation } from "@/lib/stage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    journeyType,   // "pregnant" | "postpartum"
    dueMonth,      // 1-12 (pregnant only)
    dueYear,       // full year e.g. 2025 (pregnant only)
    babyAgeMonths, // decimal months old (postpartum only)
    subTags,       // string[]
  } = await req.json();

  if (!["pregnant", "postpartum", "donor"].includes(journeyType)) {
    return NextResponse.json({ error: "Invalid journeyType" }, { status: 400 });
  }

  // ── Donors skip stage assignment entirely ────────────────────────────────
  if (journeyType === "donor") {
    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data:  { onboardingComplete: true, journeyType, subTags: subTags ?? [] },
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        avatar: true, location: true, isPremium: true, trustRating: true,
        trustScore: true, verificationLevel: true, phoneVerified: true,
        emailVerified: true, urgentOverridesUsed: true, urgentOverridesResetAt: true,
        docStatus: true, documentUrl: true, documentType: true, documentNote: true,
        verifiedAt: true, status: true, createdAt: true,
        onboardingComplete: true, journeyType: true, currentStage: true,
        countryFlag: true, subTags: true, currentCircleId: true,
        _count: { select: { items: true, requests: true } },
      },
    });
    return NextResponse.json({ user: updated, circleId: null });
  }

  // ── Compute dueDate / babyBirthDate ─────────────────────────────────────
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

  // ── Derive country flag from existing location ───────────────────────────
  const dbUser = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { location: true },
  });
  const countryName = extractCountryFromLocation(dbUser?.location ?? null);
  const countryCode = countryNameToCode(countryName);
  const countryFlag = countryCode ? countryCodeToFlag(countryCode) : null;

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
      dueDate,
      babyBirthDate,
      currentStage: stageKey,
      currentCircleId: circle.id,
      subTags: subTags ?? [],
      ...(countryCode && { countryCode }),
      ...(countryFlag && { countryFlag }),
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
      trustRating: true,
      trustScore: true,
      verificationLevel: true,
      phoneVerified: true,
      emailVerified: true,
      urgentOverridesUsed: true,
      urgentOverridesResetAt: true,
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

  return NextResponse.json({ user: updated, circleId: circle.id });
}
