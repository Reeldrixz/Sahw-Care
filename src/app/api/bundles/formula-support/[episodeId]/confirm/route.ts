import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getResend } from "@/lib/resend";
import { addOneMonth } from "@/lib/cooldowns";

export const dynamic = "force-dynamic";

// D/F3c: the mother confirms the exact product is right for her baby. This
// activates the 6-month episode and creates the 6 monthly deliveries (month 1
// DUE, 2-6 SCHEDULED), anchored to the moment she confirms. Atomic: activation
// and delivery creation succeed or fail together.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const currentUser = await getCurrentUser().catch(() => null);
  if (!currentUser) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { episodeId } = await params;
  const episode = await prisma.formulaEpisode.findUnique({
    where:  { id: episodeId },
    select: { id: true, userId: true, status: true, confirmationDeadline: true, monthsTotal: true, formulaStage: true },
  });

  if (!episode || episode.userId !== currentUser.userId) {
    return NextResponse.json({ error: "Formula episode not found" }, { status: 404 });
  }
  if (episode.status !== "AWAITING_CONFIRMATION") {
    return NextResponse.json({ error: "This formula support has already been confirmed or closed." }, { status: 409 });
  }
  // Belt-and-suspenders: the D/F3d cron normally ends an expired window first.
  if (episode.confirmationDeadline && episode.confirmationDeadline.getTime() < Date.now()) {
    return NextResponse.json({ error: "The confirmation window has passed. Please reach out and we'll set you up again.", code: "WINDOW_ELAPSED" }, { status: 409 });
  }

  const now    = new Date();
  const months = episode.monthsTotal ?? 6;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.formulaEpisode.update({
        where: { id: episode.id },
        data:  { status: "ACTIVE", confirmedAt: now },
      });

      // Anchor the 6 monthly dates to confirmedAt. Month 1 is DUE now; 2-6 are
      // SCHEDULED. formulaStageAtFulfilment starts as the confirmed stage.
      let scheduledFor = now;
      const deliveries = [];
      for (let monthIndex = 1; monthIndex <= months; monthIndex++) {
        deliveries.push({
          episodeId:    episode.id,
          monthIndex,
          status:       (monthIndex === 1 ? "DUE" : "SCHEDULED") as "DUE" | "SCHEDULED",
          scheduledFor,
        });
        scheduledFor = addOneMonth(scheduledFor);
      }
      await tx.formulaDelivery.createMany({ data: deliveries });
    });
  } catch (e) {
    console.error("[formula confirm]", e);
    return NextResponse.json({ error: "Could not confirm. Please try again." }, { status: 500 });
  }

  // Notify all admins to fulfil month 1 (best-effort, outside the txn).
  prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } }).then((admins) => {
    if (admins.length === 0) return;
    return prisma.notification.createMany({
      data: admins.map((a) => ({
        userId:  a.id,
        type:    "ADMIN_MESSAGE" as const,
        title:   "Formula confirmed",
        message: `${currentUser.name ?? "A mother"} confirmed her formula. Please fulfil month 1 of ${months}.`,
        link:    "/admin",
      })),
    });
  }).catch(() => {});

  // Warm success to the mother: in-app always, email when present.
  const mother = await prisma.user.findUnique({ where: { id: currentUser.userId }, select: { name: true, email: true } });
  prisma.notification.create({
    data: {
      userId:  currentUser.userId,
      type:    "BUNDLE_UPDATE",
      message: "Thank you. Your formula support is now active. We're preparing your first month now. We aim for every month, though occasionally one may be delayed, and you won't need to reapply.",
      link:    "/bundles/formula-support",
    },
  }).catch(() => {});
  if (mother?.email) {
    getResend().emails.send({
      from:    process.env.RESEND_FROM_EMAIL ?? "noreply@kradel.care",
      to:      mother.email,
      subject: "Your Kradel formula support is active",
      html:    `<p>Hi ${mother.name},</p><p>Thank you. Your formula support is now active. We're preparing your first month now. We aim for every month, though occasionally one may be delayed, and you won't need to reapply.</p><p>The Kradel Team</p>`,
    }).catch((err) => console.error("[formula confirm email]", err));
  }

  return NextResponse.json({ ok: true });
}
