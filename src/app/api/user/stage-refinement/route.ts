import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateStage } from "@/lib/stage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action, dueDate: dueDateStr, babyBirthDate: birthDateStr } = body as {
    action: "submit" | "dismiss" | "optout";
    dueDate?: string;
    babyBirthDate?: string;
  };

  if (action === "dismiss") {
    await prisma.user.update({
      where: { id: auth.userId },
      data:  { survey7DismissedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "optout") {
    await prisma.user.update({
      where: { id: auth.userId },
      data:  { survey7OptedOut: true },
    });
    return NextResponse.json({ ok: true });
  }

  if (action !== "submit") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: { journeyType: true, currentCircleId: true },
  });
  if (!user || !user.journeyType || user.journeyType === "donor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: Record<string, unknown> = { survey7Completed: true };

  if (user.journeyType === "pregnant" && dueDateStr) {
    const dueDate = new Date(dueDateStr);
    if (!isNaN(dueDate.getTime())) {
      updates.dueDate = dueDate;
      const newStage = calculateStage("pregnant", dueDate, null);
      if (newStage) updates.currentStage = newStage;
    }
  } else if (user.journeyType === "postpartum" && birthDateStr) {
    const babyBirthDate = new Date(birthDateStr);
    if (!isNaN(babyBirthDate.getTime())) {
      updates.babyBirthDate = babyBirthDate;
      const newStage = calculateStage("postpartum", null, babyBirthDate);
      if (newStage) updates.currentStage = newStage;
    }
  } else {
    return NextResponse.json({ error: "Missing date" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: auth.userId }, data: updates });
  return NextResponse.json({ ok: true });
}
