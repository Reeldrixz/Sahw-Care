import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { autoJoinCircle } from "@/lib/countryCircle";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { name, identifier, password } = await req.json();

    if (!name || !identifier || !password) {
      return NextResponse.json({ error: "Name, email/phone and password are required" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const isEmail = identifier.includes("@");

    const existing = await prisma.user.findFirst({
      where: isEmail ? { email: identifier } : { phone: identifier },
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
        email: isEmail ? identifier : null,
        phone: !isEmail ? identifier : null,
        password: hashedPassword,
        role: "DONOR",
      },
    });

    // Auto-join circle if location provided at registration
    autoJoinCircle(user.id, user.location).catch(() => {});

    // Log device/IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
               req.headers.get("x-real-ip") ?? null;
    const ua = req.headers.get("user-agent") ?? null;
    prisma.deviceLog.create({
      data: { userId: user.id, ipAddress: ip, userAgent: ua, action: "register" },
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
          trustRating: user.trustRating,
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
