// The consent a mother gives for her register to be featured in live
// fundraising events, and every wording of it she might have agreed to.
//
// RULES FOR CHANGING THIS FILE
//   - A published version's text is never edited. Changing what the card says
//     means adding a new version and moving FEATURE_CONSENT_VERSION to it.
//   - Register.featureConsentVersion stores the number she agreed to, so the
//     number must always identify the exact words she saw.
//   - Only consent for FEATURE_CONSENT_VERSION lets a host pick her register.
//     Moving the version therefore takes every earlier consent out of the
//     pickable pool until she reads the new card and says yes again.
//
// What withdrawing does (version 2): it stops her being picked for any stream
// from then on. A stream already showing her keeps showing her until the host
// moves on or the event ends; queued celebrations are not cancelled. The card
// says so before she agrees.
//
// No server imports, so the card can render from this directly.

export const FEATURE_CONSENT_VERSION = 2;

export type ConsentPoint = { lead: string; text: string };

export type FeatureConsentCopy = {
  version: number;
  heading: string;
  intro: string;
  mayShowHeading?: string;
  mayShow: ConsentPoint[];
  neverShow?: ConsentPoint;
  changingMind?: { lead: string; before: string; bold: string; after: string };
  yes: string;
  no: string;
  footer: string;
};

export const FEATURE_CONSENT_COPY: Record<number, FeatureConsentCopy> = {
  // The original wording, kept as the record of what version-1 consent meant.
  // Registers that consented before versions existed have a NULL version and
  // agreed to this.
  1: {
    version: 1,
    heading: "Allow my Register to be featured in Kradel fundraising events",
    intro:
      "Your first name, Register items, and information you’ve chosen to share on your Register " +
      "may be shown to audiences outside Kradel during livestreams and other Kradel fundraising campaigns.",
    mayShow: [],
    yes: "Yes, you can feature it",
    no: "No",
    footer:
      "This doesn’t share anything new — your Register is already viewable by anyone with the link. " +
      "This is about whether we may show it during fundraising. You can change this anytime.",
  },

  2: {
    version: 2,
    heading: "Feature my Register in live fundraising events",
    intro:
      "Kradel runs live fundraising events: a host streams online and invites viewers to help mothers. " +
      "If you say yes, your Register can be shown on screen during these events, to people outside Kradel. " +
      "If you say no, nothing else about your Register changes.",
    mayShowHeading: "If you say yes, viewers may see:",
    mayShow: [
      { lead: "Your first name.", text: "Never your surname." },
      {
        lead: "Your Register.",
        text:
          "Your items, how much each one still needs, and how many are funded, for example “3 of 8 items funded”. " +
          "Also your Register’s title, and the introduction you wrote if you added one.",
      },
      {
        lead: "Celebrations, live, using your first name,",
        text: "like “Aisha’s diapers funded ✓”, and a celebration when your whole Register is complete.",
      },
      {
        lead: "A donor’s first name next to yours",
        text:
          "when that person funds an item in full by themselves, like “Sarah funded Aisha’s diapers ✓”. " +
          "Donors choose whether their name is shown.",
      },
      { lead: "Delivery progress,", text: "like “Aisha · order placed ✓”. Only your first name and the status." },
    ],
    neverShow: {
      lead: "Viewers never see",
      text:
        "your surname, your address or area, your phone number or email, your due date, delivery dates, " +
        "or anything you haven’t put on your Register.",
    },
    changingMind: {
      lead: "Changing your mind.",
      before: "You can stop at any time, right here, with one tap.",
      bold: "If you stop while a live event is showing your Register, it stays on screen until the host moves on or the event ends.",
      after:
        "After that, no new event can feature you. We can’t take back what viewers have already seen, " +
        "or recordings a host or viewer made.",
    },
    yes: "Yes, feature my Register",
    no: "No",
    footer: "You can change this anytime.",
  },
};

export const CURRENT_FEATURE_CONSENT = FEATURE_CONSENT_COPY[FEATURE_CONSENT_VERSION];

// Shown above the card to a mother whose consent is for an earlier wording.
export const FEATURE_CONSENT_UPDATED_NOTICE =
  "We’ve updated what featuring includes. Please read it again and choose.";

// Consent that lets a host pick her register: given, and for the current wording.
export function hasCurrentFeatureConsent(r: { featureConsent: boolean; featureConsentVersion: number | null }): boolean {
  return r.featureConsent && r.featureConsentVersion === FEATURE_CONSENT_VERSION;
}
