import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { autoJoinCircle } from "@/lib/countryCircle";
import { detectGeoFromRequest } from "@/lib/geoip";
import { logAbuseEvent } from "@/lib/abuse";
import { sendWelcomeEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

interface GoogleClaims {
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  given_name?: string;
}

export async function POST(req: NextRequest) {
  try {
    if (!CLIENT_ID) {
      return NextResponse.json({ error: "Google sign-in is not configured" }, { status: 503 });
    }

    const { credential } = await req.json();
    if (!credential || typeof credential !== "string") {
      return NextResponse.json({ error: "Missing Google credential" }, { status: 400 });
    }

    // Verify the Google ID token against Google's public keys.
    let claims: GoogleClaims;
    try {
      const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
        issuer:   ["https://accounts.google.com", "accounts.google.com"],
        audience: CLIENT_ID,
      });
      claims = payload as GoogleClaims;
    } catch {
      return NextResponse.json({ error: "Could not verify Google sign-in" }, { status: 401 });
    }

    const emailVerified = claims.email_verified === true || claims.email_verified === "true";
    const email = claims.email?.trim().toLowerCase();
    if (!email || !emailVerified) {
      return NextResponse.json({ error: "Your Google email could not be verified" }, { status: 401 });
    }

    // ── Existing account → log in only. We deliberately DO NOT import the Google
    // display name or profile photo onto an existing account, so social profile
    // data can never surface on a mother's (or anyone's) account.
    const existing = await prisma.user.findFirst({
      where:  { email: { equals: email, mode: "insensitive" } },
      select: { id: true, name: true, role: true, status: true },
    });

    let userId: string;
    let userName: string;
    let userRole: string;
    let isNew = false;

    if (existing) {
      if (existing.status === "SUSPENDED") {
        return NextResponse.json({ error: "This account is suspended" }, { status: 403 });
      }
      userId   = existing.id;
      userName = existing.name;
      userRole = existing.role;
    } else {
      // ── New account → public/general signup, created as a DONOR (mothers come
      // in referral-only, never through this page). No avatar is stored.
      const displayName = (claims.name || claims.given_name || email.split("@")[0]).slice(0, 80);
      // OAuth accounts have no usable password; store a random unguessable hash.
      const randomHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);

      const created = await prisma.user.create({
        data: {
          name:          displayName,
          email,
          password:      randomHash,
          role:          "DONOR",
          emailVerified: true,
          // avatar intentionally left null — never import the Google profile photo
        },
        select: { id: true, name: true, role: true, location: true, trustScore: true },
      });
      userId   = created.id;
      userName = created.name;
      userRole = created.role;
      isNew    = true;

      if (email) {
        sendWelcomeEmail({ name: created.name, email }).catch((err) => console.error("[google] welcome email failed:", err));
      }
      autoJoinCircle(created.id, created.location).catch(() => {});
      logAbuseEvent(created.id, "SIGNUP", created.trustScore, { name: created.name, isEmail: true, provider: "google" }, req).catch(() => {});
      detectGeoFromRequest(req).then((geo) => {
        if (!geo) return;
        prisma.user.update({
          where: { id: created.id },
          data:  { countryCode: geo.countryCode, countryFlag: geo.countryFlag, ...(!created.location && geo.location ? { location: geo.location } : {}) },
        }).catch(() => {});
      }).catch(() => {});
    }

    // Device/IP log (fire-and-forget)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;
    const ua = req.headers.get("user-agent") ?? null;
    prisma.deviceLog.create({
      data: { userId, ipAddress: ip, userAgent: ua, action: isNew ? "register_google" : "login_google" },
    }).catch(() => {});

    const token = await signToken({ userId, role: userRole, name: userName });

    const response = NextResponse.json({ ok: true, isNew }, { status: isNew ? 201 : 200 });
    response.cookies.set("cc_token", token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   60 * 60 * 24 * 7,
      path:     "/",
    });
    return response;
  } catch (error) {
    console.error("Google auth error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
