import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { identifier } = await req.json();
    console.log("[forgot-password] Route hit. Identifier:", identifier);

    if (!identifier) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const isEmail = identifier.includes("@");
    const normalizedId = isEmail ? identifier.trim().toLowerCase() : identifier.trim();
    console.log("[forgot-password] Normalized identifier:", normalizedId);

    const user = await prisma.user.findFirst({
      where: isEmail
        ? { email: { equals: normalizedId, mode: "insensitive" } }
        : { phone: normalizedId },
    });

    if (!user || !user.email) {
      console.log("[forgot-password] No user found (or no email on account) for:", normalizedId);
      return NextResponse.json({ ok: true }); // silent — don't reveal whether account exists
    }

    console.log("[forgot-password] Found user id:", user.id, "email:", user.email);

    // Invalidate any existing tokens for this user
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;
    console.log("[forgot-password] Sending reset email to:", user.email);
    console.log("[forgot-password] Reset URL:", resetUrl);

    const resendResult = await sendPasswordResetEmail({
      firstName: user.name.split(" ")[0],
      email: user.email,
      resetUrl,
    });

    console.log("[forgot-password] Resend API response:", JSON.stringify(resendResult));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[forgot-password] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
