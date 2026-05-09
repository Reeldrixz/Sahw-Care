import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getResend } from "@/lib/resend";

export const dynamic = "force-dynamic";

async function sendBundleEmail(to: string, subject: string, fullName: string, body: string) {
  return getResend().emails.send({
    from:    process.env.EMAIL_FROM ?? "noreply@kradel.ca",
    to,
    subject,
    html:    `<p>Hi ${fullName},</p><p>${body}</p><p>The Kradəl Team</p>`,
  }).catch(() => {});
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { status, adminNote } = await req.json();

  const valid = ["PENDING", "APPROVED", "REJECTED", "WAITLISTED", "DELIVERED"];
  if (status && !valid.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const application = await prisma.bundleApplication.update({
    where: { id },
    data: {
      ...(status && {
        status,
        reviewedAt: new Date(),
        reviewedBy: user.userId,
      }),
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
        "Your Kradəl Bundle has been approved",
        fullName,
        `Your application for <strong>${bundleName}</strong> has been approved. We'll prepare and ship your bundle shortly.`
      );
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
        "Update on your Kradəl Bundle application",
        fullName,
        `Your application for <strong>${bundleName}</strong> was not approved this month. ${reasonClause}You're welcome to apply again next month.`
      );
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
        "You're on the Kradəl Bundle waitlist",
        fullName,
        `Your application for <strong>${bundleName}</strong> is on the waitlist. We'll be in touch when a slot becomes available.`
      );
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
        "Your Kradəl Bundle has been delivered",
        fullName,
        `Your <strong>${bundleName}</strong> has been delivered. We hope it helps.`
      );
    }
  }

  return NextResponse.json({ application });
}
