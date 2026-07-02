import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Fail closed: never fall back to a hardcoded/known secret. A missing secret
// must break token signing/verification (rejecting all tokens) rather than
// silently sign with a guessable value that would let anyone forge admin JWTs.
let _jwtSecret: Uint8Array | null = null;
function getJwtSecret(): Uint8Array {
  if (_jwtSecret) return _jwtSecret;
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET is not set (or too short). Refusing to sign/verify tokens.");
  }
  _jwtSecret = new TextEncoder().encode(secret);
  return _jwtSecret;
}

const COOKIE_NAME = "cc_token";

export interface JWTPayload {
  userId: string;
  role: string;
  name: string;
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2d")
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getTokenFromRequest(req: NextRequest): Promise<string | null> {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (cookie) return cookie.value;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function getCurrentUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 2, // 2 days
    path: "/",
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Shared admin guard for API routes.
 * Returns the JWT payload if the requester is an ADMIN, null otherwise.
 * Usage: const admin = await requireAdmin(req); if (!admin) return NextResponse.json({error:"Forbidden"},{status:403});
 */
export async function requireAdmin(req: NextRequest): Promise<JWTPayload | null> {
  const token   = await getTokenFromRequest(req);
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where:  { id: payload.userId },
    select: { role: true },
  });
  return user?.role === "ADMIN" ? payload : null;
}
