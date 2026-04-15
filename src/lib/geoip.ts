import type { NextRequest } from "next/server";
import { countryCodeToFlag } from "@/lib/stage";

export interface GeoResult {
  countryCode: string;
  countryFlag: string;
  city:        string | null;
  country:     string | null;
  location:    string | null; // "City, Country" or "Country"
}

/** Extract the real client IP from Vercel / reverse-proxy headers. */
function getClientIP(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? null;
}

/**
 * Server-side IP geolocation via ipapi.co.
 * Returns null if the IP is local, the call fails, or the response has no country.
 * Never throws.
 */
export async function detectGeoFromRequest(req: NextRequest): Promise<GeoResult | null> {
  const ip = getClientIP(req);
  // Skip loopback / missing IPs (common in local dev)
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return null;
  }

  try {
    const res  = await fetch(`https://ipapi.co/${ip}/json/`, { cache: "no-store" });
    const data = await res.json() as Record<string, unknown>;
    if (data.error || !data.country_code) return null;

    const code    = data.country_code as string;
    const city    = (data.city         as string | undefined) ?? null;
    const country = (data.country_name as string | undefined) ?? null;

    return {
      countryCode: code,
      countryFlag: countryCodeToFlag(code),
      city,
      country,
      location: city && country ? `${city}, ${country}` : country,
    };
  } catch {
    return null;
  }
}
