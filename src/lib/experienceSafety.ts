// Single source of truth for the Experiences review queue: the infant-safety
// reviewer checklist, and every word that reaches the author of a post or
// comment that is not published.
//
// Two principles, both load-bearing:
//
//   1. THE CHECKLIST IS BUILT AROUND INFANT SAFETY, NOT TONE.
//      This is not a spam queue. A rambling, badly written, unpopular or
//      unfashionable experience is publishable. A beautifully written one that
//      tells a mother to put her baby on its stomach is not. The reviewer is
//      looking for what could hurt a baby if another mother follows it exactly
//      — which is what mothers do at 3am with something written by someone who
//      has been there.
//
//   2. THE MOTHER-FACING COPY IS PRE-WRITTEN, NOT IMPROVISED.
//      Every decline message below is fixed text. The admin chooses a category;
//      they do not compose the message. This is deliberate: improvised decline
//      copy is exactly where shaming creeps in — at 11pm, on the fortieth
//      review, when the reviewer is tired and the post is frustrating. Fixing
//      the words makes warmth structural instead of dependent on mood.
//
//      Every message holds the same line: it is about the guidance, not about
//      her or how she mothered. Most of these mothers were told the old advice
//      by someone they trusted. None of them are told here that they were
//      wrong, that their advice was dangerous, or that they put a baby at risk.
//
// reviewNote (internal) and the copy here (mother-facing) must never merge.
// Collapsing them is how moderation language reaches the person it is about.

import { CRISIS_SUPPORT_MESSAGE } from "@/lib/reflectionSupport";

// Re-exported so the review queue has one import for all author-facing copy.
// The crisis message itself lives with the other crisis resources so there is
// exactly one version of it across every surface that reaches a mother in
// crisis. It is sent with HELD_FOR_SUPPORT, which is not a rejection.
export { CRISIS_SUPPORT_MESSAGE };

export type SafetyCategoryCode =
  | "UNSAFE_SLEEP"
  | "FEEDING"
  | "MEDICAL"
  | "HAZARDS"
  | "NOT_AN_EXPERIENCE";

export interface SafetyCategory {
  code: SafetyCategoryCode;
  /** Queue UI label. */
  label: string;
  /** One line telling the reviewer what this category is actually for. */
  reviewerBlurb: string;
  /** The concrete things to look for. Rendered as the checklist. */
  checks: string[];
  /** Fixed, warm, non-shaming copy sent to the author. Never edited per-review. */
  messageForAuthor: string;
  /** True for the four infant-safety categories; false for "not a fit". */
  isSafety: boolean;
}

export const SAFETY_CATEGORIES: SafetyCategory[] = [
  {
    code: "UNSAFE_SLEEP",
    label: "Unsafe sleep",
    isSafety: true,
    reviewerBlurb:
      "Anything that would change how a baby is put down to sleep. The guidance here has moved within these mothers' own lifetimes, so old advice arrives sincerely.",
    checks: [
      "Stomach or side sleeping, including “she only settles on her tummy”",
      "Co-sleeping positioning presented as safe, or how-to detail for bed-sharing",
      "Soft bedding: pillows, duvets, bumpers, loose blankets, stuffed toys in the cot",
      "Sleep positioners, wedges, nests, hammocks, or propping for reflux",
      "Sleeping in a car seat, swing, or bouncer outside of travel",
      "Overheating: heavy layers, hats indoors, warm room framed as helpful",
    ],
    messageForAuthor: [
      "We couldn't publish this one.",
      "",
      "What you wrote touches on infant sleep, and the guidance there has changed a great deal — including within the time most of us have been mothers. We hold this space strictly to the current version, because someone reading at 3am will take what she finds here as settled.",
      "",
      "That's about the guidance, not about you or how you mothered. Most of us were told something different, by people we had every reason to trust.",
      "",
      "You're welcome to write again whenever you'd like to.",
    ].join("\n"),
  },
  {
    code: "FEEDING",
    label: "Feeding danger",
    isSafety: true,
    reviewerBlurb:
      "Feeding detail where a small error carries real risk. Stretching formula in particular is often shared as a money-saving kindness.",
    checks: [
      "Formula dilution — extra water, stretching a tin, making it last",
      "Over-concentration — extra scoops to fill her up or help her sleep",
      "Unsafe preparation: water temperature, unboiled water, scoop measuring",
      "Unsafe storage: reusing a made bottle, leaving one out, reheating",
      "Honey before 12 months, in any form",
      "Solids before around 6 months, including cereal in a bottle",
      "Bottle propping, or a bottle left with a baby lying down or asleep",
      "Cow's milk, plant milks, or water as a formula substitute under 12 months",
    ],
    messageForAuthor: [
      "We couldn't publish this one.",
      "",
      "What you wrote touches on infant feeding, where small details — how formula is measured and mixed, how it's stored, when certain foods become safe — carry more risk than they look like they do. We hold this space strictly to current guidance, because someone will follow what she reads here exactly.",
      "",
      "That's about the guidance, not about you. If any of this came from stretching what you had, we understand that more than most, and it isn't something we'd ever hold against you.",
      "",
      "You're welcome to write again whenever you'd like to.",
    ].join("\n"),
  },
  {
    code: "MEDICAL",
    label: "Medical",
    isSafety: true,
    reviewerBlurb:
      "Anything that could delay care or put a number on a dose. The risk is a mother waiting when she should have gone in.",
    checks: [
      "Specific medication doses, amounts, or intervals — for baby or mother",
      "“Wait it out” for fever, especially under 3 months",
      "“Wait it out” for dehydration, jaundice, breathing difficulty, or a limp baby",
      "Anything positioned as an alternative to urgent or emergency care",
      "Naming a condition, or telling another mother what her baby has",
      "Stopping or changing prescribed treatment",
      "Herbal or home remedies given to a baby internally",
    ],
    messageForAuthor: [
      "We couldn't publish this one.",
      "",
      "What you wrote reaches into medical territory — the kind that depends on one particular baby, seen by someone who can actually examine them. We keep this space clear of it, because a mother reading here can't be assessed, and the risk is that she waits when she shouldn't.",
      "",
      "That's about what this space can safely hold, not about you or what you went through. What you learned is real; it just needs to reach her from someone who can see her baby.",
      "",
      "You're welcome to write again whenever you'd like to.",
    ].join("\n"),
  },
  {
    code: "HAZARDS",
    label: "Hazards & equipment",
    isSafety: true,
    reviewerBlurb:
      "Physical hazards and equipment. Second-hand and hand-me-down advice is common here and often generous in intent.",
    checks: [
      "Choking: food size or shape, whole grapes, nuts, popcorn, chunks",
      "Small parts, cords, blind pulls, or button batteries near a baby",
      "Car seat modifications, aftermarket inserts, or bulky winter coats in the harness",
      "Car seat used past its expiry, after a collision, or with unknown history",
      "Second-hand equipment with a safety history: recalled cribs, drop-side rails, used car seats",
      "Baby walkers, or unsafe use of bouncers and jumpers",
      "Bath safety: unattended, bath seats used as restraints, water temperature",
    ],
    messageForAuthor: [
      "We couldn't publish this one.",
      "",
      "What you wrote touches on equipment and safety, where the specifics — fittings, sizes, recalls, what's been modified — matter far more than they appear to, and change over time. We hold this space strictly to current guidance for that reason.",
      "",
      "That's about the guidance, not about you. Passing things on and making do is how a great many of us got through, and there's nothing wrong in it.",
      "",
      "You're welcome to write again whenever you'd like to.",
    ].join("\n"),
  },
  {
    // Not a safety category. A review queue still needs a way to decline
    // something that is simply not an experience — a request, a question, an
    // advertisement — without implying the author endangered anyone. Kept
    // visibly separate from the four above so the two never blur in the UI.
    code: "NOT_AN_EXPERIENCE",
    label: "Not a fit for Experiences",
    isSafety: false,
    reviewerBlurb:
      "Nothing unsafe — it just isn't an experience. Use this rather than a safety category, so a question is never answered as though it were dangerous.",
    checks: [
      "A question rather than something she went through",
      "A request for items, money, or help",
      "An advertisement, promotion, or link-farm",
      "Content that isn't about her own experience of pregnancy or motherhood",
    ],
    messageForAuthor: [
      "This one reads more like a question than an experience — and questions have a better home.",
      "",
      "Post it in your Circle instead. The mothers there are at your stage, they've usually just been through whatever you're asking about, and our team reads it too. You'll get an actual answer, which is more than this space can give you.",
      "",
      "Experiences is for the other direction: something you've already been through, and what you'd tell a mother coming up behind you.",
      "",
      "Nothing about this counts against you, and we'd love to read an experience from you whenever you have one.",
    ].join("\n"),
  },
];

export const SAFETY_CATEGORY_MAP: Record<SafetyCategoryCode, SafetyCategory> =
  Object.fromEntries(SAFETY_CATEGORIES.map((c) => [c.code, c])) as Record<
    SafetyCategoryCode,
    SafetyCategory
  >;

export function isSafetyCategoryCode(v: unknown): v is SafetyCategoryCode {
  return typeof v === "string" && v in SAFETY_CATEGORY_MAP;
}

export function declineMessageFor(code: SafetyCategoryCode): string {
  return SAFETY_CATEGORY_MAP[code].messageForAuthor;
}

// ── Send back for one change ────────────────────────────────────────────────
// The humane middle. A post that is 90% good with one dangerous line should not
// be refused outright — that loses the other 90% and tells her the whole thing
// was wrong. It goes back to DRAFT with a specific, actionable note.
//
// The note is the one piece of author-facing text an admin writes, because only
// they can say what THIS post needs. The API enforces a minimum length so it
// cannot degrade into "please fix" — a vague send-back is worse than a decline,
// since she is left knowing something is wrong but not what.

export const SEND_BACK_NOTE_MIN_LENGTH = 30;

export function sendBackMessage(specificNote: string): string {
  return [
    "We'd love to publish this — there's one thing to change first.",
    "",
    specificNote.trim(),
    "",
    "Your draft is saved with everything you wrote. Edit that one part whenever you have a moment, and send it back to us.",
    "",
    "Thank you for writing it. What you've put down is worth other mothers reading.",
  ].join("\n");
}

// ── Approval ────────────────────────────────────────────────────────────────
// No link until E3 ships the reader — a notification pointing at a 404 is worse
// than one that simply says the good news.
export const PUBLISHED_MESSAGE =
  "Your experience has been published. Thank you for writing it down — what you learned is now where another mother can find it when she needs it.";

export const COMMENT_PUBLISHED_MESSAGE =
  "Your comment has been published. Thank you for adding what the post was missing.";

// ── Authoring (E3) ──────────────────────────────────────────────────────────
// The three fields, their limits, and the placeholder text that teaches the
// form. Kept here with the rest of the mother-facing words so there is one
// module to change when the wording changes.
//
// THE MINIMUMS ARE THE GUARDRAIL. Experiences is not a feed and must not decay
// into one. With situation and takeaway both required at a real length, "just
// checking in 💕" has nowhere to live — a check-in is structurally unable to
// become a post, rather than being allowed in and moderated out later. That is
// a property of the form, not a rule someone has to enforce at 3am.
//
// The whatITried placeholder deliberately invites what did NOT work. That is
// usually the most useful part of an experience and the least often written
// down, because it feels like failure rather than knowledge.

export interface ExperienceField {
  key: "situation" | "whatITried" | "takeaway";
  label: string;
  hint: string;
  placeholder: string;
  min: number;
  max: number;
}

export const EXPERIENCE_FIELDS: ExperienceField[] = [
  {
    key: "situation",
    label: "What was happening",
    hint: "Write it as the problem, the way another mother would search for it — not as a title.",
    placeholder:
      "Baby wouldn't take a bottle after 6 weeks. I was going back to work in three weeks and starting to panic about it.",
    min: 20,
    max: 500,
  },
  {
    key: "whatITried",
    label: "What you tried",
    hint: "Include what didn't work. That part is usually the most useful and the least often written down.",
    placeholder:
      "Paced feeding, three different teats, my partner giving it instead of me. None of that helped on its own. What finally worked was...",
    min: 20,
    max: 2000,
  },
  {
    key: "takeaway",
    label: "What you'd tell another mother",
    hint: "The one thing you wish someone had told you.",
    placeholder:
      "Start earlier than feels necessary. Don't leave it until the week before you go back.",
    min: 20,
    max: 1000,
  },
];

export const EXPERIENCE_FIELD_MAP: Record<ExperienceField["key"], ExperienceField> =
  Object.fromEntries(EXPERIENCE_FIELDS.map((f) => [f.key, f])) as Record<
    ExperienceField["key"],
    ExperienceField
  >;

/** Server-side validation. Returns an author-facing error, or null when valid. */
export function validateExperienceField(
  key: ExperienceField["key"],
  value: unknown
): string | null {
  const f = EXPERIENCE_FIELD_MAP[key];
  const v = typeof value === "string" ? value.trim() : "";
  if (v.length < f.min) {
    return `"${f.label}" needs a little more — at least ${f.min} characters.`;
  }
  if (v.length > f.max) {
    return `"${f.label}" is a bit long — please keep it under ${f.max} characters.`;
  }
  return null;
}

// The redirect that keeps Experiences from becoming a question board. Shown on
// the compose form itself, before she has written anything, because the moment
// to redirect a question is before it is typed out — not after, in a decline.
export const QUESTION_REDIRECT_LINE =
  "Have a question instead? Ask it in your Circle — mothers at your stage are there, and our team reads it too.";

// Shown after submitting. No link to the experience: the reader does not exist
// yet, and a button leading to a 404 would undercut the reassurance.
export const SUBMITTED_HEADLINE = "It's with the team.";
export const SUBMITTED_BODY =
  "Someone will read it before it goes anywhere. That's true of everything here — it's why a mother can act on what she finds. We'll let you know once it's published, and if anything needs changing first, we'll tell you exactly what.";

export const DRAFT_RESUBMITTED_HEADLINE = "Sent back to the team.";
export const DRAFT_RESUBMITTED_BODY =
  "Thank you for making that change. Someone will read it again shortly.";
