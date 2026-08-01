import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { monthlyCooldown, formatCooldownDate } from "@/lib/cooldowns";

export const dynamic = "force-dynamic";

// BETA-safe formula support request intake. This creates a PENDING request for
// a human to review in admin. It NEVER approves, entitles, or fulfils anything.
export async function POST(req: NextRequest) {
  // Auth: must be a logged-in RECIPIENT (verified mother). Not public.
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) {
    return NextResponse.json({ error: "Only verified mothers can request formula support." }, { status: 403 });
  }

  const applicant = await prisma.user.findUnique({
    where:  { id: currentUser.userId },
    select: { role: true },
  });
  if (applicant?.role !== "RECIPIENT") {
    return NextResponse.json({ error: "Only verified mothers can request formula support." }, { status: 403 });
  }

  // Monthly receipt cooldown on its OWN clock, independent of bundles: keyed off
  // the last APPROVED formula request (reviewedAt). Pending/declined never count.
  const lastApprovedFormula = await prisma.formulaRequest.findFirst({
    where:   { userId: currentUser.userId, status: "APPROVED" },
    orderBy: { reviewedAt: "desc" },
    select:  { reviewedAt: true },
  });
  const formulaCooldown = monthlyCooldown(lastApprovedFormula?.reviewedAt ?? null);
  if (formulaCooldown.active && formulaCooldown.lastApprovedAt && formulaCooldown.nextEligibleAt) {
    return NextResponse.json({
      error: `Your last formula support was approved on ${formatCooldownDate(formulaCooldown.lastApprovedAt)}. To help us support as many babies as possible, formula is provided about a month at a time, so you can request again from ${formatCooldownDate(formulaCooldown.nextEligibleAt)}.`,
      code:  "FORMULA_MONTHLY_COOLDOWN",
    }, { status: 409 });
  }

  // Rate limit per account: a few requests per day is plenty for a genuine need.
  const rl = rateLimit(`formula-request:${currentUser.userId}`, 3, 24 * 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "You've submitted a few requests recently. Please give us time to review, and reach out again later." },
      { status: 429 }
    );
  }
  // Secondary IP guard against automated abuse.
  const ipRl = rateLimit(`formula-request-ip:${getClientIp(req)}`, 10, 24 * 60 * 60 * 1000);
  if (!ipRl.ok) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    formulaBrand, formulaType, formulaStage,
    babyDob, note,
    confirmedFormulaFed, breastfeedingResourcesRequested,
  } = body;

  const brand = typeof formulaBrand === "string" ? formulaBrand.trim() : "";
  const type  = typeof formulaType  === "string" ? formulaType.trim()  : "";
  const stage = typeof formulaStage === "string" ? formulaStage.trim() : "";

  if (!brand || !type || !stage) {
    return NextResponse.json({ error: "Please tell us your baby's formula brand, type, and stage." }, { status: 400 });
  }

  // The safety confirmation is required.
  if (confirmedFormulaFed !== true) {
    return NextResponse.json({ error: "Please confirm this is for a formula-fed infant currently in your care." }, { status: 400 });
  }

  // Baby DOB: required, must be a real date, not in the future.
  const dob = babyDob ? new Date(babyDob) : null;
  if (!dob || Number.isNaN(dob.getTime())) {
    return NextResponse.json({ error: "Please enter your baby's date of birth." }, { status: 400 });
  }
  if (dob.getTime() > Date.now()) {
    return NextResponse.json({ error: "Your baby's date of birth cannot be in the future." }, { status: 400 });
  }

  const request = await prisma.formulaRequest.create({
    data: {
      userId:       currentUser.userId,
      formulaBrand: brand,
      formulaType:  type,
      formulaStage: stage,
      babyDob:      dob,
      note:         typeof note === "string" && note.trim() ? note.trim() : null,
      confirmedFormulaFedAt: new Date(),
      breastfeedingResourcesRequested: breastfeedingResourcesRequested === true,
    },
  });

  prisma.notification.create({
    data: {
      userId:  currentUser.userId,
      type:    "BUNDLE_UPDATE",
      message: "Your formula support request has been received. Our team will review it individually and follow up with you.",
      link:    "/bundles",
    },
  }).catch(() => {});

  return NextResponse.json({ requestId: request.id }, { status: 201 });
}
