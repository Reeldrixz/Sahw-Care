import { firstNameOnly } from "@/lib/eventEffects";

// The ONLY shape in which a celebration may leave the server for the overlay
// or any public page. Step 7's stream sends these, never EventCelebration or
// EventBundleUnlock rows.
//
// Guarantees, by construction:
//   - No register id, item id or unlock id, on any type. The only id is the
//     celebration's own, which the one overlay needs to claim it.
//   - A bundle celebration carries only its value and sponsor: it names no
//     mother, and it doesn't carry anything that points to her register.
//   - Names are first names only — the mother's and the donor's — cleaned
//     again here, whatever is passed in.

export type CelebrationRow = {
  id: string;
  type: "ITEM_FUNDED" | "ITEM_FUNDED_BY_ONE" | "REGISTER_COMPLETE" | "BUNDLE_UNLOCKED";
  donorDisplayName: string | null;
  motherName: string | null;     // her name as stored; only the first name is used
  itemName: string | null;
  bundle: { valueCents: number; sponsorName: string } | null;
};

export type PublicCelebration =
  | { id: string; type: "ITEM_FUNDED"; motherFirstName: string; itemName: string }
  | { id: string; type: "ITEM_FUNDED_BY_ONE"; motherFirstName: string; itemName: string; donorFirstName: string | null }
  | { id: string; type: "REGISTER_COMPLETE"; motherFirstName: string }
  | { id: string; type: "BUNDLE_UNLOCKED"; valueCents: number; sponsorName: string };

// Returns null when the row can't be shown safely (its register or item has
// gone, or a bundle row lost its unlock): showing nothing is always allowed.
export function toPublicCelebration(c: CelebrationRow): PublicCelebration | null {
  if (c.type === "BUNDLE_UNLOCKED") {
    return c.bundle ? { id: c.id, type: c.type, valueCents: c.bundle.valueCents, sponsorName: c.bundle.sponsorName } : null;
  }
  const motherFirstName = firstNameOnly(c.motherName);
  if (!motherFirstName) return null;
  if (c.type === "REGISTER_COMPLETE") return { id: c.id, type: c.type, motherFirstName };
  if (!c.itemName) return null;
  if (c.type === "ITEM_FUNDED") return { id: c.id, type: c.type, motherFirstName, itemName: c.itemName };
  return { id: c.id, type: c.type, motherFirstName, itemName: c.itemName, donorFirstName: firstNameOnly(c.donorDisplayName) };
}
