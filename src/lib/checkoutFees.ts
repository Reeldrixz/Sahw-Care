export const KRADEL_FEE_PCT      = 0.07;  // 7% mandatory platform fee
export const OPTIONAL_SUPPORT_PCT = 0.10;  // 10% optional support (default on)
export const STRIPE_PCT           = 0.029; // 2.9%
export const STRIPE_FIXED_CENTS   = 30;    // $0.30
export const MIN_GIFT_CENTS       = 500;   // $5.00 minimum

export interface FeeBreakdown {
  itemSubtotal:     number; // donor-chosen item contribution
  kradelFee:        number; // mandatory 7%
  optionalSupport:  number; // optional 10%, 0 if off
  stripeFee:        number; // Stripe fee, 0 if not covered
  total:            number; // actual Stripe charge amount
}

export function computeBreakdown(
  subtotalCents: number,
  supportOn:     boolean,
  coverStripe:   boolean,
): FeeBreakdown {
  const itemSubtotal    = subtotalCents;
  const kradelFee       = Math.round(subtotalCents * KRADEL_FEE_PCT);
  const optionalSupport = supportOn ? Math.round(subtotalCents * OPTIONAL_SUPPORT_PCT) : 0;
  const preStripe       = itemSubtotal + kradelFee + optionalSupport;

  let total: number;
  let stripeFee: number;
  if (coverStripe) {
    total     = Math.ceil((preStripe + STRIPE_FIXED_CENTS) / (1 - STRIPE_PCT));
    stripeFee = total - preStripe;
  } else {
    total     = preStripe;
    stripeFee = 0;
  }

  return { itemSubtotal, kradelFee, optionalSupport, stripeFee, total };
}

// ── Contribution amount check ───────────────────────────────────────────────
// One rule for both checkout routes (signed-in and guest), on the item amount
// only — fees are added on top and never count toward an item.
//
// - An item with a price can't be paid beyond what it still needs, so a single
//   payment can't overfund it. Remaining = price − funded, from the item's
//   funded total (the sum of confirmed item amounts).
// - The minimum gift applies, except that exactly the remaining amount is
//   always allowed: an item with $3 left would otherwise be impossible to
//   finish.
// - An item without a price (0) has no cap; only the minimum applies.
//
// Two checkouts can still both be under the remaining amount and overfund it
// together if both complete. That race is accepted: the item stays as funded,
// and progress figures cap each item at its price.
export type AmountCheck =
  | { ok: true }
  | { ok: false; status: number; error: string; remainingCents?: number };

export function checkContributionAmount(
  amountCents: number,
  item: { standardPriceCents: number; totalFundedCents: number },
): AmountCheck {
  if (item.standardPriceCents > 0) {
    const remaining = Math.max(0, item.standardPriceCents - item.totalFundedCents);
    if (remaining === 0) {
      return { ok: false, status: 409, error: "This item is already fully funded.", remainingCents: 0 };
    }
    if (amountCents > remaining) {
      return {
        ok: false, status: 400, remainingCents: remaining,
        error: `Only ${fmtCents(remaining)} is still needed for this item. Please give ${fmtCents(remaining)} or less.`,
      };
    }
    if (amountCents < MIN_GIFT_CENTS && amountCents !== remaining) {
      return {
        ok: false, status: 400, remainingCents: remaining,
        error: remaining < MIN_GIFT_CENTS
          ? `This item needs exactly ${fmtCents(remaining)} to finish.`
          : `Minimum contribution is ${fmtCents(MIN_GIFT_CENTS)}`,
      };
    }
    return { ok: true };
  }
  if (amountCents < MIN_GIFT_CENTS) {
    return { ok: false, status: 400, error: `Minimum contribution is ${fmtCents(MIN_GIFT_CENTS)}` };
  }
  return { ok: true };
}

function fmtCents(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

// The smallest amount a donor may give toward an item with `remainingCents`
// left: the minimum gift, or exactly what is left when that is less. Matches
// checkContributionAmount, for the checkout screens.
export function minGiftFor(remainingCents: number): number {
  return remainingCents > 0 && remainingCents < MIN_GIFT_CENTS ? remainingCents : MIN_GIFT_CENTS;
}

// Cents as an amount-field value, exact: 1250 → "12.50", 2500 → "25". The
// screens used to round the remaining amount to whole dollars, which the cap
// would now reject when it rounded up.
export function centsToAmountInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
