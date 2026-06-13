"use client";

import { useEffect, useState } from "react";
import Joyride, { ACTIONS, EVENTS, STATUS, type CallBackProps, type Step } from "react-joyride";

// The 4 v1 steps, in order. Each points at a data-tour attribute on the
// register detail page. Calm, reassuring copy — no progress-pressure.
const STEP_DEFS: { target: string; content: string }[] = [
  {
    target: '[data-tour="intro"]',
    content: "Share a little about yourself in your own words, if you'd like. It's optional, and always your choice.",
  },
  {
    target: '[data-tour="add-item"]',
    content: "Add what you need here. People can then fund each item for you.",
  },
  {
    target: '[data-tour="progress"]',
    content: "This shows what's been funded so far — you'll see it grow.",
  },
  {
    target: '[data-tour="share"]',
    content: "If you'd like, you can share your register so more people can help.",
  },
];

export default function RegisterTour({ run, onClose }: { run: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);

  // Joyride touches the DOM/window — only render after mount (no SSR).
  useEffect(() => { setMounted(true); }, []);

  // Build steps from only the targets actually present in the DOM, so a missing
  // element (e.g. no progress section yet for a brand-new register) is skipped
  // rather than breaking the tour.
  useEffect(() => {
    if (!run) return;
    const present = STEP_DEFS.filter((s) => document.querySelector(s.target));
    setSteps(
      present.map((s) => ({
        target: s.target,
        content: s.content,
        disableBeacon: true,   // open the tooltip directly, no pulsing dot
        placement: "auto",     // let Floater pick the side that stays on-screen
      }))
    );
  }, [run]);

  if (!mounted || !run || steps.length === 0) return null;

  const handleCallback = (data: CallBackProps) => {
    const { status, action, type } = data;
    // Finish, Skip, the close (X), or a vanished target all end the tour cleanly.
    const ended =
      status === STATUS.FINISHED ||
      status === STATUS.SKIPPED ||
      action === ACTIONS.CLOSE ||
      type === EVENTS.TARGET_NOT_FOUND;
    if (ended) onClose();
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton          // clear "Skip" on every step
      hideCloseButton={false} // plus a close (X)
      showProgress={false}    // no "X of 4" pressure
      scrollToFirstStep
      disableOverlayClose     // don't dismiss by accidental backdrop tap; use Skip/X
      callback={handleCallback}
      locale={{ back: "Back", close: "Close", last: "Got it", next: "Next", skip: "Skip" }}
      floaterProps={{ disableAnimation: true }}
      styles={{
        options: {
          primaryColor: "#1a7a5e",
          textColor: "#1a1a1a",
          backgroundColor: "#ffffff",
          arrowColor: "#ffffff",
          overlayColor: "rgba(0,0,0,0.45)",
          zIndex: 10000,
        },
        tooltip: { borderRadius: 16, fontFamily: "Nunito, sans-serif", padding: 18 },
        tooltipContent: { fontSize: 14, lineHeight: 1.6, color: "#444", padding: "2px 0 0" },
        buttonNext: { backgroundColor: "#1a7a5e", borderRadius: 20, fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", padding: "9px 18px" },
        buttonBack: { color: "#1a7a5e", fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif" },
        buttonSkip: { color: "#9ca3af", fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif" },
      }}
    />
  );
}
