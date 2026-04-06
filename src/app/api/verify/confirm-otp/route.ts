import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isOtpExpired } from "@/lib/otp";
import { recalculateTrustScore, syncTrustRating } from "@/lib/trust";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, code } = await req.json();
  if (!["PHONE", "EMAIL"].includes(type) || !code) {
    return NextResponse.json({ error: "type and code are required" }, { status: 400 });
  }

  // Find the latest unused OTP for this user + type
  const otp = await prisma.otpVerification.findFirst({
    where: { userId: auth.userId, type: type as "PHONE" | "EMAIL", used: false },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return NextResponse.json({ error: "No pending OTP. Request a new one." }, { status: 400 });
  }

  // Max 5 attempts before invalidation
  if (otp.attempts >= 5) {
    await prisma.otpVerification.update({ where: { id: otp.id }, data: { used: true } });
    return NextResponse.json({ error: "Too many attempts. Request a new code." }, { status: 400 });
  }

  if (isOtpExpired(otp.expiresAt)) {
    return NextResponse.json({ error: "Code has expired. Request a new one." }, { status: 400 });
  }

  if (otp.code !== code.toString().trim()) {
    await prisma.otpVerification.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    const remaining = 4 - otp.attempts;
    return NextResponse.json({ error: `Incorrect code. ${remaining} attempt${remaining !== 1 ? "s" : ""} left.` }, { status: 400 });
  }

  // ── Code is correct ────────────────────────────────────────────────────
  await prisma.otpVerification.update({ where: { id: otp.id }, data: { used: true } });

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Compute new verification level
  const phoneVerified = type === "PHONE" ? true : user.phoneVerified;
  const emailVerified = type === "EMAIL" ? true : user.emailVerified;
  let verificationLevel = 0;
  if (phoneVerified || emailVerified) verificationLevel = 1;
  if (phoneVerified && emailVerified) verificationLevel = 2;
  // Level 3+ (ID) set separately

  await prisma.user.update({
    where: { id: auth.userId },
    data: {
      ...(type === "PHONE" ? { phoneVerified: true } : { emailVerified: true }),
      verificationLevel,
    },
  });

  const newScore = await recalculateTrustScore(auth.userId);
  await syncTrustRating(auth.userId, newScore);

  return NextResponse.json({ verified: true, verificationLevel, trustScore: newScore });
}
