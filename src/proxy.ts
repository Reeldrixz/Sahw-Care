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
  // public Community Partner directory + per-business profile pages.
  // Must stay public: in-store QR codes point at these, no auth.
  "/community-partners",
  // public mother-facing "how to reach a partner" directory. Must stay public
  // for the same reason: the landing page footer ("Need support?") and the
  // logged-out referral landing at /join/[code] both link here, and the page's
  // own description addresses someone who was handed the link — "A friend
  // thought Kradel could help." It renders a static partner list with no auth,
  // no Prisma and no user data, so there is nothing to protect. Gating it put a
  // login wall in front of a mother at the moment she was reaching for help.
  "/find-help",
  // public tiered sponsorship / "become a partner" marketing page
  "/partners",
  // public Impact Creator program page (+ public link-visit counter)
  "/creators",
  "/api/creators/visit",
  // auth flows that must work for logged-out users
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/google",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  // host dashboard read for a fundraising event. A host has no Kradel account;
  // the bearer token in the path is the entire authorisation, and the route
  // enforces it itself through resolveEventByToken — which fails uniformly for
  // missing, malformed, revoked, expired and ENDED. Public here means "no
  // session required", not "unauthenticated".
  "/api/host",
  // the host dashboard page itself. Same reasoning as the API above: no Kradel
  // session, the bearer token in the path is the authorisation, and the page
  // reads nothing except /api/host/[token] — which enforces it.
  "/host",
  // the broadcast overlay and its stream. Added to OBS as a browser source on the
  // host machine, so the bearer token in the path is the authorisation — the same
  // credential as the dashboard, and equally never viewer-facing. The stream
  // enforces it through resolveEventByToken.
  "/overlay",
  "/api/overlay",
  // the event landing page — the on-ramp from a broadcast to a payment. This is
  // the one URL a host says on air, and it is addressed by SLUG, never by the
  // kevt_ access token: a viewer-facing URL carrying the token would hand every
  // viewer host access. DRAFT events 404 so an unannounced event is not findable
  // by guessing; ENDED renders a closed state because a link read out on air
  // keeps being visited afterwards.
  "/e",
  // the shareable profile snapshot. api/profile/contributor/share mints a /u/<id>
  // link for a contributor to send to people who do not have Kradel accounts —
  // that is the entire purpose. The page takes no auth: it reads a frozen
  // snapshotData blob and renders it, with an unguessable id and a 30-day
  // expiresAt as the access control. While this was gated, every link the
  // feature produced worked only for people who already had accounts, which made
  // the whole feature silently non-functional.
  "/u",
  // the privacy policy. A login-walled privacy policy defeats its own purpose:
  // it is the document you point app stores, payment processors, partners and
  // regulators at, and the people most likely to request it are precisely the
  // ones without accounts. Several of those parties require it to be publicly
  // reachable, so this one carries a compliance edge the other pages do not.
  "/privacy",
  // the public register share page. lib/registers.ts describes
  // fetchPublicRegister as "privacy-safe, no auth required" and the page carries
  // OpenGraph metadata for sharing — both of which were pointless while this
  // redirected a logged-out visitor to /auth. It exposes first name only, no
  // contact and no address, and DRAFT/ABANDONED registers return not-found, so
  // there is nothing here to gate. Guest funding starts from this page.
  "/r",
  // guest checkout for a register item. A logged-out viewer — typically someone
  // who followed a host link during a stream — can fund without an account. A
  // SEPARATE route rather than opening /api/registers, which carries address
  // confirmation and register mutation: this one does a single thing, is IP
  // rate-limited, re-verifies the register is publicly fundable, and computes
  // every amount server-side.
  "/api/guest/fund",
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
