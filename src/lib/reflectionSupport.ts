// Single source of truth for Reflections support resources and the two warm
// rejection messages. Used by the admin reject API (to build the mother's
// notification) and by the mother-facing UI (the persistent resources note).
//
// Resources are verified-current Canadian/Ontario services. Do not add
// placeholders. The two rejection paths are intentionally distinct: a distressed
// (CRISIS) reflection gets the full supportive message with resources; a
// non-crisis one (off-topic / request) gets a lighter message with NO crisis
// resources, so an off-topic post never receives an alarming crisis reply.

export interface SupportResource {
  name: string;
  detail: string;
  href: string;      // tel:, sms:, or https:
  external?: boolean; // true = open in a new tab (web links)
}

export const SUPPORT_RESOURCES: SupportResource[] = [
  { name: "988 Suicide Crisis Helpline", detail: "Call or text 988, anytime, 24/7", href: "tel:988" },
  { name: "ConnexOntario", detail: "1-866-531-2600, Ontario mental health support (non-crisis)", href: "tel:18665312600" },
  { name: "Postpartum Support International", detail: "postpartum.net, support made for new mothers", href: "https://postpartum.net", external: true },
  { name: "Emergency", detail: "Call 911 if you are in immediate danger", href: "tel:911" },
];

export type RejectionCategory = "CRISIS" | "NON_CRISIS";

// The exact, approved crisis message. Never uses the word "rejected"; frames not
// publishing as care; puts her above the post; affirms she is welcome back.
//
// Named SUPPORT rather than REJECTION because it is sent in contexts that are
// deliberately not rejections — the Experiences queue holds such a post as
// HELD_FOR_SUPPORT, a state of its own. One source of truth: if this copy ever
// needs to change, it must change in exactly one place, for every surface that
// reaches a mother in crisis.
export const CRISIS_SUPPORT_MESSAGE = [
  "We're holding this one for you.",
  "",
  "Thank you for trusting us with something so honest. What you wrote sounds really heavy, and we care more about you right now than about a post.",
  "",
  "We haven't published this reflection, because we want to make sure you have real support in this moment, not just a place to write it down.",
  "",
  "If you're struggling, please reach out. You deserve support:",
  "988: call or text, anytime, 24/7 (Suicide Crisis Helpline)",
  "ConnexOntario: 1-866-531-2600 (Ontario mental health support)",
  "Postpartum Support International: postpartum.net (support made for new mothers)",
  "In an emergency, call 911",
  "",
  "You can write again whenever you're ready. We're glad you're here.",
].join("\n");

// The lighter, non-crisis message. No crisis resources; gentle; door left open.
export const NON_CRISIS_REJECTION_MESSAGE =
  "Thanks for sharing. Reflections is a space for your own experience and state of mind at this stage, so this one wasn't quite a fit here. A request or a question is usually better placed in your Circle, where mothers and our team can help. Nothing about this counts against you, and you're welcome to write a reflection any time.";

export function rejectionMessageFor(category: RejectionCategory): string {
  return category === "CRISIS" ? CRISIS_SUPPORT_MESSAGE : NON_CRISIS_REJECTION_MESSAGE;
}
