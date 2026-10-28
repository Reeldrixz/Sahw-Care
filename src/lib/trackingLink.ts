// Validation for an order's tracking link (step 9: fulfilment evidence).
//
// The streamer opens this link, so it must never reveal the mother. Only
// Amazon's own gift-view share links qualify. Raw carrier pages are refused:
// they show the delivery city and ZIP, sometimes a doorstep photo. Rules:
//   - https only, no username or password, no port.
//   - EXACT hostname match against the shapes below. Never a suffix, substring
//     or regex test, so a.co.evil.com, evil-a.co and amazon.ca.evil.com fail.
//     new URL() converts international domains to ASCII first, so a
//     lookalike can't equal an allowed host.
//   - a.co: path must start with /d/ (Amazon's share-tracking short link).
//   - amazon.ca: path must start with /progress-tracker/package/share and
//     the query must contain giftView=1 (the gift view hides prices and
//     the buyer's address).
// Anything else is refused. The server only parses the text and never fetches it.

type Shape = { hosts: ReadonlySet<string>; matches: (u: URL) => boolean };

const SHAPES: readonly Shape[] = [
  {
    hosts: new Set(["a.co"]),
    matches: (u) => u.pathname.startsWith("/d/") && u.pathname.length > "/d/".length,
  },
  {
    // www. is what Amazon's share button produces. It's an exact entry, not a subdomain rule.
    hosts: new Set(["amazon.ca", "www.amazon.ca"]),
    matches: (u) =>
      (u.pathname === "/progress-tracker/package/share" ||
        u.pathname.startsWith("/progress-tracker/package/share/")) &&
      u.searchParams.getAll("giftView").includes("1"),
  },
];

const MAX_URL_LEN = 2048;

export const TRACKING_LINK_HELP =
  "Place the order as a gift order and use Amazon's 'share tracking' to get the link.";

// Shown on the streamer's orders page.
export const STREAMER_TRACKING_NOTE =
  "Open tracking links in a private window, not on the broadcast screen. The page shows ads and your account details.";

// Shown in the admin queue next to the Delivered button.
export const DELIVERED_EVIDENCE_NOTE =
  "Mark Delivered only when this register's order page shows \"Delivered\".";

export type TrackingLinkResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export function validateTrackingUrl(raw: unknown): TrackingLinkResult {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: "Please paste the tracking link." };
  }
  const trimmed = raw.trim();
  if (trimmed.length > MAX_URL_LEN) {
    return { ok: false, error: "That link is too long." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "That doesn't look like a valid link." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "The link must start with https://" };
  }
  if (parsed.username || parsed.password || parsed.port) {
    return { ok: false, error: "That link isn't an Amazon share-tracking link." };
  }

  const host = parsed.hostname.toLowerCase();
  const shape = SHAPES.find((s) => s.hosts.has(host));
  if (!shape || !shape.matches(parsed)) {
    return {
      ok: false,
      error: `Only Amazon share-tracking links from a gift order are accepted (a.co/d/… or amazon.ca/progress-tracker/package/share…giftView=1). Carrier tracking pages aren't accepted. ${TRACKING_LINK_HELP}`,
    };
  }

  return { ok: true, url: parsed.toString() };
}
