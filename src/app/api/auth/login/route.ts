import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { updateStreakOnLogin, awardAccountAgePoints } from "@/lib/trust";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { identifier, password } = await req.json();

    if (!identifier || !password) {
      return NextResponse.json({ error: "Email/phone and password are required" }, { status: 400 });
    }

    const isEmail = identifier.includes("@");
    // Normalize: trim whitespace; lowercase emails for case-insensitive lookup
    const normalizedId = isEmail ? identifier.trim().toLowerCase() : identifier.trim();
    console.log("[login] Attempt. isEmail:", isEmail, "normalizedId:", normalizedId);

    const user = await prisma.user.findFirst({
      where: isEmail
        ? { email: { equals: normalizedId, mode: "insensitive" } }
        : { phone: normalizedId },
    });

    if (!user) {
      console.log("[login] 401 — no user found for:", normalizedId);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    console.log("[login] User found:", user.id, "status:", user.status, "pwdLen:", user.password?.length, "pwdPrefix:", user.password?.substring(0, 7));

    if (user.status === "SUSPENDED") {
      return NextResponse.json({ error: "Your account has been suspended. Contact support." }, { status: 403 });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    console.log("[login] bcrypt.compare result:", passwordMatch, "for user:", user.id);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Log device/IP (fire-and-forget — never block login on this)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
               req.headers.get("x-real-ip") ?? null;
    const ua = req.headers.get("user-agent") ?? null;
    prisma.deviceLog.create({
      data: { userId: user.id, ipAddress: ip, userAgent: ua, action: "login" },
    }).catch(() => {}); // non-blocking

    // Streak + account age (fire-and-forget — never block login on this)
    Promise.all([
      updateStreakOnLogin(user.id),
      awardAccountAgePoints(user.id),
    ]).catch(() => {});

    const token = await signToken({ userId: user.id, role: user.role, name: user.name });

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        location: user.location,
        isPremium: user.isPremium,
        trustRating: user.trustRating,
        trustScore: user.trustScore,
        verificationLevel: user.verificationLevel,
        phoneVerified: user.phoneVerified,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
    });

    response.cookies.set("cc_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[auth/login] Unhandled error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
