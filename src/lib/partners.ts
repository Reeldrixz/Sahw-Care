// Referral partners shown on the public /find-help directory.
//
// These are the frontline organizations that refer and vet mothers into Kradəl.
// This file holds ORG-LEVEL information ONLY — never any mother / recipient data.
//
// Grouped by `city` from the start so the directory scales to more cities later.
// In beta there is a single Toronto partner. To add a city, add entries with a
// new `city` value — the page groups automatically.
//
// NOTE FOR THE KRADƏL TEAM: replace the placeholder Toronto partner below with
// the real beta partner's published contact details before going live.

export interface ReferralPartner {
  id:         string;
  orgName:    string;
  city:       string;
  whatTheyDo: string;            // org-level description of who they serve / what they offer
  howToReach: string;            // a short, warm sentence on how to get in touch
  email?:     string;
  phone?:     string;
  website?:   string;
}

export const REFERRAL_PARTNERS: ReferralPartner[] = [
  {
    id:         "toronto-beta",
    orgName:    "Toronto Family Resource Partner",
    city:       "Toronto",
    whatTheyDo:
      "A frontline community organization supporting expecting and new mothers across Toronto with practical help, referrals, and a caring point of contact.",
    howToReach:
      "Reach out to their intake team and mention that you'd like to be connected to Kradəl — they'll take it from there.",
    email:      "hello@kradel.care",
    website:    "https://sahw-care.vercel.app",
  },
];

/**
 * Partners grouped by city, with cities sorted alphabetically and partners
 * sorted by name within each city. Org-level data only.
 */
export function partnersByCity(): [string, ReferralPartner[]][] {
  const map = new Map<string, ReferralPartner[]>();
  for (const p of REFERRAL_PARTNERS) {
    const arr = map.get(p.city) ?? [];
    arr.push(p);
    map.set(p.city, arr);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([city, list]) => [city, list.sort((a, b) => a.orgName.localeCompare(b.orgName))] as [string, ReferralPartner[]]);
}
