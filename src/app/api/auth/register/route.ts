import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { autoJoinCircle } from "@/lib/countryCircle";
import { detectGeoFromRequest } from "@/lib/geoip";
import { logAbuseEvent } from "@/lib/abuse";
import { validatePassword } from "@/lib/password";
import { sendWelcomeEmail } from "@/lib/email";
import { rateLimitAsync, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Abuse protection: cap signups per IP (10 / hour)
    const rl = await rateLimitAsync(`signup:${getClientIp(req)}`, 10, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Too many signups from this network. Try again in ${rl.retryAfter} seconds.` },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
    }

    const { name, identifier, password } = await req.json();

    if (!name || !identifier || !password) {
      return NextResponse.json({ error: "Name, email/phone and password are required" }, { status: 400 });
    }

    const pwError = validatePassword(password);
    if (pwError) {
      return NextResponse.json({ error: pwError }, { status: 400 });
    }

    const isEmail = identifier.includes("@");
    // Normalize: trim whitespace; lowercase emails so lookups and storage are consistent
    const normalizedId = isEmail ? identifier.trim().toLowerCase() : identifier.trim();

    const existing = await prisma.user.findFirst({
      where: isEmail
        ? { email: { equals: normalizedId, mode: "insensitive" } }
        : { phone: normalizedId },
    });

    if (existing) {
      return NextResponse.json(
        { error: `An account with this ${isEmail ? "email" : "phone number"} already exists` },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email: isEmail ? normalizedId : null,
        phone: !isEmail ? normalizedId : null,
        password: hashedPassword,
        role: "DONOR",
      },
    });

    // Welcome email (fire-and-forget — never blocks signup)
    if (user.email) {
      sendWelcomeEmail({ name: user.name, email: user.email })
        .catch((err) => console.error("[register] welcome email failed:", err));
    }

    // Auto-join circle if location provided at registration
    autoJoinCircle(user.id, user.location).catch(() => {});

    // Log signup event (fire-and-forget)
    logAbuseEvent(user.id, "SIGNUP", user.trustScore, { name: user.name, isEmail: !!user.email }, req).catch(() => {});

    // Log device/IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
               req.headers.get("x-real-ip") ?? null;
    const ua = req.headers.get("user-agent") ?? null;
    prisma.deviceLog.create({
      data: { userId: user.id, ipAddress: ip, userAgent: ua, action: "register" },
    }).catch(() => {});

    // Detect + save country from IP (fire-and-forget — never blocks registration)
    detectGeoFromRequest(req).then((geo) => {
      if (!geo) return;
      prisma.user.update({
        where: { id: user.id },
        data:  { countryCode: geo.countryCode, countryFlag: geo.countryFlag, ...(!user.location && geo.location ? { location: geo.location } : {}) },
      }).catch(() => {});
    }).catch(() => {});

    const token = await signToken({ userId: user.id, role: user.role, name: user.name });

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar: user.avatar,
          location: user.location,
          isPremium: user.isPremium,
          trustScore: user.trustScore,
          verificationLevel: user.verificationLevel,
          phoneVerified: user.phoneVerified,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
        },
      },
      { status: 201 }
    );

    response.cookies.set("cc_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
