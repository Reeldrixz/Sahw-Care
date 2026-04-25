import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 3 reset requests per IP per hour
    const ip    = getClientIp(req);
    const limit = rateLimit(`reset:${ip}`, 3, 60 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${limit.retryAfter} seconds.` },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const { identifier } = await req.json();

    if (!identifier) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const isEmail     = identifier.includes("@");
    const normalizedId = isEmail ? identifier.trim().toLowerCase() : identifier.trim();

    const user = await prisma.user.findFirst({
      where: isEmail
        ? { email: { equals: normalizedId, mode: "insensitive" } }
        : { phone: normalizedId },
    });

    // Silent success — don't reveal whether account exists
    if (!user || !user.email) {
      return NextResponse.json({ ok: true });
    }

    // Invalidate any existing tokens for this user
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token     = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;

    await sendPasswordResetEmail({
      firstName: user.name.split(" ")[0],
      email:     user.email,
      resetUrl,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[forgot-password] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
