// Validation for the formula purchasing link (F2).
//
// A wrong link means the wrong formula bought every month, so this is a safety
// check, not a formatting nicety. Rules:
//   - https only (never javascript:/data:/http:) — the mother opens this link.
//   - EXACT hostname allowlist. Never a substring or regex test: a check like
//     url.includes("amazon.ca") would happily pass amazon.ca.evil.com.
//   - Full product URLs only. Shorteners (a.co, amzn.to) are rejected because
//     they hide the real listing from her, are marketplace-ambiguous, and make
//     the stored purchaseUrlAtPurchase audit trail unreadable.
//   - A real path, so a bare domain can't be saved as a "product".

const ALLOWED_HOSTS = new Set([
  "amazon.ca", "www.amazon.ca",
  "amazon.com", "www.amazon.com",
]);

const MAX_URL_LEN = 2000; // Amazon URLs are long, but not this long.

export type PurchaseLinkResult =
  | { ok: true;  url: string }
  | { ok: false; error: string };

export function validatePurchaseUrl(raw: unknown): PurchaseLinkResult {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, error: "Please paste the Amazon product link." };
  }
  const trimmed = raw.trim();
  if (trimmed.length > MAX_URL_LEN) {
    return { ok: false, error: "That link is too long. Paste the product URL without extra tracking text." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "That doesn't look like a valid link. Paste the full Amazon product URL." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "The link must start with https://" };
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    return {
      ok: false,
      error: "Only full amazon.ca or amazon.com product links are allowed. Shortened links (a.co, amzn.to) hide the real product — open the short link and copy the full URL from your browser instead.",
    };
  }
  if (parsed.pathname.length <= 1) {
    return { ok: false, error: "That's the Amazon homepage, not a product. Please paste the link to the exact product page." };
  }

  return { ok: true, url: parsed.toString() };
}
