import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { status, adminNote } = await req.json();

  const valid = ["PENDING", "APPROVED", "REJECTED", "WAITLISTED"];
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

  // Notify linked user
  if (application.userId && status === "APPROVED") {
    prisma.notification.create({
      data: {
        userId: application.userId,
        type: "BUNDLE_APPLICATION_APPROVED",
        message: `Great news! Your ${application.bundle.name} bundle application has been approved.`,
        link: "/bundles",
      },
    }).catch(() => {});
  } else if (application.userId && status === "REJECTED") {
    prisma.notification.create({
      data: {
        userId: application.userId,
        type: "BUNDLE_APPLICATION_REJECTED",
        message: `Unfortunately your ${application.bundle.name} bundle application was not approved this time. You may apply again next month.`,
        link: "/bundles",
      },
    }).catch(() => {});
  }

  return NextResponse.json({ application });
}
