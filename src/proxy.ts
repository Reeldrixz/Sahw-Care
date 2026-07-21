import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/",
  "/auth",
  "/items",
  "/donors",
  "/favourites",
  "/browse",
  // referral landing: a referred mother reaches this while logged out
  "/join",
  // public community-partners (sponsorship) marketing page
  "/partners",
  // auth flows that must work for logged-out users
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/google",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  // public referral-code validation (non-leaking, rate-limited). Redemption
  // itself happens through the auth routes above or the authenticated
  // /api/referral/redeem (which stays protected).
  "/api/referral/validate",
  // public data APIs
  "/api/items",
  "/api/users",
  // server-side reverse geocode for the location picker (rate-limited)
  "/api/geo/reverse",
  "/api/webhooks",
  // cron endpoints: routable by Vercel Cron (no user session); each route
  // enforces CRON_SECRET itself (fail-closed) as the security boundary.
  "/api/cron",
];
const ADMIN_PATHS = ["/admin", "/api/admin"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isPublic && !ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/auth";
    return NextResponse.redirect(url);
  }

  if (ADMIN_PATHS.some((p) => pathname.startsWith(p)) && user.role !== "ADMIN") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-id", user.userId);
  requestHeaders.set("x-user-role", user.role);
  requestHeaders.set("x-user-name", user.name);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
