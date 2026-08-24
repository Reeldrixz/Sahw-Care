import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Server-side reverse geocode (coords -> city). The browser calls this on
// "self" so the tight connect-src CSP stays intact — we never let client code
// talk to third-party hosts. Nominatim requires a real User-Agent; we set one
// here and rate-limit per IP since this is a public route.
export async function GET(req: NextRequest) {
  const rl = rateLimit(`geo-reverse:${getClientIp(req)}`, 30, 5 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 300) } },
    );
  }

  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (
    !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat < -90 || lat > 90 || lng < -180 || lng > 180
  ) {
    return NextResponse.json({ error: "Invalid coordinates." }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&addressdetails=1`,
      {
        headers: {
          "User-Agent": "Kradel/1.0 (https://sahw-care.vercel.app; contact partner@kradel.care)",
          "Accept": "application/json",
        },
        // Don't let a slow upstream hang the request.
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return NextResponse.json({ error: "Geocode failed." }, { status: 502 });
    const data = await res.json();
    // Return whatever real city the coords map to — including cities Kradel
    // doesn't operate in yet (a donor can be anywhere). Never silently drop it.
    const city: string | null =
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.county ||
      null;
    return NextResponse.json({ city });
  } catch {
    return NextResponse.json({ error: "Geocode failed." }, { status: 502 });
  }
}
