// The register title check, for anywhere a register's title leaves the server
// to someone other than her or an admin: search results here, and on the
// stripe-test branch the live event surfaces (lib/publicCelebration
// liveRegisterTitle, which adds a consent-version condition on top).
//
// IDENTICAL TO stripe-test's copy in lib/publicCelebration.ts. When the two
// branches meet, publicCelebration should import from here and drop its copy.
//
// A title is free text she typed. It is returned only if it doesn't look like
// it holds contact details, an address, her surname, a date, markup, or a
// blocklisted word; otherwise null, and callers show her first name only.
// Then it is trimmed to LIVE_TITLE_MAX characters with an ellipsis.

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
