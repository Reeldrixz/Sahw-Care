// Lightweight Claude API client for the register-intro copyedit.
// Uses a direct fetch to the Messages API so we don't add an SDK dependency.
// Requires ANTHROPIC_API_KEY in the environment.

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Haiku 4.5 — fast and inexpensive, which suits a light copyedit task.
const MODEL = "claude-haiku-4-5-20251001";

export const MAX_INTRO_INPUT = 1500;

// The system prompt is sent on every call, so we mark it for prompt caching
// (ephemeral) — repeated edits reuse the cached prefix.
const SYSTEM_PROMPT = `You are a gentle copy editor for Kradəl, a platform where mothers in need write a short intro for a baby-item register that donors will read.

Your ONLY job is to lightly copyedit the mother's own words:
- Fix spelling, grammar, and punctuation.
- Tighten lightly for concision and readability.
- Preserve her authentic voice, her exact wording wherever possible, her tone, and every specific detail she mentions.

You must NOT:
- Rewrite her text into a template, a marketing pitch, or a generic hardship story.
- Add facts, names, numbers, emotions, or details she did not write.
- Remove her specific details or flatten her individuality.
- Add greetings, sign-offs, headings, quotation marks, or commentary.
- Change first/third person or her point of view.

When in doubt, change less. If the text is already clean, return it nearly unchanged.
Output ONLY the edited intro text — no preamble, no explanation, no quotes around it.`;

export async function copyeditIntro(raw: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("AI editing is not configured");

  const text = raw.trim().slice(0, MAX_INTRO_INPUT);
  if (!text) throw new Error("Nothing to edit");

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key":         key,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 700,
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role:    "user",
          content: `Lightly copyedit this register intro. Return only the edited text:\n\n${text}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    // Don't leak provider internals to the client.
    console.error("Anthropic copyedit failed:", res.status, await res.text().catch(() => ""));
    throw new Error("The editor is unavailable right now. Please try again.");
  }

  const data = await res.json();
  const edited = (data?.content?.[0]?.text ?? "").trim();
  if (!edited) throw new Error("The editor returned nothing. Please try again.");

  return edited.slice(0, 2000);
}
