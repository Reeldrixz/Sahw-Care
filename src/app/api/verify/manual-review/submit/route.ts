import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: {
      id: true, phoneVerified: true, emailVerified: true,
      avatar: true, manualReviewStatus: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (user.manualReviewStatus === "APPROVED") {
    return NextResponse.json({ error: "Your profile is already verified." }, { status: 400 });
  }
  if (user.manualReviewStatus === "PENDING") {
    return NextResponse.json({ error: "Your profile is already under review. We'll be in touch soon." }, { status: 400 });
  }

  // Prerequisite: OTP-verified phone or email
  if (!user.phoneVerified && !user.emailVerified) {
    return NextResponse.json({
      error: "Please verify your phone number or email address first. We need a way to reach you.",
      missing: "contact",
    }, { status: 422 });
  }

  // Prerequisite: profile photo
  if (!user.avatar) {
    return NextResponse.json({
      error: "Please add a profile photo first so we can confirm you're a real person.",
      missing: "avatar",
    }, { status: 422 });
  }

  const updated = await prisma.user.update({
    where:  { id: auth.userId },
    data:   { manualReviewStatus: "PENDING", manualReviewSubmittedAt: new Date() },
    select: {
      manualReviewStatus: true,
      manualReviewSubmittedAt: true,
      manualReviewRejectionReason: true,
    },
  });

  return NextResponse.json({ ok: true, ...updated });
}
