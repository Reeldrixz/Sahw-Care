import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const {
    bundleId, fullName, phone, city, province,
    dueDate, babyDob, story,
    streetAddress, unit, postalCode,
  } = body;

  if (!bundleId || !fullName || !phone || !city || !province || !story || !streetAddress || !postalCode) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const bundle = await prisma.bundle.findUnique({ where: { id: bundleId } });
  if (!bundle || !bundle.isActive) {
    return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
  }

  // Check slot availability for current month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const used = await prisma.bundleApplication.count({
    where: {
      bundleId,
      status: { in: ["PENDING", "APPROVED"] },
      createdAt: { gte: monthStart, lt: monthEnd },
    },
  });

  if (used >= bundle.slotsPerMonth) {
    return NextResponse.json({ error: "No slots available this month" }, { status: 409 });
  }

  // Optional: link to logged-in user
  const currentUser = await getCurrentUser().catch(() => null);

  const application = await prisma.bundleApplication.create({
    data: {
      bundleId,
      fullName: fullName.trim(),
      phone: phone.trim(),
      city: city.trim(),
      province: province.trim(),
      dueDate: dueDate ? new Date(dueDate) : null,
      babyDob: babyDob ? new Date(babyDob) : null,
      story: story.trim(),
      streetAddress: streetAddress.trim(),
      unit: unit?.trim() || null,
      postalCode: postalCode.trim(),
      userId: currentUser?.userId ?? null,
    },
  });

  // Notify linked user if logged in
  if (currentUser) {
    prisma.notification.create({
      data: {
        userId: currentUser.userId,
        type: "BUNDLE_UPDATE",
        message: `Your application for the ${bundle.name} bundle has been received. We'll be in touch soon!`,
        link: "/bundles",
      },
    }).catch(() => {});
  }

  return NextResponse.json({ applicationId: application.id }, { status: 201 });
}
