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
