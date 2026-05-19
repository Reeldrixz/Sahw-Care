import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeTransition } from "@/lib/stage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mothers = await prisma.user.findMany({
    where: {
      onboardingComplete: true,
      journeyType:        { in: ["pregnant", "postpartum"] },
      currentStage:       { not: null },
    },
    select: {
      id:                  true,
      currentStage:        true,
      dueDate:             true,
      babyBirthDate:       true,
      currentCircleId:     true,
      notified30DaysStage: true,
    },
  });

  let sent = 0;

  await Promise.all(mothers.map(async (u) => {
    const { daysUntil, nextStageKey } = computeTransition(u.currentStage, u.dueDate, u.babyBirthDate);
    if (daysUntil === null || nextStageKey === null) return;
    if (daysUntil > 30 || daysUntil < 0) return;
    if (u.notified30DaysStage === u.currentStage) return;

    await prisma.notification.create({
      data: {
        userId:  u.id,
        type:    "CIRCLE_MILESTONE",
        message: "Your new Circle stage is coming soon. Tap to learn more.",
        link:    u.currentCircleId ? `/circles/${u.currentCircleId}` : "/circles",
      },
    });

    await prisma.user.update({
      where: { id: u.id },
      data:  { notified30DaysStage: u.currentStage },
    });

    sent++;
  }));

  return NextResponse.json({ ok: true, sent });
}
