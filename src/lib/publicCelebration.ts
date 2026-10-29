import { firstNameOnly } from "@/lib/eventEffects";
import { hasCurrentFeatureConsent } from "@/lib/featureConsent";

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

// ── The recap: registers completed earlier in this event ────────────────────
// Public shape: a first name (or null, if it fails the name rule), her
// register's title when liveRegisterTitle (below) allows it, and one status.
// No id, no date, no place. Built by lib/eventRecap.

export type PublicRecapEntry = { firstName: string | null; title: string | null; status: "FUNDED" | "ORDERED" | "DELIVERED" };
export type PublicRecap = { entries: PublicRecapEntry[]; more: number };

const RECAP_STATUS_TEXT: Record<PublicRecapEntry["status"], string> = {
  FUNDED: "Funded ✓", ORDERED: "Order placed ✓", DELIVERED: "Delivered ✓",
};

// "Maryam · baby things for March — Order placed ✓", "Maryam — Order placed ✓"
// without a title, or "A mother — Funded ✓" without a valid name.
export function recapText(e: PublicRecapEntry): string {
  return `${liveNameLine(e.firstName, e.title)} — ${RECAP_STATUS_TEXT[e.status]}`;
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
      return { headline: p.motherFirstName ? `Everything ${p.motherFirstName} needed is funded` : "A Register is fully funded", line: "Fully funded ✓" };
    case "BUNDLE_UNLOCKED":
      return {
        headline: "Sponsor bundle unlocked",
        line: p.sponsorLine ? `~$${Math.round(p.sponsorLine.valueCents / 100)} additional support from ${p.sponsorLine.sponsorName}` : null,
      };
  }
}

// ── The register's title on live surfaces ───────────────────────────────────
// Shown next to her first name, "Idris · baby things for March", wherever a
// featured register appears live: the overlay strip and recap, the host
// dashboard, the streamer's orders page and the "Fully funded this event"
// list. Every one of those payloads takes the title from liveRegisterTitle
// and nowhere else.
//
// Only with her CURRENT live-feature consent (the version 3 card says the
// title is shown). Without it the title is left out entirely, so a mother who
// withdrew while on screen keeps only her first name.
//
// A title is free text she typed, so it is checked before it goes on air. If
// it fails, or is empty, only her first name is shown. It fails if it holds
// anything that looks like:
//   - contact details: an email, a web address, a phone number;
//   - an address: a postal or ZIP code, a street number with a street word;
//   - her surname (any part of her name after the first);
//   - a due date: a day with a month ("March 14", "14/3", "2027-03-14").
//     A month on its own ("for March") is fine;
//   - markup or control characters;
//   - a word on the blocklist below.
// Then it is cut to LIVE_TITLE_MAX characters with an ellipsis.


// 32 characters, ellipsis included. On the 1920×1080 overlay the strip's name
// column is 220px wide, so at 15px that is at most two lines under her name;
// the recap runs five entries on one line across the band, and 32 keeps
// "Name · title — Order placed ✓" around 50 characters each.
export const LIVE_TITLE_MAX = 32;

const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const REJECT: RegExp[] = [
  /@/,                                                          // email
  /\b(?:https?:\/\/|www\.)|\.(?:com|ca|net|org|ng|io|co)\b/i,   // web address
  /(?:\d[\s().-]*){7,}/,                                        // phone (7+ digits)
  /\b[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d\b/,                    // Canadian postal code
  /\b\d{5}(?:-\d{4})?\b/,                                       // ZIP code
  /\b\d+\s+\w+\s+(?:st|street|ave|avenue|rd|road|blvd|dr|drive|cres|crescent|close|lane|ln|way|court|ct)\b/i, // street
  new RegExp(String.raw`\b${MONTH}\.?\s+\d{1,2}(?:st|nd|rd|th)?\b`, "i"),           // March 14
  new RegExp(String.raw`\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH}\b`, "i"),   // 14 March
  /\b\d{1,4}[/.-]\d{1,2}(?:[/.-]\d{1,4})?\b/,                   // 14/3, 2027-03-14
  /[<>{}[\]\\`]|[\u0000-\u001F\u007F]/,                         // markup, control
];
// Kept short and literal: whole words only, case-insensitive.
const BLOCKED_WORDS = [
  "fuck", "fucking", "fuckin", "fucked", "fucker", "motherfucker", "shit", "shitty", "bullshit",
  "bitch", "bitches", "cunt", "dick", "dickhead", "pussy", "asshole", "bastard", "whore", "slut",
  "nigger", "nigga", "faggot", "retard", "kike", "spic", "chink", "tranny",
  "cashapp", "venmo", "paypal", "etransfer", "e-transfer", "gofundme", "whatsapp", "telegram", "instagram",
];
// "-" isn't escaped: in unicode mode "\-" is only valid inside a class.
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// A whole word: not inside a longer word (letters on either side).
const wholeWord = (w: string) => new RegExp(String.raw`(?:^|[^\p{L}])${escapeRe(w)}(?:$|[^\p{L}])`, "iu");
const BLOCKED = new RegExp(String.raw`(?:^|[^\p{L}])(?:${BLOCKED_WORDS.map(escapeRe).join("|")})(?:$|[^\p{L}])`, "iu");

export function checkLiveTitle(raw: string | null | undefined, motherName: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (!t) return null;
  if (REJECT.some((r) => r.test(t)) || BLOCKED.test(t)) return null;
  // Her surname, or any later part of her name, anywhere in the title.
  const parts = (motherName ?? "").normalize("NFC").trim().split(/\s+/u).slice(1).filter((p) => p.length >= 2);
  const lower = t.toLocaleLowerCase();
  if (parts.some((p) => wholeWord(p.toLocaleLowerCase()).test(lower))) return null;
  return trimLiveTitle(t);
}

// At most LIVE_TITLE_MAX characters (graphemes), ellipsis included; cut at a
// word break when there is one in the last third.
export function trimLiveTitle(t: string): string {
  const g = Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(t), (s) => s.segment);
  if (g.length <= LIVE_TITLE_MAX) return t;
  let cut = g.slice(0, LIVE_TITLE_MAX - 1).join("");
  const space = cut.lastIndexOf(" ");
  if (space >= Math.floor((LIVE_TITLE_MAX * 2) / 3)) cut = cut.slice(0, space);
  return `${cut.replace(/[\s,;:·—-]+$/u, "")}…`;
}

// The one place a live payload gets a register's title.
export function liveRegisterTitle(r: {
  title: string | null | undefined; motherName: string | null | undefined;
  featureConsent: boolean; featureConsentVersion: number | null;
}): string | null {
  if (!hasCurrentFeatureConsent(r)) return null;
  return checkLiveTitle(r.title, r.motherName);
}

// "Idris · baby things for March", or just the name when there is no title.
export function liveNameLine(firstName: string | null, title: string | null): string {
  const name = firstName ?? "A mother";
  return title ? `${name} · ${title}` : name;
}
