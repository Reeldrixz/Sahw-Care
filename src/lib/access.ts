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
    "We need to confirm a few details before this can continue — we'll be in touch.",
};

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
      "To create a Register of Needs, please submit your profile for our team to review first. Head to your profile and tap 'Submit for review' — it usually takes just a short while.",
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
        "Your first item request requires your profile to be approved by our team. Submit for review from your profile — it usually takes a short while.",
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
