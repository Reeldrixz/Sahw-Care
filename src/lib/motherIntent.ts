// The "held-open door" state: an account that arrived with mother-intent
// (picked pregnant/postpartum, got referral-gated) but is not yet a RECIPIENT.
// Real donors never expressed mother-intent, so motherIntentAt is null for them
// and this is always false — their experience is untouched.
export function hasMotherIntent(
  user: { motherIntentAt: string | null; role: string } | null | undefined,
): boolean {
  return !!user?.motherIntentAt && user.role !== "RECIPIENT";
}
