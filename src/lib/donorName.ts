import { firstNameOnly } from "@/lib/eventEffects";

// The name a donor chooses to show on a livestream, from the event checkout
// to the contribution row.
//
// Checkout → Stripe session metadata → webhook → RegisterItemFunding
// (displayName, showNameConsent). Only the cleaned first name is ever stored;
// what she typed beyond it never reaches the database. Not prefilled from any
// account data: the donor types it, or there is none.

const RAW_NAME_MAX = 100;   // Stripe metadata values allow 500; a name needs far less

// For the checkout route: the two metadata fields. The raw name is sent only
// when the box is ticked, so a donor who unticks it never has her name
// written anywhere, not even in Stripe.
export function donorNameMetadata(input: { displayName?: unknown; showName?: unknown }): {
  showName: "1" | "0";
  displayName: string;
} {
  const ticked = input.showName === true;
  const raw = ticked && typeof input.displayName === "string" ? input.displayName.trim().slice(0, RAW_NAME_MAX) : "";
  return { showName: ticked ? "1" : "0", displayName: raw };
}

// For the webhook: what to store on the contribution. Metadata is untrusted —
// it comes back from Stripe, but it was built from what a browser sent, and an
// older session may not have it at all:
//   - consent only if the flag is exactly "1"; missing or anything else is no
//   - the name is cleaned with the same first-name rule as the celebrations
//     (lib/eventEffects firstNameOnly)
//   - unticked or blank means no name
export function donorNameFromMetadata(metadata: Record<string, string> | null | undefined): {
  showNameConsent: boolean;
  displayName: string | null;
} {
  const consent = metadata?.showName === "1";
  return {
    showNameConsent: consent,
    displayName: consent ? firstNameOnly(metadata?.displayName) : null,
  };
}
