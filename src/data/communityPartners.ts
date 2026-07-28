// Community Partners — the public directory of local BUSINESSES that fund
// register items for mothers on Kradəl.
//
// ─────────────────────────────────────────────────────────────────────────
// DO NOT CONFUSE with referral partners in `src/lib/partners.ts`. Those are
// frontline organizations that vouch for and refer mothers (see /find-help).
// The entries here are DONORS — businesses whose money funds items. Separate
// concept, separate model, separate route (/community-partners).
// ─────────────────────────────────────────────────────────────────────────
//
// This hand-maintained file is the ENTIRE backend for this feature at this
// scale. There is no admin UI, no database model, and no migration. To add or
// update a partner, edit the array below and redeploy.
//
// BRAND-INTEGRITY RULE (non-negotiable):
//   Production renders ONLY entries with `live: true`. Seed/demo entries carry
//   `live: false` and are visible in development only, so the design can be
//   reviewed without ever showing fabricated businesses (fake social proof) to
//   the public. Flip `live` to true only for a REAL partner with REAL,
//   verifiable numbers.
//
// DIGNITY RULE: every field here is aggregate, process-level, business-facing.
// Never put a mother's story, a thank-you note, or any individual-level
// recipient detail into this data.

export interface CommunityPartnerFacts {
  /** Distinct families whose register items this business helped fund. */
  familiesSupported: number;
  /** Total individual register items funded. */
  itemsFunded: number;
  /** Total retail value contributed, in whole dollars. */
  dollarsContributed: number;
  /** Optional: share of funded items delivered within 72h, 0–100. */
  deliveredWithin72hPct?: number;
}

export interface CommunityPartnerTimelineEntry {
  /** Human-readable month label, e.g. "June 2026". */
  month: string;
  /** One process-level sentence. Aggregate facts only — no mother stories. */
  entry: string;
}

export interface CommunityPartner {
  /** URL segment for /community-partners/[slug]. Stable — QR codes point here. */
  slug: string;
  name: string;
  /** Business category, e.g. "Café", "Bookshop". */
  category: string;
  /** Service area, e.g. "Toronto, ON". */
  area: string;
  /** Month the business joined, e.g. "March 2026". Drives "Partner since". */
  joinedDate: string;
  /** Publicly visible in production only when true. */
  live: boolean;
  facts: CommunityPartnerFacts;
  /** Most-recent-first month-by-month impact. Aggregate/process language only. */
  timeline: CommunityPartnerTimelineEntry[];
  /** Optional business-owner quote. Never a mother's words. */
  ownerQuote?: string;
  /** ISO date (YYYY-MM-DD) a family was last supported. Powers the alive signal. */
  lastActiveDate: string;
}

// ── Seed entries ──────────────────────────────────────────────────────────
// Realistic demo data for design review. ALL `live: false` — never shown to
// the public. Replace with real partners (and set live: true) when they join.
export const COMMUNITY_PARTNERS: CommunityPartner[] = [
  {
    slug: "riverside-roasters",
    name: "Riverside Roasters",
    category: "Coffee roaster & café",
    area: "Toronto, ON",
    joinedDate: "March 2026",
    live: false,
    facts: {
      familiesSupported: 14,
      itemsFunded: 63,
      dollarsContributed: 4820,
      deliveredWithin72hPct: 91,
    },
    timeline: [
      { month: "July 2026", entry: "Funded 18 register items across 4 families." },
      { month: "June 2026", entry: "Funded 22 register items across 5 families." },
      { month: "May 2026", entry: "Funded 23 register items across 5 families." },
    ],
    ownerQuote:
      "We wanted our shop's giving to be specific and accountable, not a logo on a poster. Funding the exact items families asked for does that.",
    lastActiveDate: "2026-07-24",
  },
  {
    slug: "maple-lane-books",
    name: "Maple Lane Books",
    category: "Independent bookshop",
    area: "Hamilton, ON",
    joinedDate: "April 2026",
    live: false,
    facts: {
      familiesSupported: 9,
      itemsFunded: 41,
      dollarsContributed: 3110,
      deliveredWithin72hPct: 88,
    },
    timeline: [
      { month: "July 2026", entry: "Funded 15 register items across 3 families." },
      { month: "June 2026", entry: "Funded 14 register items across 3 families." },
      { month: "May 2026", entry: "Funded 12 register items across 3 families." },
    ],
    ownerQuote:
      "A register item is a real, measurable thing. Our staff like knowing the contribution lands as an actual delivery, not an estimate.",
    lastActiveDate: "2026-07-18",
  },
  {
    slug: "harbourview-dental",
    name: "Harbourview Dental",
    category: "Dental practice",
    area: "Toronto, ON",
    joinedDate: "May 2026",
    live: false,
    facts: {
      familiesSupported: 6,
      itemsFunded: 28,
      dollarsContributed: 2340,
    },
    timeline: [
      { month: "July 2026", entry: "Funded 11 register items across 2 families." },
      { month: "June 2026", entry: "Funded 17 register items across 4 families." },
    ],
    lastActiveDate: "2026-07-11",
  },
];

/**
 * The partners the current environment is allowed to render.
 * Production: only `live: true`. Development: everything, so the full design
 * is reviewable. This is the single gate that keeps demo businesses private.
 */
export function visibleCommunityPartners(): CommunityPartner[] {
  if (process.env.NODE_ENV === "production") {
    return COMMUNITY_PARTNERS.filter((p) => p.live);
  }
  return COMMUNITY_PARTNERS;
}

/** Look up one partner by slug, respecting environment visibility. */
export function getCommunityPartner(slug: string): CommunityPartner | undefined {
  return visibleCommunityPartners().find((p) => p.slug === slug);
}

export type CommunityPartnerSort = "recent" | "alphabetical";

/**
 * Sort a partner list. Only two orderings exist by design — recency of
 * `lastActiveDate` or alphabetical by name. No totals-sorting, no leaderboard,
 * no tiers/scores. These omissions are intentional, permanent decisions.
 */
export function sortCommunityPartners(
  partners: CommunityPartner[],
  sort: CommunityPartnerSort = "recent",
): CommunityPartner[] {
  const list = [...partners];
  if (sort === "alphabetical") {
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return list.sort(
    (a, b) => new Date(b.lastActiveDate).getTime() - new Date(a.lastActiveDate).getTime(),
  );
}

/** Whole-day count since a family was last supported, for the alive signal. */
export function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / 86_400_000));
}
