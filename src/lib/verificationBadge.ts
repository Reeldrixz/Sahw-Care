// The verification badge shown next to a mother's name wherever her register
// appears. Derived on the server: the inputs (referralCodeId, the admin grant
// basis, identityVerified) never leave it, only the resulting badge does.
//
//   PARTNER_REFERRED (blue)  she redeemed a partner code, or an admin granted
//                            access on the basis that a partner vouched for her
//   ID_VERIFIED      (green) Persona or an admin override verified her identity,
//                            or an admin granted access having checked her ID
//
// When both apply, PARTNER_REFERRED wins: an accountable organisation vouching
// for her as a mother in need is the stronger statement on a register.
//
// This replaces the old verificationLevel-based "Verified mother" / "✓" marks.
// verificationLevel tracks contact and document checks, which is not what
// either label claims.
//
// No server imports, so the type is safe to use from client components.

export type VerificationBadge = "PARTNER_REFERRED" | "ID_VERIFIED" | null;

// Spread into a Prisma `select` for the creator, then pass the row through
// withVerificationBadge before it goes into a response.
export const VERIFICATION_BADGE_FIELDS = {
  referralCodeId:      true,
  recipientGrantBasis: true,
  identityVerified:    true,
} as const;

type BadgeInputs = {
  referralCodeId:      string | null;
  recipientGrantBasis: "ID" | "REFERRAL" | null;
  identityVerified:    boolean;
};

export function verificationBadgeFor(u: BadgeInputs): VerificationBadge {
  if (u.referralCodeId || u.recipientGrantBasis === "REFERRAL") return "PARTNER_REFERRED";
  if (u.identityVerified || u.recipientGrantBasis === "ID")      return "ID_VERIFIED";
  return null;
}

// Swaps the raw inputs on a selected creator row for the derived badge, so the
// inputs cannot be serialised into a response by accident.
export function withVerificationBadge<T extends BadgeInputs>(
  u: T,
): Omit<T, keyof BadgeInputs> & { verificationBadge: VerificationBadge } {
  const { referralCodeId, recipientGrantBasis, identityVerified, ...rest } = u;
  return { ...rest, verificationBadge: verificationBadgeFor({ referralCodeId, recipientGrantBasis, identityVerified }) };
}
