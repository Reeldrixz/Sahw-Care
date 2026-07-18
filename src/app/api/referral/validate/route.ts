import { NextRequest, NextResponse } from "next/server";
import { lookupRedeemableCode } from "@/lib/referral";
import { rateLimitAsync, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Public, unauthenticated. Used by the /join landing page to decide whether to
// show the warm invite or the warm rejection. Rate-limited to resist code
// enumeration, and returns an identical shape for every failure mode so it
// never reveals whether a given code exists.
export async function GET(req: NextRequest) {
  const rl = await rateLimitAsync(`referral-validate:${getClientIp(req)}`, 30, 5 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { valid: false },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const code = req.nextUrl.searchParams.get("code")?.trim() ?? "";
  const redeemable = await lookupRedeemableCode(code);
  if (!redeemable) return NextResponse.json({ valid: false });
  return NextResponse.json({ valid: true, partnerName: redeemable.partnerName });
}
