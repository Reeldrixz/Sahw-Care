"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { hasMotherIntent } from "@/lib/motherIntent";

const SESSION_KEY = "kradel:openDoorDismissed";

// Warm "held-open door" home panel for accounts that arrived with mother-intent
// but aren't referred yet. Not a modal, not app-wide (home surface only).
// Dismissible per session (sessionStorage read in an effect — no hydration
// risk), recurring next session. The code entry reuses the existing /join
// redemption flow (and its rate limiting).
export default function OpenDoorPanel() {
  const { user } = useAuth();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1") setDismissed(true);
    } catch { /* storage blocked — just show it */ }
  }, []);

  if (!hasMotherIntent(user) || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* ignore */ }
  };

  const connect = () => {
    const c = code.trim();
    if (!c) return;
    router.push(`/join/${encodeURIComponent(c)}`);
  };

  return (
    <div style={{ margin: "12px 16px 0" }}>
      <div style={{ position: "relative", background: "#e8f5f1", border: "1px solid #cfe8de", borderRadius: 16, padding: "18px 18px 16px" }}>
        <button
          onClick={dismiss}
          aria-label="Hide for now"
          style={{ position: "absolute", top: 10, right: 12, background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#8aa89c", lineHeight: 1, padding: 4 }}
        >
          ×
        </button>

        <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, color: "#1a3a2e", marginBottom: 6, paddingRight: 20 }}>
          Welcome. Whenever you&apos;re ready, there&apos;s a way in.
        </div>
        <p style={{ fontSize: 13, color: "#3d7a62", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, margin: "0 0 14px" }}>
          Kradel works through trusted partner organizations. If one has referred you, enter your code to get connected.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") connect(); }}
            placeholder="Enter your referral code"
            aria-label="Referral code"
            style={{
              flex: "1 1 180px", minWidth: 0, padding: "11px 13px",
              border: "1.5px solid #cfe8de", borderRadius: 12, fontSize: 14,
              fontFamily: "Nunito, sans-serif", background: "white", color: "#1a1a1a",
              outline: "none", boxSizing: "border-box",
            }}
          />
          <button
            onClick={connect}
            style={{
              flex: "0 0 auto", padding: "11px 20px", background: "#1a7a5e", color: "white",
              border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800,
              cursor: "pointer", fontFamily: "Nunito, sans-serif",
            }}
          >
            Get connected
          </button>
        </div>

        <a
          href="/find-help"
          style={{ fontSize: 13, fontWeight: 700, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", textDecoration: "none" }}
        >
          Not referred yet? Find a partner organization near you →
        </a>
      </div>
    </div>
  );
}
