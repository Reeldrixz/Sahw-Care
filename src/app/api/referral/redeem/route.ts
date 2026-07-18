import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { awardTrust } from "@/lib/trust";
import { rateLimitAsync, getClientIp } from "@/lib/rateLimit";
import {
  REFERRAL_REJECTION_MESSAGE,
  ReferralConsumeError,
  consumeReferralCode,
  referralGrantFields,
} from "@/lib/referral";

export const dynamic = "force-dynamic";

// Authenticated redemption for an EXISTING logged-in user. This is the safe
// upgrade path for someone who already made a DONOR account and then opens
// their invite link — their session proves ownership, so we can upgrade them.
// (Brand-new signups redeem through /api/auth/register and /api/auth/google.)
export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Existing rate limiting applies to referral redemption too.
  const rl = await rateLimitAsync(`referral-redeem:${getClientIp(req)}`, 10, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rl.retryAfter} seconds.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const { code } = await req.json().catch(() => ({ code: "" }));
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: REFERRAL_REJECTION_MESSAGE, referralInvalid: true }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: { role: true },
  });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Already a mother (or an admin) — nothing to grant. Do NOT consume the code.
  if (user.role === "RECIPIENT") {
    return NextResponse.json({ ok: true, alreadyRecipient: true });
  }
  if (user.role !== "DONOR") {
    return NextResponse.json({ error: REFERRAL_REJECTION_MESSAGE, referralInvalid: true }, { status: 400 });
  }

  // Atomic: grant RECIPIENT + consume the code together, or neither.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: auth.userId }, data: referralGrantFields() });
      const consumed = await consumeReferralCode(tx, code.trim(), auth.userId);
      if (!consumed) throw new ReferralConsumeError();
    });
  } catch (e) {
    if (e instanceof ReferralConsumeError) {
      return NextResponse.json({ error: REFERRAL_REJECTION_MESSAGE, referralInvalid: true }, { status: 409 });
    }
    console.error("[referral/redeem] error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Trust baseline (idempotent, fire-and-forget) — mirrors manual verification.
  awardTrust(auth.userId, "EMAIL_VERIFIED", { reason: "referral partner grant" }).catch(() => {});

  return NextResponse.json({ ok: true });
}
