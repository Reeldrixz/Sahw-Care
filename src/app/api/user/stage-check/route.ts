import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateStage, STAGE_META, StageKey } from "@/lib/stage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
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
      graduatedCircleIds: true,
      onboardingComplete: true,
    },
  });

  if (!user || !user.onboardingComplete || !user.journeyType || user.journeyType === "donor") {
    return NextResponse.json({ changed: false });
  }

  const newStageKey = calculateStage(
    user.journeyType as "pregnant" | "postpartum",
    user.dueDate,
    user.babyBirthDate,
  );

  if (!newStageKey) return NextResponse.json({ changed: false });

  // ── Already at postpartum-13-24 permanently ──────────────────────────────
  if (newStageKey === "postpartum-13-24" && user.currentStage === "postpartum-13-24") {
    await prisma.user.update({
      where: { id: auth.userId },
      data:  { lastStageCheck: new Date() },
    });
    return NextResponse.json({ changed: false, toddler: true });
  }

  if (newStageKey === user.currentStage) {
    await prisma.user.update({
      where: { id: auth.userId },
      data:  { lastStageCheck: new Date() },
    });
    return NextResponse.json({ changed: false });
  }

  // ── Stage has changed — full graduation event ────────────────────────────

  const newCircle = await prisma.circle.findUnique({
    where: { stageKey: newStageKey },
    include: { channels: { select: { id: true } } },
  });
  if (!newCircle) return NextResponse.json({ changed: false });

  // 1. Mark old membership as graduated + downgrade to READ_COMMENT
  if (user.currentCircleId) {
    await prisma.circleMember.updateMany({
      where: { userId: auth.userId, circleId: user.currentCircleId },
      data:  { accessType: "READ_COMMENT", isGraduated: true },
    });
  }

  // 2. Upsert new circle membership with FULL access
  await prisma.circleMember.upsert({
    where:  { userId_circleId: { userId: auth.userId, circleId: newCircle.id } },
    create: { userId: auth.userId, circleId: newCircle.id, accessType: "FULL", isGraduated: false },
    update: { accessType: "FULL", isGraduated: false },
  });

  // 3. Build updated graduatedCircleIds (skip duplicates, skip new circle)
  const graduated = [
    ...new Set([
      ...(user.graduatedCircleIds ?? []),
      ...(user.currentCircleId && user.currentCircleId !== newCircle.id
        ? [user.currentCircleId]
        : []),
    ]),
  ].filter((id) => id !== newCircle.id);

  // 4. Update user record
  await prisma.user.update({
    where: { id: auth.userId },
    data:  {
      currentStage:       newStageKey,
      currentCircleId:    newCircle.id,
      graduatedCircleIds: graduated,
      lastStageCheck:     new Date(),
    },
  });

  const meta = STAGE_META[newStageKey as StageKey];
  const newStageName = meta ? `${meta.emoji} ${meta.label}` : newStageKey;

  const isToddler = newStageKey === "postpartum-13-24";

  return NextResponse.json({
    changed:      true,
    newStageKey,
    newStageName,
    circleId:     newCircle.id,
    toddler:      isToddler,
    message:      isToddler
      ? "You're in the Toddler stage — our most experienced moms! 🧸"
      : `Your circle has updated! Welcome to ${newStageName} 🎉 Your journey continues…`,
  });
}
