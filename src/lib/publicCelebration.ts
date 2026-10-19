import { firstNameOnly } from "@/lib/eventEffects";

// The ONLY shape in which a celebration may leave the server for the overlay
// or any public page. The overlay frame (lib/overlayFrame) sends these, never
// EventCelebration or EventBundleUnlock rows.
//
// Guarantees, by construction:
//   - No ids at all: not the register's, the item's, the unlock's, or even the
//     celebration's own. The overlay never needs one — the server claims the
//     celebration and hands it over once.
//   - A bundle celebration names no mother and carries nothing that points to
//     her register: only the sponsor line, and only while the event's sponsor
//     is confirmed (sponsorConfirmedAt). Without it, just the generic moment.
//   - Names are first names only — the mother's and the donor's — cleaned
//     again here with the name rule. A mother whose first name fails the rule
//     still gets her celebration, with generic wording and no name: a
//     celebration is NEVER dropped.
//   - The donor's name follows the host's hideDonorNames switch AT THE MOMENT
//     OF SHOWING, not when the celebration was created: switching it on
//     mid-stream removes names from everything still queued.

export type CelebrationRow = {
  type: "ITEM_FUNDED" | "ITEM_FUNDED_BY_ONE" | "REGISTER_COMPLETE" | "BUNDLE_UNLOCKED";
  donorDisplayName: string | null;
  motherName: string | null;     // as stored; only a valid first name is used
  itemName: string | null;
  bundle: { valueCents: number; sponsorName: string } | null;
};

// Read from the event when the celebration is shown.
export type ShowTimeSettings = { hideDonorNames: boolean; sponsorConfirmed: boolean };

export type PublicCelebration =
  | { type: "ITEM_FUNDED"; motherFirstName: string | null; itemName: string | null }
  | { type: "ITEM_FUNDED_BY_ONE"; motherFirstName: string | null; itemName: string | null; donorFirstName: string | null }
  | { type: "REGISTER_COMPLETE"; motherFirstName: string | null }
  | { type: "BUNDLE_UNLOCKED"; sponsorLine: { valueCents: number; sponsorName: string } | null };

export function toPublicCelebration(c: CelebrationRow, at: ShowTimeSettings): PublicCelebration {
  if (c.type === "BUNDLE_UNLOCKED") {
    return {
      type: c.type,
      sponsorLine: at.sponsorConfirmed && c.bundle
        ? { valueCents: c.bundle.valueCents, sponsorName: c.bundle.sponsorName }
        : null,
    };
  }
  const motherFirstName = firstNameOnly(c.motherName);
  if (c.type === "REGISTER_COMPLETE") return { type: c.type, motherFirstName };
  if (c.type === "ITEM_FUNDED") return { type: c.type, motherFirstName, itemName: c.itemName };
  return {
    type: c.type, motherFirstName, itemName: c.itemName,
    donorFirstName: at.hideDonorNames ? null : firstNameOnly(c.donorDisplayName),
  };
}

// The words the overlay shows, with generic wording wherever a name is
// missing or withheld. Kept here, next to the shape, so the screen and the
// tests agree on exactly what is said on air.
export function celebrationText(p: PublicCelebration): { headline: string; line: string | null } {
  switch (p.type) {
    case "ITEM_FUNDED": {
      const what = p.itemName ?? "An item";
      return { headline: p.motherFirstName ? `${p.motherFirstName}'s ${what.toLowerCase()} funded ✓` : `${what} funded ✓`, line: null };
    }
    case "ITEM_FUNDED_BY_ONE": {
      const what = p.itemName ? (p.motherFirstName ? `${p.motherFirstName}'s ${p.itemName.toLowerCase()}` : p.itemName.toLowerCase()) : "an item";
      return {
        headline: p.donorFirstName ? `${p.donorFirstName} funded ${what} ✓` : `${what.charAt(0).toUpperCase()}${what.slice(1)} funded ✓`,
        line: null,
      };
    }
    case "REGISTER_COMPLETE":
      return { headline: p.motherFirstName ? `Everything ${p.motherFirstName} needed` : "A Register is fully funded", line: "Fully funded ✓" };
    case "BUNDLE_UNLOCKED":
      return {
        headline: "Sponsor bundle unlocked",
        line: p.sponsorLine ? `~$${Math.round(p.sponsorLine.valueCents / 100)} additional support from ${p.sponsorLine.sponsorName}` : null,
      };
  }
}
