import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getResend } from "@/lib/resend";
import { monthlyCooldown, formatCooldownDate } from "@/lib/cooldowns";

export const dynamic = "force-dynamic";

async function sendBundleEmail(to: string, subject: string, fullName: string, body: string) {
  const { error } = await getResend().emails.send({
    from:    process.env.RESEND_FROM_EMAIL ?? "noreply@kradel.care",
    to,
    subject,
    html:    `<p>Hi ${fullName},</p><p>${body}</p><p>The Kradel Team</p>`,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { status, adminNote } = await req.json();

  // RELEASED = admin releases an APPROVED application that can't be delivered.
  // EXPIRED (cron) and CANCELLED (mother self-withdraw) are set elsewhere, not
  // via this manual admin endpoint.
  const valid = ["PENDING", "APPROVED", "REJECTED", "WAITLISTED", "DELIVERED", "RELEASED"];
  if (status && !valid.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Releasing requires a reason (item unavailable, mother unreachable, …).
  if (status === "RELEASED" && !(typeof adminNote === "string" && adminNote.trim())) {
    return NextResponse.json({ error: "A reason is required to release an approved application." }, { status: 400 });
  }

  // Belt-and-suspenders monthly cooldown: don't let an admin approve a second
  // bundle for the same mother within a month of a prior approval/receipt.
  // Keyed off reviewedAt of another APPROVED/DELIVERED row (this row excluded).
  if (status === "APPROVED") {
    const target = await prisma.bundleApplication.findUnique({
      where:  { id },
      select: { userId: true },
    });
    if (target?.userId) {
      const priorApproved = await prisma.bundleApplication.findFirst({
        where:   { userId: target.userId, status: { in: ["APPROVED", "DELIVERED"] }, id: { not: id } },
        orderBy: { reviewedAt: "desc" },
        select:  { reviewedAt: true },
      });
      const cd = monthlyCooldown(priorApproved?.reviewedAt ?? null);
      if (cd.active && cd.lastApprovedAt && cd.nextEligibleAt) {
        return NextResponse.json({
          error: `This mother received a bundle on ${formatCooldownDate(cd.lastApprovedAt)}. Bundles are spaced to one per month, so she is next eligible from ${formatCooldownDate(cd.nextEligibleAt)}.`,
          code:  "BUNDLE_MONTHLY_COOLDOWN",
        }, { status: 409 });
      }
    }
  }

  const application = await prisma.bundleApplication.update({
    where: { id },
    data: {
      ...(status && {
        status,
        reviewedAt: new Date(),
        reviewedBy: admin.userId,
      }),
      // Stamp the delivery time so the mother's "X of 12 received" counter and
      // the admin "Delivered" date are backed by a real timestamp.
      ...(status === "DELIVERED" && { deliveredAt: new Date() }),
      ...(adminNote !== undefined && { adminNote }),
    },
    include: {
      bundle: { select: { name: true } },
    },
  });

  const { fullName, email, userId, bundle, adminNote: note } = application;
  const bundleName = bundle.name;

  if (status === "APPROVED") {
    if (userId) {
      prisma.notification.create({
        data: {
          userId,
          type:    "BUNDLE_APPLICATION_APPROVED",
          message: `Great news! Your ${bundleName} bundle application has been approved.`,
          link:    "/bundles",
        },
      }).catch(() => {});
    } else if (email) {
      sendBundleEmail(
        email,
        "Your Kradel Bundle has been approved",
        fullName,
        `Your application for <strong>${bundleName}</strong> has been approved. We'll prepare and ship your bundle shortly.`
      ).catch((err) => console.error("[bundle email]", err));
    }
  } else if (status === "REJECTED") {
    const reasonClause = note ? `${note} ` : "";
    if (userId) {
      prisma.notification.create({
        data: {
          userId,
          type:    "BUNDLE_APPLICATION_REJECTED",
          message: `Unfortunately your ${bundleName} bundle application was not approved this time. You may apply again next month.`,
          link:    "/bundles",
        },
      }).catch(() => {});
    } else if (email) {
      sendBundleEmail(
        email,
        "Update on your Kradel Bundle application",
        fullName,
        `Your application for <strong>${bundleName}</strong> was not approved this month. ${reasonClause}You're welcome to apply again next month.`
      ).catch((err) => console.error("[bundle email]", err));
    }
  } else if (status === "WAITLISTED") {
    if (userId) {
      prisma.notification.create({
        data: {
          userId,
          type:    "BUNDLE_UPDATE",
          message: `Your ${bundleName} application has been added to the waitlist. We'll notify you when a slot opens.`,
          link:    "/bundles",
        },
      }).catch(() => {});
    } else if (email) {
      sendBundleEmail(
        email,
        "You're on the Kradel Bundle waitlist",
        fullName,
        `Your application for <strong>${bundleName}</strong> is on the waitlist. We'll be in touch when a slot becomes available.`
      ).catch((err) => console.error("[bundle email]", err));
    }
  } else if (status === "DELIVERED") {
    if (userId) {
      prisma.notification.create({
        data: {
          userId,
          type:    "BUNDLE_DELIVERED",
          message: `Your ${bundleName} has been delivered. We hope it helps.`,
          link:    "/bundles",
        },
      }).catch(() => {});
    } else if (email) {
      sendBundleEmail(
        email,
        "Your Kradel Bundle has been delivered",
        fullName,
        `Your <strong>${bundleName}</strong> has been delivered. We hope it helps.`
      ).catch((err) => console.error("[bundle email]", err));
    }
  } else if (status === "RELEASED") {
    if (userId) {
      prisma.notification.create({
        data: {
          userId,
          type:    "BUNDLE_UPDATE",
          message: `We're very sorry. We weren't able to complete your ${bundleName} this time. This doesn't count against you in any way, and you're welcome to apply again whenever you're ready.`,
          link:    "/bundles",
        },
      }).catch(() => {});
    } else if (email) {
      sendBundleEmail(
        email,
        "An update on your Kradel Bundle",
        fullName,
        `We're very sorry. We weren't able to complete your <strong>${bundleName}</strong> this time. This doesn't count against you in any way, and you're welcome to apply again whenever you're ready.`
      ).catch((err) => console.error("[bundle email]", err));
    }
  }

  return NextResponse.json({ application });
}
