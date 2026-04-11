import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateStage, STAGE_META } from "@/lib/stage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: { journeyType: true, dueDate: true, babyBirthDate: true, currentStage: true, currentCircleId: true, onboardingComplete: true },
  });

  if (!user || !user.onboardingComplete || !user.journeyType) {
    return NextResponse.json({ changed: false });
  }

  const newStageKey = calculateStage(
    user.journeyType as "pregnant" | "postpartum",
    user.dueDate,
    user.babyBirthDate,
  );

  if (!newStageKey || newStageKey === user.currentStage) {
    return NextResponse.json({ changed: false });
  }

  // Stage has changed — find new circle
  const newCircle = await prisma.circle.findUnique({ where: { stageKey: newStageKey } });
  if (!newCircle) return NextResponse.json({ changed: false });

  // Join new circle
  await prisma.circleMember.upsert({
    where: { userId_circleId: { userId: auth.userId, circleId: newCircle.id } },
    create: { userId: auth.userId, circleId: newCircle.id },
    update: {},
  });

  // Build updated graduatedCircleIds
  const currentUser = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: { graduatedCircleIds: true },
  });
  const graduated = [
    ...new Set([...(currentUser?.graduatedCircleIds ?? []), ...(user.currentCircleId ? [user.currentCircleId] : [])]),
  ];

  await prisma.user.update({
    where: { id: auth.userId },
    data:  { currentStage: newStageKey, currentCircleId: newCircle.id, graduatedCircleIds: graduated },
  });

  const meta = STAGE_META[newStageKey];
  return NextResponse.json({
    changed:      true,
    newStageKey,
    newStageName: `${meta.emoji} ${meta.label}`,
    circleId:     newCircle.id,
  });
}
