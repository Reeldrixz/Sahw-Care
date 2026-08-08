// AI-assisted moderation for Reflections. ADVISORY ONLY: these flags help the
// admin review a reflection; they never auto-publish or auto-reject. Every
// reflection goes to the human review queue regardless of the result here.
//
// Two categories:
//   (a) nonReflective — donation/item requests, spam, off-topic, not a genuine
//       reflection on the mother's own experience/state of mind.
//   (b) crisis        — self-harm, abuse disclosure, or acute distress that
//       needs real support, not just a place to post.
//
// If the AI is unavailable (no ANTHROPIC_API_KEY, or the call fails), we degrade
// safely: the keyword filter still runs, crisis defaults to false, and the
// reflection still lands in the admin queue for a human to read.

import { checkCircleContent } from "@/lib/circleFilter";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_INPUT = 6000;

export interface ReflectionFlags {
  nonReflective: boolean;
  crisis: boolean;
  note: string; // short rationale for the admin; never shown to the mother
}

const SYSTEM_PROMPT = `You are a careful content classifier for "Reflections", a private, mother-only space where mothers write about their own experience and state of mind at their stage of pregnancy or early motherhood. You assist a human moderator; you never make final decisions.

Classify the reflection on TWO independent axes:

1. "nonReflective": true if the text is NOT a genuine personal reflection, e.g. it is a request for donations or specific items, an advertisement or spam, a link-farm, or clearly off-topic content unrelated to the writer's own experience or feelings. A heartfelt, rambling, or emotional personal reflection is NOT nonReflective.

2. "crisis": true if the text suggests the writer may need urgent real-world support, e.g. thoughts of self-harm or suicide, wanting to die, harming herself or her baby, disclosure of abuse or violence, or acute distress that reads as a cry for help. When genuinely unsure but the text hints at serious distress, lean true. Ordinary sadness, exhaustion, frustration, or normal postpartum struggle is NOT by itself a crisis.

Respond with ONLY a compact JSON object, no prose, no code fences:
{"nonReflective": boolean, "crisis": boolean, "note": "one short sentence for the human moderator"}`;

/**
 * Run the keyword filter plus (if configured) an AI classification. Always
 * resolves; never throws. The result is advisory input for admin review.
 */
export async function checkReflection(title: string, body: string): Promise<ReflectionFlags> {
  const combined = `${title}\n\n${body}`.trim();

  // Keyword filter (donation/request language) — cheap, always runs.
  const keywordHit = checkCircleContent(combined);
  const base: ReflectionFlags = {
    nonReflective: !!keywordHit,
    crisis: false,
    note: keywordHit ? `Keyword match: "${keywordHit}".` : "",
  };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { ...base, note: `${base.note} AI check unavailable (not configured).`.trim() };
  }

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [
          { role: "user", content: `Classify this reflection:\n\nTitle: ${title}\n\nBody:\n${body.slice(0, MAX_INPUT)}` },
        ],
      }),
    });

    if (!res.ok) {
      console.error("Reflection AI check failed:", res.status);
      return { ...base, note: `${base.note} AI check unavailable (error).`.trim() };
    }

    const data = await res.json();
    const raw = (data?.content?.[0]?.text ?? "").trim();
    const parsed = JSON.parse(raw) as { nonReflective?: boolean; crisis?: boolean; note?: string };

    return {
      // OR the keyword hit with the AI judgment so a keyword match is never lost.
      nonReflective: base.nonReflective || parsed.nonReflective === true,
      crisis: parsed.crisis === true,
      note: [base.note, typeof parsed.note === "string" ? parsed.note : ""].filter(Boolean).join(" ").slice(0, 300),
    };
  } catch (err) {
    console.error("Reflection AI check errored:", err);
    return { ...base, note: `${base.note} AI check unavailable (exception).`.trim() };
  }
}
