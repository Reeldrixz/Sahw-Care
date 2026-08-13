import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getResend } from "@/lib/resend";
import { isAuthorizedCron } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";

// Piece B: a PENDING bundle application the team hasn't reviewed within 90 days
// auto-expires. She may reapply, and her reapplication is prioritised (the admin
// queue surfaces prior expiries). APPROVED is never swept — that means "we are
// delivering it"; a stuck APPROVED is released manually by an admin instead.
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now     = new Date();
  const cutoff  = new Date(now.getTime() - NINETY_DAYS_MS);

  const stale = await prisma.bundleApplication.findMany({
    where:  { status: "PENDING", createdAt: { lt: cutoff } },
    select: { id: true, fullName: true, userId: true, email: true, bundle: { select: { name: true } } },
    take:   200,
  });

  let expired = 0;
  let emailFailures = 0;

  for (const app of stale) {
    await prisma.bundleApplication.update({
      where: { id: app.id },
      data:  { status: "EXPIRED" },
    });
    expired++;

    const bundleName = app.bundle.name;

    if (app.userId) {
      // Linked account — warm in-app notification.
      await prisma.notification.create({
        data: {
          userId:  app.userId,
          type:    "BUNDLE_UPDATE",
          message: `Your application for the ${bundleName} has closed, as we weren't able to review it in time. We're sorry for the wait. You're very welcome to apply again, and because you waited, we'll give your new application priority.`,
          link:    "/bundles",
        },
      }).catch(() => {});
    } else if (app.email) {
      // Account-less applicant — email if we have one, otherwise expire silently.
      try {
        const { error } = await getResend().emails.send({
          from:    process.env.RESEND_FROM_EMAIL ?? "noreply@kradel.care",
          to:      app.email,
          subject: "Your Kradel bundle application",
          html:    `<p>Hi ${app.fullName},</p><p>We weren't able to review your application for the <strong>${bundleName}</strong> in time, so it has now closed. We're sorry for the wait. You're very welcome to apply again, and because you waited before, we'll give your new application priority.</p><p>The Kradel Team</p>`,
        });
        if (error) throw new Error(error.message);
      } catch (err) {
        console.error(`[bundle-pending-expiry] email failed for application ${app.id}:`, err);
        emailFailures++;
      }
    }
  }

  return NextResponse.json({ ok: true, expired, emailFailures, timestamp: now.toISOString() });
}
export { POST as GET };
