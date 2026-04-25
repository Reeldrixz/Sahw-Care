import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { updateStreakOnLogin, awardAccountAgePoints } from "@/lib/trust";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Brute-force protection: 10 attempts per IP per 15 minutes
    const ip    = getClientIp(req);
    const limit = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: `Too many login attempts. Try again in ${limit.retryAfter} seconds.` },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const { identifier, password } = await req.json();

    if (!identifier || !password) {
      return NextResponse.json({ error: "Email/phone and password are required" }, { status: 400 });
    }

    const isEmail     = identifier.includes("@");
    const normalizedId = isEmail ? identifier.trim().toLowerCase() : identifier.trim();

    const user = await prisma.user.findFirst({
      where: isEmail
        ? { email: { equals: normalizedId, mode: "insensitive" } }
        : { phone: normalizedId },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (user.status === "SUSPENDED") {
      return NextResponse.json({ error: "Your account has been suspended. Contact support." }, { status: 403 });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Log device/IP (fire-and-forget)
    const ua = req.headers.get("user-agent") ?? null;
    prisma.deviceLog.create({
      data: { userId: user.id, ipAddress: ip, userAgent: ua, action: "login" },
    }).catch(() => {});

    // Streak + account age (fire-and-forget)
    Promise.all([
      updateStreakOnLogin(user.id),
      awardAccountAgePoints(user.id),
    ]).catch(() => {});

    const token = await signToken({ userId: user.id, role: user.role, name: user.name });

    const response = NextResponse.json({
      user: {
        id:                user.id,
        name:              user.name,
        email:             user.email,
        phone:             user.phone,
        role:              user.role,
        avatar:            user.avatar,
        location:          user.location,
        isPremium:         user.isPremium,
        trustRating:       user.trustRating,
        trustScore:        user.trustScore,
        verificationLevel: user.verificationLevel,
        phoneVerified:     user.phoneVerified,
        emailVerified:     user.emailVerified,
        createdAt:         user.createdAt,
      },
    });

    response.cookies.set("cc_token", token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   60 * 60 * 24 * 2, // 2 days — matches JWT TTL
      path:     "/",
    });

    return response;
  } catch (error) {
    console.error("[auth/login] Unhandled error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
