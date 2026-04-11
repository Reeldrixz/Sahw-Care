"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import OnboardingModal from "./OnboardingModal";

export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, loading, refreshUser } = useAuth();
  const stageChecked = useRef(false);
  const [upgradeMsg, setUpgradeMsg] = useState<string | null>(null);

  // Run stage check once after user loads (only if onboarding complete)
  useEffect(() => {
    if (!user?.onboardingComplete || stageChecked.current) return;
    stageChecked.current = true;

    fetch("/api/user/stage-check", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.changed) {
          setUpgradeMsg(d.newStageName);
          refreshUser();
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.onboardingComplete]);

  return (
    <>
      {children}

      {/* Onboarding modal — shown once after signup */}
      {!loading && user && !user.onboardingComplete && (
        <OnboardingModal onComplete={() => refreshUser()} />
      )}

      {/* Stage upgrade toast */}
      {upgradeMsg && (
        <div
          role="status"
          style={{
            position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
            background: "var(--green)", color: "white",
            padding: "12px 20px", borderRadius: 14, zIndex: 600,
            fontSize: 13, fontWeight: 700,
            boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
            maxWidth: 360, textAlign: "center",
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          <span>🎉 Your circle has updated! Welcome to {upgradeMsg}!</span>
          <button
            onClick={() => setUpgradeMsg(null)}
            style={{ color: "white", background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
