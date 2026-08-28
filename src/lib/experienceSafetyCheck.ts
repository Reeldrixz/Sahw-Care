// The AI final gate for Experiences.
//
// This runs ONLY after a human reviewer has approved a post, as a second and
// independent check before it publishes. It is defense in depth: a hazard has to
// get past the human reading against the infant-safety checklist AND past this.
// Either one alone can stop a post.
//
// WHAT IT CAN AND CANNOT DO:
//   * It can say FLAG, which stops the publish and returns the post to the
//     reviewer with the passage highlighted.
//   * It can say PASS, which allows the human's approval to complete.
//   * It can do nothing else. It cannot decline, hold, send back, publish
//     anything a human did not approve, write a single word the author will
//     read, or contact her in any way.
//
// NEVER THROWS. Every failure path resolves to UNAVAILABLE, which the caller
// treats as fail-open: the post publishes, because the human is the primary
// gate and has already approved it, and one missing API key must not silently
// freeze every mother's post. The verdict is recorded either way, so a gate that
// stopped running is visible rather than silent.
//
// The hazard definitions come from SAFETY_CATEGORIES — the same structured data
// the human reviewer reads on screen. One source of truth, so the two gates
// cannot drift apart: editing a check updates both at once.

import { SAFETY_CATEGORIES, type SafetyCategoryCode } from "@/lib/experienceSafety";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const MAX_FIELD_INPUT = 4000;
const TIMEOUT_MS = 12_000;

export type AiVerdict = "PASS" | "FLAG" | "UNAVAILABLE";
export type FlaggedField = "situation" | "whatITried" | "takeaway";

export interface AiFlag {
  field: FlaggedField;
  /** Exact substring of the field, verified present before it is stored. */
  quote: string;
  hazard: SafetyCategoryCode;
  /** One line for the reviewer. Internal — never shown to the author. */
  why: string;
}

export interface AiCheckResult {
  verdict: AiVerdict;
  flags: AiFlag[];
  /** Short rationale for the reviewer, or the reason the check did not run. */
  note: string;
}

const FIELDS: FlaggedField[] = ["situation", "whatITried", "takeaway"];

// Built from the shared checklist so the AI is looking for exactly what the
// human is looking for.
function buildSystemPrompt(): string {
  const categories = SAFETY_CATEGORIES.filter((c) => c.isSafety)
    .map((c) => `${c.code} — ${c.label}\n${c.checks.map((x) => `  * ${x}`).join("\n")}`)
    .join("\n\n");

  return `You are the final safety check for "Experiences" on Kradel, a space where mothers write down what they learned for the mothers who come after them.

A human reviewer has ALREADY read this post and approved it. You are a second, independent check before it publishes. You are not replacing her judgement and you are not reviewing her work — you exist because two independent gates catch what one misses.

YOUR ONLY QUESTION: could a baby be harmed if another mother followed this exactly, at 3am, trusting it because someone who had been there wrote it?

Flag ONLY infant-safety hazards in these four categories:

${categories}

DO NOT FLAG:
- Tone, grammar, spelling, formatting, or length. A rambling, blunt, emotional or badly written experience is PASS.
- Advice that is merely unusual, unfashionable, culturally unfamiliar, or that you personally would not give.
- Honest description of something difficult — exhaustion, resentment, not bonding, feeding struggles, mental health. Mothers telling the truth about hard things is the entire point of this space.
- A mother describing that something unsafe happened to her or that she once did something unsafe, when she is NOT recommending it. Recounting is not advising.
- Anything that is unwise but carries no risk to an infant.

Being wrong in one direction wastes a reviewer's minute. Being wrong in the other direction can hurt a baby. But over-flagging trains reviewers to click past you, which costs the same safety in the end — so flag what is genuinely hazardous, not what is merely imperfect.

For each hazard, quote the EXACT substring from the field it appears in. Copy it character for character from the text you were given — do not paraphrase, correct, or shorten it. If you cannot quote it exactly, do not flag it.

Respond with ONLY a compact JSON object, no prose and no code fences:
{"verdict":"PASS"|"FLAG","flags":[{"field":"situation"|"whatITried"|"takeaway","quote":"<exact substring>","hazard":"UNSAFE_SLEEP"|"FEEDING"|"MEDICAL"|"HAZARDS","why":"<one short sentence for the reviewer>"}],"note":"<one sentence summary for the reviewer>"}

If nothing is hazardous, return {"verdict":"PASS","flags":[],"note":"..."}.`;
}

const VALID_HAZARDS = new Set(
  SAFETY_CATEGORIES.filter((c) => c.isSafety).map((c) => c.code as string)
);

/**
 * Pull a JSON object out of a model response.
 *
 * A prompt asking for bare JSON is a request, not a guarantee. Claude will
 * sometimes wrap the object in a ```json fence, or precede it with a line of
 * prose, and a strict JSON.parse turns that ordinary formatting variation into a
 * disabled safety gate — which is exactly what happened the first time this ran
 * against a real hazard. The parser has to be the guarantee.
 *
 * Two strategies, in order:
 *   1. Strip a surrounding markdown fence (```json … ``` or ``` … ```).
 *   2. Scan for the first balanced {…} block, tracking string literals and
 *      escapes so a brace or quote inside the mother's own quoted text cannot
 *      end the object early.
 *
 * Returns null when nothing object-shaped is present — including a truncated
 * response, where the braces never balance. That is the correct outcome: an
 * incomplete object must not be half-parsed into a verdict.
 *
 * Exported because reflectionModeration.ts parses model JSON the same bare way
 * and carries the identical latent failure.
 */
export function extractJsonObject(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  // 1. Fenced block. Takes the fence contents whatever the info string.
  const fenced = text.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)\n?\s*```/);
  const candidate = fenced ? fenced[1].trim() : text;
  if (candidate.startsWith("{") && candidate.endsWith("}")) return candidate;

  // 2. First balanced object, string-aware.
  const start = candidate.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];

    if (escaped) { escaped = false; continue; }
    if (ch === "\\" && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return candidate.slice(start, i + 1);
    }
  }

  // Braces never balanced — truncated or malformed.
  return null;
}

/**
 * Run the final safety check on an approved post. Always resolves; never throws.
 * UNAVAILABLE means the caller should publish anyway and record that the gate
 * did not run.
 */
export async function checkExperienceSafety(post: {
  situation: string;
  whatITried: string;
  takeaway: string;
}): Promise<AiCheckResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { verdict: "UNAVAILABLE", flags: [], note: "AI check not configured (no API key)." };
  }

  const fields: Record<FlaggedField, string> = {
    situation:  post.situation.slice(0, MAX_FIELD_INPUT),
    whatITried: post.whatITried.slice(0, MAX_FIELD_INPUT),
    takeaway:   post.takeaway.slice(0, MAX_FIELD_INPUT),
  };

  const userContent =
    `Check this experience.\n\n` +
    FIELDS.map((f) => `<${f}>\n${fields[f]}\n</${f}>`).join("\n\n");

  let raw: string;
  try {
    // A hung request must not hold the reviewer's approve open indefinitely.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key":         key,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 900,
        system: [{ type: "text", text: buildSystemPrompt(), cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: userContent }],
      }),
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      console.error("[experience-ai-gate] Anthropic error:", res.status, await res.text().catch(() => ""));
      return { verdict: "UNAVAILABLE", flags: [], note: `AI check failed (HTTP ${res.status}).` };
    }

    const data = await res.json();
    raw = (data?.content?.[0]?.text ?? "").trim();
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    console.error("[experience-ai-gate] call failed:", err);
    return {
      verdict: "UNAVAILABLE",
      flags: [],
      note: aborted ? "AI check timed out." : "AI check errored.",
    };
  }

  const json = extractJsonObject(raw);
  if (!json) {
    console.error("[experience-ai-gate] no JSON object in response:", raw.slice(0, 400));
    return {
      verdict: "UNAVAILABLE",
      flags: [],
      note: "AI check returned no readable result (no JSON object found — possibly truncated).",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    // Extraction found something object-shaped but it is not valid JSON. Logged
    // separately from the no-object case so the two are distinguishable later.
    console.error("[experience-ai-gate] extracted block failed to parse:", json.slice(0, 400));
    return { verdict: "UNAVAILABLE", flags: [], note: "AI check returned an unreadable result." };
  }

  const p = parsed as { verdict?: unknown; flags?: unknown; note?: unknown };
  const note = typeof p.note === "string" ? p.note.slice(0, 400) : "";

  // Every flag is validated against the real text. A quote the model invented,
  // or a hazard code it made up, is dropped rather than shown to a reviewer as
  // though it came from the post.
  const flags: AiFlag[] = Array.isArray(p.flags)
    ? (p.flags as unknown[]).flatMap((f) => {
        const o = f as { field?: unknown; quote?: unknown; hazard?: unknown; why?: unknown };
        const field  = o.field  as FlaggedField;
        const quote  = typeof o.quote === "string" ? o.quote.trim() : "";
        const hazard = o.hazard as SafetyCategoryCode;

        if (!FIELDS.includes(field)) return [];
        if (!VALID_HAZARDS.has(hazard as string)) return [];
        if (!quote || !fields[field].includes(quote)) {
          console.warn("[experience-ai-gate] dropped unverifiable quote:", quote.slice(0, 80));
          return [];
        }
        return [{
          field,
          quote,
          hazard,
          why: typeof o.why === "string" ? o.why.slice(0, 300) : "",
        }];
      })
    : [];

  // A FLAG verdict with nothing quotable left after validation is not actionable
  // — the reviewer would see "flagged" with no passage to look at. Treat it as a
  // pass and record why, rather than stopping a post on an unverifiable claim.
  if (p.verdict === "FLAG" && flags.length === 0) {
    return {
      verdict: "PASS",
      flags: [],
      note: `${note} (Flag dropped: no quote matched the post text.)`.trim(),
    };
  }

  return { verdict: p.verdict === "FLAG" ? "FLAG" : "PASS", flags, note };
}
