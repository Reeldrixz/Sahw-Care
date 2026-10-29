// Which buttons on the live-feature consent card can be tapped. Pure, so the
// rule is tested (lib/consentCard.test.ts) rather than left to the page.
//
// "No" can ALWAYS be tapped (except while a save is in flight): saying no, or
// withdrawing, is never blocked, whatever the state of her address or her
// consent. "Yes" needs her shipping address held ahead of time
// (lib/liveAddress), and does nothing once she has said yes to this wording.

export type ConsentCardState = { saving: boolean; consentCurrent: boolean; liveAddressReady: boolean };

export function consentButtons(s: ConsentCardState) {
  return {
    yesEnabled:          !s.saving && !s.consentCurrent && s.liveAddressReady,
    noEnabled:           !s.saving,
    showConfirmAddress:  !s.liveAddressReady,
  };
}
