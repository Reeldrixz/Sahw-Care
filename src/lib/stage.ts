export type StageKey =
  | "pregnancy-0-3"
  | "pregnancy-4-6"
  | "pregnancy-7-9"
  | "postpartum-0-3"
  | "postpartum-4-6"
  | "postpartum-7-12"
  | "postpartum-13-24";

export const STAGE_META: Record<StageKey, { label: string; description: string }> = {
  "pregnancy-0-3":    { label: "The Quiet Beginning",  description: "0–3 months pregnant · First trimester"    },
  "pregnancy-4-6":    { label: "Growing Into It",      description: "4–6 months pregnant · Second trimester"   },
  "pregnancy-7-9":    { label: "Almost There",         description: "7–9 months pregnant · Third trimester"    },
  "postpartum-0-3":   { label: "The Golden Hours",     description: "Newborn stage · Baby 0–3 months"          },
  "postpartum-4-6":   { label: "Finding Your Rhythm",  description: "Infant stage · Baby 4–6 months"           },
  "postpartum-7-12":  { label: "Into the World",       description: "Infant stage · Baby 7–12 months"          },
  "postpartum-13-24": { label: "Little Steps",         description: "Toddler stage · Baby 1–2 years"           },
};

/** The 7 cohort circles with their sub-channel definitions. */
export const COHORT_CIRCLES = [
  {
    stageKey: "pregnancy-0-3" as StageKey,
    label: "The Quiet Beginning",
    emoji: "",
    groupLetter: "A",
    channels: [
      { name: "Body Changes",            emoji: "🤱", order: 1 },
      { name: "Food & Diet",             emoji: "🍽️", order: 2 },
      { name: "Emotions & Mental Health", emoji: "🧠", order: 3 },
      { name: "Doctor & Health",         emoji: "🏥", order: 4 },
      { name: "General Chat",            emoji: "💬", order: 5 },
    ],
  },
  {
    stageKey: "pregnancy-4-6" as StageKey,
    label: "Growing Into It",
    emoji: "",
    groupLetter: "A",
    channels: [
      { name: "Body Changes",            emoji: "🤱", order: 1 },
      { name: "Food & Diet",             emoji: "🍽️", order: 2 },
      { name: "Emotions & Mental Health", emoji: "🧠", order: 3 },
      { name: "Doctor & Health",         emoji: "🏥", order: 4 },
      { name: "General Chat",            emoji: "💬", order: 5 },
    ],
  },
  {
    stageKey: "pregnancy-7-9" as StageKey,
    label: "Almost There",
    emoji: "",
    groupLetter: "A",
    channels: [
      { name: "Body Changes",            emoji: "🤱", order: 1 },
      { name: "Food & Diet",             emoji: "🍽️", order: 2 },
      { name: "Emotions & Mental Health", emoji: "🧠", order: 3 },
      { name: "Doctor & Health",         emoji: "🏥", order: 4 },
      { name: "General Chat",            emoji: "💬", order: 5 },
    ],
  },
  {
    stageKey: "postpartum-0-3" as StageKey,
    label: "The Golden Hours",
    emoji: "",
    groupLetter: "A",
    channels: [
      { name: "Recovery & Wellness", emoji: "💪", order: 1 },
      { name: "Feeding",             emoji: "🍼", order: 2 },
      { name: "Sleep",               emoji: "😴", order: 3 },
      { name: "Baby Development",    emoji: "🌱", order: 4 },
      { name: "General Chat",        emoji: "💬", order: 5 },
    ],
  },
  {
    stageKey: "postpartum-4-6" as StageKey,
    label: "Finding Your Rhythm",
    emoji: "",
    groupLetter: "A",
    channels: [
      { name: "Recovery & Wellness", emoji: "💪", order: 1 },
      { name: "Feeding",             emoji: "🍼", order: 2 },
      { name: "Sleep",               emoji: "😴", order: 3 },
      { name: "Baby Development",    emoji: "🌱", order: 4 },
      { name: "General Chat",        emoji: "💬", order: 5 },
    ],
  },
  {
    stageKey: "postpartum-7-12" as StageKey,
    label: "Into the World",
    emoji: "",
    groupLetter: "A",
    channels: [
      { name: "Recovery & Wellness", emoji: "💪", order: 1 },
      { name: "Feeding",             emoji: "🍼", order: 2 },
      { name: "Sleep",               emoji: "😴", order: 3 },
      { name: "Baby Development",    emoji: "🌱", order: 4 },
      { name: "General Chat",        emoji: "💬", order: 5 },
    ],
  },
  {
    stageKey: "postpartum-13-24" as StageKey,
    label: "Little Steps",
    emoji: "",
    groupLetter: "A",
    channels: [
      { name: "Recovery & Wellness", emoji: "💪", order: 1 },
      { name: "Feeding",             emoji: "🍼", order: 2 },
      { name: "Sleep",               emoji: "😴", order: 3 },
      { name: "Baby Development",    emoji: "🌱", order: 4 },
      { name: "General Chat",        emoji: "💬", order: 5 },
    ],
  },
];

const MS_PER_WEEK  = 7  * 24 * 60 * 60 * 1000;
const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;

/**
 * Calculate the user's stage key from their journey data.
 * Returns null if not enough info to determine stage.
 */
export function calculateStage(
  journeyType: "pregnant" | "postpartum",
  dueDate?: Date | null,
  babyBirthDate?: Date | null,
): StageKey | null {
  const now = new Date();

  if (journeyType === "pregnant" && dueDate) {
    const weeksUntilDue  = (dueDate.getTime() - now.getTime()) / MS_PER_WEEK;
    const weeksPregnant  = Math.max(0, 40 - weeksUntilDue);
    if (weeksPregnant <= 13) return "pregnancy-0-3";
    if (weeksPregnant <= 26) return "pregnancy-4-6";
    return "pregnancy-7-9";
  }

  if (journeyType === "postpartum" && babyBirthDate) {
    const monthsOld = (now.getTime() - babyBirthDate.getTime()) / MS_PER_MONTH;
    if (monthsOld <= 3)  return "postpartum-0-3";
    if (monthsOld <= 6)  return "postpartum-4-6";
    if (monthsOld <= 12) return "postpartum-7-12";
    return "postpartum-13-24";
  }

  return null;
}

/** Convert ISO 3166-1 alpha-2 country code to flag emoji using regional indicator symbols. */
export function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return "";
  const upper = code.toUpperCase();
  // Regional Indicator A = U+1F1E6 = \uD83C\uDDE6
  return String.fromCodePoint(
    0x1f1e6 + upper.charCodeAt(0) - 65,
    0x1f1e6 + upper.charCodeAt(1) - 65,
  );
}

/** Best-effort country name → ISO alpha-2 code lookup. */
const COUNTRY_MAP: Record<string, string> = {
  "Nigeria": "NG", "United Kingdom": "GB", "United States": "US", "United States of America": "US",
  "Canada": "CA", "Ghana": "GH", "Kenya": "KE", "South Africa": "ZA",
  "Australia": "AU", "Germany": "DE", "France": "FR", "India": "IN",
  "Brazil": "BR", "Mexico": "MX", "Italy": "IT", "Spain": "ES",
  "Netherlands": "NL", "Sweden": "SE", "Norway": "NO", "Denmark": "DK",
  "UAE": "AE", "United Arab Emirates": "AE", "Saudi Arabia": "SA",
  "Egypt": "EG", "Ethiopia": "ET", "Tanzania": "TZ", "Uganda": "UG",
  "Rwanda": "RW", "Cameroon": "CM", "Senegal": "SN", "Zimbabwe": "ZW",
  "Zambia": "ZM", "Malawi": "MW", "Mozambique": "MZ", "Angola": "AO",
  "Ireland": "IE", "Portugal": "PT", "Belgium": "BE", "Switzerland": "CH",
  "Austria": "AT", "Poland": "PL", "Romania": "RO", "Hungary": "HU",
  "Philippines": "PH", "Indonesia": "ID", "Malaysia": "MY", "Singapore": "SG",
  "Thailand": "TH", "Vietnam": "VN", "Bangladesh": "BD", "Pakistan": "PK",
  "Sri Lanka": "LK", "New Zealand": "NZ", "Jamaica": "JM", "Trinidad and Tobago": "TT",
  "Ivory Coast": "CI", "Côte d'Ivoire": "CI", "Democratic Republic of the Congo": "CD",
  "Congo": "CG", "Liberia": "LR", "Sierra Leone": "SL", "Burkina Faso": "BF",
  "Mali": "ML", "Niger": "NE", "Chad": "TD", "Sudan": "SD", "Somalia": "SO",
  "Morocco": "MA", "Tunisia": "TN", "Algeria": "DZ", "Libya": "LY",
  "Japan": "JP", "South Korea": "KR", "China": "CN", "Taiwan": "TW",
  "Hong Kong": "HK", "Israel": "IL", "Turkey": "TR", "Iran": "IR",
  "Iraq": "IQ", "Jordan": "JO", "Lebanon": "LB",
};

export function countryNameToCode(name: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  return COUNTRY_MAP[trimmed] ?? null;
}

/** Extract last comma-segment as country from "City, Country" location string. */
export function extractCountryFromLocation(location: string | null): string | null {
  if (!location?.trim()) return null;
  const parts = location.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? null;
}
