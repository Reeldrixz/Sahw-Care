"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  subscribeFeedbackSuppress,
  getFeedbackSuppressed,
  getFeedbackSuppressedServer,
} from "@/lib/feedbackSuppress";

const SESSION_KEY = "kradel:betaPillDismissed";

// Quiet floating pill: opens the existing /report-bug flow prefilled with the
// current page. Bottom-right on desktop, bottom-left on mobile (clears the
// 64px BottomNav). Hidden during sensitive moments (see feedbackSuppress) and
// dismissible for the session.
export default function BetaFeedbackPill() {
  const pathname = usePathname();
  const suppressed = useSyncExternalStore(
    subscribeFeedbackSuppress,
    getFeedbackSuppressed,
    getFeedbackSuppressedServer,
  );

  const [dismissed, setDismissed] = useState(false);
  const [href, setHref] = useState("/report-bug");
  const [inPayment, setInPayment] = useState(false);

  // Per-session dismissal — read in an effect (never in a useState initializer)
  // so server and first client render agree.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") setDismissed(true);
    } catch { /* storage blocked — just show it */ }
  }, []);

  // Recompute prefill + payment-flow detection on each navigation.
  useEffect(() => {
    const search = window.location.search;
    setInPayment(new URLSearchParams(search).has("payment"));
    setHref(`/report-bug?from=${encodeURIComponent(window.location.href)}`);
  }, [pathname]);

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
  };

  const hiddenRoute = pathname.startsWith("/admin") || pathname.startsWith("/report-bug");
  if (dismissed || suppressed || inPayment || hiddenRoute) return null;

  return (
    <>
      <style>{`
        .beta-pill {
          position: fixed; left: 12px;
          bottom: calc(64px + 12px + env(safe-area-inset-bottom, 0px));
          z-index: 60;
          display: flex; align-items: stretch;
          background: #ffffff; border: 1px solid #e7e2d8; border-radius: 999px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.10); overflow: hidden;
          font-family: 'Nunito', sans-serif;
        }
        @media (min-width: 768px) {
          .beta-pill { left: auto; right: 20px; bottom: 20px; }
        }
        .beta-pill a { text-decoration: none; }
        .beta-pill .bp-link { display: flex; align-items: center; gap: 7px; padding: 8px 13px; color: #6b7280; font-size: 12px; font-weight: 700; }
        .beta-pill .bp-link:hover { background: #faf8f3; }
        .beta-pill .bp-dot { width: 7px; height: 7px; border-radius: 50%; background: #1a7a5e; flex-shrink: 0; }
        .beta-pill .bp-x { border: none; border-left: 1px solid #efeae0; background: transparent; color: #b8b2a6; font-size: 15px; line-height: 1; padding: 0 11px; cursor: pointer; }
        .beta-pill .bp-x:hover { color: #6b7280; }
      `}</style>
      <div className="beta-pill" role="complementary" aria-label="Beta feedback">
        <a className="bp-link" href={href} aria-label="Report a bug or share feedback about this page">
          <span className="bp-dot" aria-hidden="true" />
          Beta · Feedback
        </a>
        <button className="bp-x" onClick={dismiss} aria-label="Hide the feedback button for this session">
          ×
        </button>
      </div>
    </>
  );
}
