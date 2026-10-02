import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Warm, dignity-consistent message for any invalid/used/expired/revoked code.
// Deliberately identical in all failure cases so it never leaks whether a code
// exists — just points the mother back to her referring organization.
export const REFERRAL_REJECTION_MESSAGE =
  "This invitation link can't be used right now. Please reach out to the organization that referred you. They'll be able to help you get set up.";

// Raised inside a redemption transaction when the atomic single-use consume
// loses a race (code already used/expired between validation and write).
export class ReferralConsumeError extends Error {
  constructor() {
    super("referral code could not be consumed");
    this.name = "ReferralConsumeError";
  }
}

// Canonical fields written when a referral code grants the RECIPIENT (mother)
// role. "Baseline approved" posture: the partner vouches she is a real mother,
// so she can use circles and claim her first Discover item immediately.
// identityVerified is intentionally NOT set — care-bundle applications still
// require identity verification. Register shipments do not: the partner's
// vetting stands in for it there (see canReceiveShipment / hasPartnerReferral).
//
// onboardingComplete MUST stay false and journeyType MUST be null so she runs
// the existing OnboardingModal -> /api/user/onboarding path, which (seeing an
// already-RECIPIENT user) assigns her stage + cohort circle. This is what
// resolves TODO(referral) in api/user/onboarding/route.ts.
export function referralGrantFields() {
  return {
    role: "RECIPIENT" as const,
    onboardingComplete: false,
    journeyType: null,
    emailVerified: true,
    manualReviewStatus: "APPROVED" as const,
    manualReviewedAt: new Date(),
  } satisfies Prisma.UserUncheckedUpdateInput;
}

// Unguessable bearer token. 8 chars from a 31-symbol ambiguity-free alphabet
// (~39 bits) plus a KRDL- prefix. Uniqueness is enforced by the DB; callers
// retry on the rare collision.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I, L, O, 0, 1
export function generateReferralCode(): string {
  const bytes = randomBytes(8);
  let body = "";
  for (let i = 0; i < 8; i++) body += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `KRDL-${body}`;
}

// Non-leaking public lookup used by the /join landing + validate endpoint.
// Returns the partner name only for a genuinely redeemable code; every failure
// mode (missing, used, revoked, expired, inactive partner) returns null.
export async function lookupRedeemableCode(
  code: string,
): Promise<{ partnerName: string } | null> {
  if (!code || typeof code !== "string") return null;
  const rc = await prisma.referralCode.findUnique({
    where:  { code },
    select: {
      status: true,
      expiresAt: true,
      partner: { select: { name: true, active: true } },
    },
  });
  if (!rc) return null;
  if (rc.status !== "UNUSED") return null;
  if (rc.expiresAt && rc.expiresAt.getTime() <= Date.now()) return null;
  if (!rc.partner.active) return null;
  return { partnerName: rc.partner.name };
}

// Atomically consume a code for a user. MUST run inside a transaction alongside
// the role grant. The conditional updateMany is the single-use guarantee: only
// one caller can flip UNUSED -> USED, so a code can never be consumed twice
// (no check-then-write race). Returns false if it was already spent/expired.
//
// On success it also stamps User.referralCodeId. Doing it here, not in each
// redemption route, is what keeps all of them (email signup, Google signup and
// upgrade, logged-in redeem) writing both sides of the link identically.
export async function consumeReferralCode(
  tx: Prisma.TransactionClient,
  code: string,
  userId: string,
): Promise<boolean> {
  const res = await tx.referralCode.updateMany({
    where: {
      code,
      status: "UNUSED",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    data: { status: "USED", usedAt: new Date(), usedByUserId: userId },
  });
  if (res.count !== 1) return false;

  const rc = await tx.referralCode.findUniqueOrThrow({ where: { code }, select: { id: true } });
  await tx.user.update({ where: { id: userId }, data: { referralCodeId: rc.id } });
  return true;
}

// Did this user come in through a partner referral code?
//
// Reads User.referralCodeId, which consumeReferralCode sets in the redemption
// transaction and the 20261003000000 migration backfilled from usedByUserId.
// A redeemed code cannot later be revoked (the admin revoke only touches UNUSED
// codes) or deleted (RESTRICT), so the pointer stays true.
//
// An admin grantRecipient is deliberately NOT a referral: no partner vetted
// her, and that path consumes no code.
//
// Keep this the one place referral status is derived.
export async function hasPartnerReferral(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where:  { id: userId },
    select: { referralCodeId: true },
  });
  return u?.referralCodeId != null;
}
