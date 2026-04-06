import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateOtp, getOtpExpiry, sendOtpSms, sendOtpEmail } from "@/lib/otp";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type } = await req.json(); // "PHONE" | "EMAIL"
  if (!["PHONE", "EMAIL"].includes(type)) {
    return NextResponse.json({ error: "type must be PHONE or EMAIL" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Already verified?
  if (type === "PHONE" && user.phoneVerified) {
    return NextResponse.json({ error: "Phone already verified" }, { status: 400 });
  }
  if (type === "EMAIL" && user.emailVerified) {
    return NextResponse.json({ error: "Email already verified" }, { status: 400 });
  }

  // Need matching contact info
  if (type === "PHONE" && !user.phone) {
    return NextResponse.json({ error: "No phone number on account" }, { status: 400 });
  }
  if (type === "EMAIL" && !user.email) {
    return NextResponse.json({ error: "No email address on account" }, { status: 400 });
  }

  // Rate-limit: max 3 OTPs per 10 min
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentCount = await prisma.otpVerification.count({
    where: { userId: auth.userId, type: type as "PHONE" | "EMAIL", createdAt: { gte: tenMinutesAgo } },
  });
  if (recentCount >= 3) {
    return NextResponse.json({ error: "Too many OTP requests. Wait 10 minutes." }, { status: 429 });
  }

  const code = generateOtp();
  const expiresAt = getOtpExpiry(10);

  await prisma.otpVerification.create({
    data: { userId: auth.userId, type: type as "PHONE" | "EMAIL", code, expiresAt },
  });

  let devCode: string | null = null;
  try {
    if (type === "PHONE") {
      devCode = await sendOtpSms(user.phone!, code);
    } else {
      devCode = await sendOtpEmail(user.email!, code);
    }
  } catch {
    return NextResponse.json({ error: "Failed to send OTP. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    sent: true,
    ...(devCode ? { devCode } : {}), // only present in development
  });
}
