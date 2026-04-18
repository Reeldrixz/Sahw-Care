import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPhoneVerification, isOtpExpired } from "@/lib/otp";
import { awardTrust, checkFullVerificationBonus } from "@/lib/trust";
import { logAbuseEvent } from "@/lib/abuse";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, code } = await req.json();
  if (!["PHONE", "EMAIL"].includes(type) || !code) {
    return NextResponse.json({ error: "type and code are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let approved = false;

  // ── Phone → Twilio Verify ────────────────────────────────────────────────
  if (type === "PHONE") {
    if (!user.phone) return NextResponse.json({ error: "No phone number on account" }, { status: 400 });
    try {
      approved = await checkPhoneVerification(user.phone, code.toString().trim());
    } catch (err) {
      console.error("[confirm-otp/phone]", err);
      return NextResponse.json({ error: "Verification check failed. Please try again." }, { status: 500 });
    }
    if (!approved) {
      return NextResponse.json({ error: "Incorrect or expired code." }, { status: 400 });
    }
  }

  // ── Email → local DB check ────────────────────────────────────────────────
  if (type === "EMAIL") {
    if (!user.email) return NextResponse.json({ error: "No email address on account" }, { status: 400 });

    const otp = await prisma.otpVerification.findFirst({
      where: { userId: auth.userId, type: "EMAIL", used: false },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      return NextResponse.json({ error: "No pending code. Request a new one." }, { status: 400 });
    }

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
      return NextResponse.json({
        error: `Incorrect code. ${remaining} attempt${remaining !== 1 ? "s" : ""} left.`,
      }, { status: 400 });
    }

    await prisma.otpVerification.update({ where: { id: otp.id }, data: { used: true } });
    approved = true;
  }

  // ── Mark verified + recalculate trust ────────────────────────────────────
  const phoneVerified = type === "PHONE" ? true : user.phoneVerified;
  const emailVerified = type === "EMAIL" ? true : user.emailVerified;
  let verificationLevel = 0;
  if (phoneVerified || emailVerified) verificationLevel = 1;
  if (phoneVerified && emailVerified) verificationLevel = 2;

  await prisma.user.update({
    where: { id: auth.userId },
    data: {
      ...(type === "PHONE" ? { phoneVerified: true } : { emailVerified: true }),
      verificationLevel,
    },
  });

  const eventType = type === "PHONE" ? "PHONE_VERIFIED" : "EMAIL_VERIFIED";
  const newScore = await awardTrust(auth.userId, eventType) ?? 0;
  await checkFullVerificationBonus(auth.userId);

  // Log verification event
  logAbuseEvent(auth.userId, "VERIFICATION_SUBMITTED", newScore, { type, verificationLevel }, req).catch(() => {});

  return NextResponse.json({ verified: true, verificationLevel, trustScore: newScore });
}
