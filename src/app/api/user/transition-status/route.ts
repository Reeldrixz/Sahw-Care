import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeTransition, STAGE_META, StageKey } from "@/lib/stage";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { circleId } = await req.json().catch(() => ({} as { circleId?: string }));
  if (!circleId) return NextResponse.json({ error: "circleId required" }, { status: 400 });

  await prisma.circleMember.updateMany({
    where: { userId: auth.userId, circleId },
    data:  { hasSeenStageTransition: true },
  });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: {
      journeyType:        true,
      dueDate:            true,
      babyBirthDate:      true,
      currentStage:       true,
      currentCircleId:    true,
      createdAt:          true,
      survey7Completed:   true,
      survey7DismissedAt: true,
      survey7OptedOut:    true,
      onboardingComplete: true,
    },
  });

  if (!user || !user.onboardingComplete || !user.journeyType || user.journeyType === "donor") {
    return NextResponse.json({ applicable: false });
  }

  const { daysUntil, transitionDate, nextStageKey } = computeTransition(
    user.currentStage,
    user.dueDate,
    user.babyBirthDate,
  );

  // Survey banner: show if day 7+ since signup, not completed, not opted out
  const daysSinceSignup = (Date.now() - new Date(user.createdAt).getTime()) / 86_400_000;
  const dismissedRecently = user.survey7DismissedAt
    ? (Date.now() - new Date(user.survey7DismissedAt).getTime()) / 86_400_000 < 3
    : false;
  const showSurveyBanner = daysSinceSignup >= 7
    && !user.survey7Completed
    && !user.survey7OptedOut
    && !dismissedRecently;

  // Transition modal dismissed: check CircleMember.hasSeenStageTransition
  let hasSeenTransitionModal = true;
  if (user.currentCircleId) {
    const membership = await prisma.circleMember.findUnique({
      where:  { userId_circleId: { userId: auth.userId, circleId: user.currentCircleId } },
      select: { hasSeenStageTransition: true },
    });
    hasSeenTransitionModal = membership?.hasSeenStageTransition ?? true;
  }

  const currentStageMeta = user.currentStage ? STAGE_META[user.currentStage as StageKey] : null;
  const nextStageMeta     = nextStageKey      ? STAGE_META[nextStageKey]                  : null;

  return NextResponse.json({
    applicable:             true,
    currentStageKey:        user.currentStage,
    currentStageName:       currentStageMeta?.label    ?? null,
    currentStageDesc:       currentStageMeta?.description ?? null,
    daysUntil,
    transitionDate:         transitionDate?.toISOString() ?? null,
    nextStageKey,
    nextStageName:          nextStageMeta?.label        ?? null,
    nextStageDesc:          nextStageMeta?.description  ?? null,
    showSurveyBanner,
    surveyCompleted:        user.survey7Completed,
    surveyOptedOut:         user.survey7OptedOut,
    hasSeenTransitionModal,
    journeyType:            user.journeyType,
  });
}
