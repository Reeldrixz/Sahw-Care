const BLOCKED_PHRASES = [
  "need diapers",
  "please give",
  "can anyone donate",
  "looking for",
  "can i have",
  "anyone giving away",
];

/**
 * Returns the matched phrase if content violates community rules, null if clean.
 */
export function checkCircleContent(content: string): string | null {
  const lower = content.toLowerCase();
  for (const phrase of BLOCKED_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}
