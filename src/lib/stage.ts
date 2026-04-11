export type StageKey =
  | "pregnancy-0-3"
  | "pregnancy-4-6"
  | "pregnancy-7-9"
  | "postpartum-0-3"
  | "postpartum-4-6"
  | "postpartum-7-12"
  | "postpartum-13-24";

export const STAGE_META: Record<StageKey, { label: string; emoji: string }> = {
  "pregnancy-0-3":    { label: "0–3 Months Pregnant",       emoji: "🤰" },
  "pregnancy-4-6":    { label: "4–6 Months Pregnant",       emoji: "🤰" },
  "pregnancy-7-9":    { label: "7–9 Months Pregnant",       emoji: "🤰" },
  "postpartum-0-3":   { label: "Newborn Stage (0–3 months)", emoji: "👶" },
  "postpartum-4-6":   { label: "Infant Stage (4–6 months)",  emoji: "🍼" },
  "postpartum-7-12":  { label: "Infant Stage (7–12 months)", emoji: "🍼" },
  "postpartum-13-24": { label: "Toddler Stage (1–2 years)",  emoji: "🧸" },
};

/** The 7 cohort circles with their sub-channel definitions. */
export const COHORT_CIRCLES = [
  {
    stageKey: "pregnancy-0-3" as StageKey,
    label: "0–3 Months Pregnant",
    emoji: "🤰",
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
    label: "4–6 Months Pregnant",
    emoji: "🤰",
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
    label: "7–9 Months Pregnant",
    emoji: "🤰",
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
    label: "Newborn Stage (0–3 months)",
    emoji: "👶",
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
    label: "Infant Stage (4–6 months)",
    emoji: "🍼",
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
    label: "Infant Stage (7–12 months)",
    emoji: "🍼",
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
    label: "Toddler Stage (1–2 years)",
    emoji: "🧸",
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

/** Convert ISO 3166-1 alpha-2 country code to flag emoji. */
export function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return "";
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
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
