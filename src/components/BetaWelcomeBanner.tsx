"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { hasMotherIntent } from "@/lib/motherIntent";

// One-time, server-flagged (betaWelcomeSeenAt) soft banner. Not a modal.
// Sequencing: donors see it first session; mothers see it only AFTER the
// register guided tour completes (never during it) — see betaWelcomeSeenAt
// gate below. Persisted server-side (no localStorage) per hydration lessons.
export default function BetaWelcomeBanner() {
  const { user, refreshUser } = useAuth();
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);

  if (!user || user.betaWelcomeSeenAt || hidden) return null;
  // Don't stack on a mother-intent user's first visit — the open-door panel is
  // the more important message and gets the stage; the feedback pill remains.
  if (hasMotherIntent(user)) return null;

  // A new mother's react-joyride tour runs on the register detail page while
  // tourCompletedAt is null. Donors never take the tour, so they always pass.
  if (user.role === "RECIPIENT" && !user.tourCompletedAt) {
    // Never while the tour is on screen.
    const onTourPage =
      pathname.startsWith("/registers/") &&
      !["/registers/new", "/registers/my", "/registers/saved"].includes(pathname);
    if (onTourPage) return null;
    // Hold it during her first sitting, but surface it on any later session so
    // a mother who never finishes the tour still discovers the feedback pill.
    // createdAt is the "first session" heuristic (well past this on return).
    const FIRST_SESSION_MS = 60 * 60 * 1000;
    if (Date.now() - new Date(user.createdAt).getTime() < FIRST_SESSION_MS) return null;
  }

  const dismiss = () => {
    setHidden(true);
    fetch("/api/user/beta-welcome-seen", { method: "POST" })
      .then(() => refreshUser())
      .catch(() => { /* flag write is best-effort; local hide already applied */ });
  };

  return (
    <div style={{ background: "#e8f5f1", borderBottom: "1px solid #cfe8de" }}>
      <div style={{
        maxWidth: 1040, margin: "0 auto", padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 12,
        fontFamily: "Nunito, sans-serif",
      }}>
        <span aria-hidden="true" style={{ fontSize: 16, flexShrink: 0 }}>🌱</span>
        <p style={{ margin: 0, flex: 1, fontSize: 13, lineHeight: 1.5, color: "#1a5c45" }}>
          <strong style={{ fontWeight: 800 }}>Kradel is in beta.</strong> If anything looks broken or confusing,
          the Feedback button in the corner is always there. Every report genuinely helps us build this right.
        </p>
        <button
          onClick={dismiss}
          style={{
            flexShrink: 0, background: "#1a7a5e", color: "white", border: "none",
            borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 800,
            cursor: "pointer", fontFamily: "Nunito, sans-serif",
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
