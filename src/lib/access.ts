type UserForAccess = {
  manualReviewStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  identityVerified: boolean;
  accountHold: boolean;
};

interface AccessResult {
  allowed: boolean;
  code?: string;
  message?: string;
}

const HOLD_RESULT: AccessResult = {
  allowed: false,
  code: "ACCOUNT_UNDER_REVIEW",
  message:
    "We need to confirm a few details before this can continue. We'll be in touch.",
};

// Experiences eligibility. Motherhood is the ONLY basis — not gender, not
// donation, not verification tier. A mother belongs in the motherhood community
// on her own merits; how she arrived at Kradel is incidental.
//
// Reads the LIVE flag, so revoking motherhood in her profile stops new posts and
// comments immediately. It deliberately does nothing to what she already wrote:
// those were true when written, other mothers may be relying on them, and
// retracting knowledge would punish contribution.
// The hold check comes FIRST and is deliberately indistinguishable from every
// other held-account response: Experiences is a safety-reviewed knowledge base
// that other mothers act on, so an account under review does not get to push
// content into it while that review is open. Motherhood is still the only
// eligibility basis; a hold is a separate, temporary state.
export function canWriteExperiences(user: {
  isMother: boolean;
  accountHold: boolean;
}): AccessResult {
  if (user.accountHold) return HOLD_RESULT;
  if (user.isMother) return { allowed: true };
  return {
    allowed: false,
    code: "NOT_A_MOTHER",
    message:
      "Experiences is where mothers share what they've learned. If you're a mother too, you can join in — just let us know in your profile.",
  };
}

// Reading Experiences is gated identically to writing them, on purpose.
//
// This is a values decision, not a technical one. A mother writing honestly
// about her hardest weeks is writing for the mothers coming up behind her — not
// for donors to browse. Opening the reader to anyone who is not a mother would
// betray the expectation she wrote under, and it is the same firewall that keeps
// support type following need rather than exposure. A mother who also gives
// reads here because she is a mother; giving is incidental either way.
//
// Kept as its own function rather than an alias so the two can diverge later if
// there is ever a reason — but any divergence should be deliberate, because a
// surface that can be read but not written to, or vice versa, is confusing in
// both directions.
export function canReadExperiences(user: {
  isMother: boolean;
  accountHold: boolean;
}): AccessResult {
  if (user.accountHold) return HOLD_RESULT;
  if (user.isMother) return { allowed: true };
  return {
    allowed: false,
    code: "NOT_A_MOTHER",
    message:
      "Experiences is where mothers share what they've learned. If you're a mother too, you can join in — just let us know in your profile.",
  };
}

export function canCreateRegister(user: UserForAccess): AccessResult {
  if (
    user.manualReviewStatus === "PENDING" ||
    user.manualReviewStatus === "APPROVED"
  ) {
    return { allowed: true };
  }
  return {
    allowed: false,
    code: "NEEDS_BASELINE_REVIEW",
    message:
      "To create a Register of Needs, please submit your profile for our team to review first. Head to your profile and tap 'Submit for review'. It usually takes just a short while.",
  };
}

export function canApplyForBundle(user: UserForAccess): AccessResult {
  if (user.accountHold) return HOLD_RESULT;
  if (user.identityVerified === true) {
    return { allowed: true };
  }
  return {
    allowed: false,
    code: "NEEDS_IDENTITY_VERIFICATION",
    message:
      "To apply for a care bundle, please complete identity verification on your profile first.",
  };
}

export function canReceiveShipment(user: UserForAccess): AccessResult {
  if (user.accountHold) return HOLD_RESULT;
  if (user.identityVerified === true) {
    return { allowed: true };
  }
  return {
    allowed: false,
    code: "NEEDS_IDENTITY_VERIFICATION",
    message:
      "To confirm your shipping address, please complete identity verification on your profile first. This keeps your address and your delivery secure.",
  };
}

export function canClaimDiscoverItem(
  user: UserForAccess,
  priorClaimCount: number,
): AccessResult {
  if (user.accountHold) return HOLD_RESULT;

  if (priorClaimCount === 0) {
    if (user.manualReviewStatus === "APPROVED") {
      return { allowed: true };
    }
    return {
      allowed: false,
      code: "NEEDS_BASELINE_APPROVED",
      message:
        "Your first item request requires your profile to be approved by our team. Submit for review from your profile. It usually takes a short while.",
    };
  }

  // priorClaimCount >= 1: identity verification required
  if (user.identityVerified === true) {
    return { allowed: true };
  }
  return {
    allowed: false,
    code: "NEEDS_IDENTITY_VERIFICATION",
    message:
      "To continue receiving items, please complete identity verification on your profile.",
  };
}
