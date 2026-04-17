import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPhoneVerification, checkPhoneVerification } from "@/lib/otp";
import { recalculateTrustScore, syncTrustRating } from "@/lib/trust";

export const dynamic = "force-dynamic";

/**
 * POST /api/user/phone-setup
 *
 * Step 1 — send code:  { phone: "+2348012345678" }
 * Step 2 — verify:     { phone: "+2348012345678", code: "123456" }
 */
export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { phone, code } = await req.json();

  if (!phone || typeof phone !== "string") {
    return NextResponse.json({ error: "phone is required" }, { status: 400 });
  }

  // Basic E.164 sanity check — must start with + and have 7–15 digits
  if (!/^\+\d{7,15}$/.test(phone)) {
    return NextResponse.json({ error: "Invalid phone number format" }, { status: 400 });
  }

  // Check phone isn't already registered to a different account
  const existing = await prisma.user.findFirst({
    where: { phone, NOT: { id: auth.userId } },
  });
  if (existing) {
    return NextResponse.json({ error: "This phone number is already registered to another account" }, { status: 409 });
  }

  // ── Step 1: Send code ─────────────────────────────────────────────────────
  if (!code) {
    try {
      await sendPhoneVerification(phone);
    } catch (err) {
      console.error("[phone-setup/send]", err);
      return NextResponse.json({ error: "Failed to send verification code. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ sent: true });
  }

  // ── Step 2: Verify code and save phone ────────────────────────────────────
  let approved = false;
  try {
    approved = await checkPhoneVerification(phone, code.toString().trim());
  } catch (err) {
    console.error("[phone-setup/verify]", err);
    return NextResponse.json({ error: "Verification check failed. Please try again." }, { status: 500 });
  }

  if (!approved) {
    return NextResponse.json({ error: "Incorrect or expired code." }, { status: 400 });
  }

  // Save phone + mark verified
  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const emailVerified = user.emailVerified;
  const verificationLevel = emailVerified ? 2 : 1; // phone is now verified, so at least level 1

  await prisma.user.update({
    where: { id: auth.userId },
    data:  { phone, phoneVerified: true, verificationLevel },
  });

  const newScore = await recalculateTrustScore(auth.userId);
  await syncTrustRating(auth.userId, newScore);

  return NextResponse.json({ verified: true, verificationLevel, trustScore: newScore });
}
