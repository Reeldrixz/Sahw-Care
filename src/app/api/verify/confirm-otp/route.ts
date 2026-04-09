import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkVerification } from "@/lib/otp";
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

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (type === "PHONE" && !user.phone) {
    return NextResponse.json({ error: "No phone number on account" }, { status: 400 });
  }
  if (type === "EMAIL" && !user.email) {
    return NextResponse.json({ error: "No email address on account" }, { status: 400 });
  }

  const to = type === "PHONE" ? user.phone! : user.email!;

  let approved: boolean;
  try {
    approved = await checkVerification(to, code.toString().trim());
  } catch (err) {
    console.error("[confirm-otp]", err);
    return NextResponse.json({ error: "Verification check failed. Please try again." }, { status: 500 });
  }

  if (!approved) {
    return NextResponse.json({ error: "Incorrect or expired code." }, { status: 400 });
  }

  // ── Code approved ──────────────────────────────────────────────────────
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

  const newScore = await recalculateTrustScore(auth.userId);
  await syncTrustRating(auth.userId, newScore);

  return NextResponse.json({ verified: true, verificationLevel, trustScore: newScore });
}
