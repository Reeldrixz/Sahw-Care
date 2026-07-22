"use client";

import { useState } from "react";

const GREEN = "#1a7a5e";
const INK = "#1f2a24";
const MUTED = "#5a6b62";
const SERIF = "Lora, Georgia, serif";
const SANS = "Nunito, sans-serif";

const DO_LIST = [
  "Talk about the mission and why it matters.",
  "Tell people the platform exists and who it helps.",
  "Encourage support and referrals.",
  "Use the visuals and branding we provide.",
];

const DONT_LIST = [
  "Share or request photos of mothers or babies.",
  "Invent, embellish, or dramatize personal stories.",
  "Use guilt, shock, or pressure to drive people to act.",
  "Present yourself as saving or personally rescuing individuals.",
  "Post your private dashboard numbers publicly as proof of helping specific mothers.",
];

// Task 2: acknowledgment gate. The creator must read the dignity rules and
// tick the box before we call activate. No box, no activation.
export default function CreatorCodeOfConduct({ onActivated }: { onActivated: (code: string) => void }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activate = async () => {
    if (!checked || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/creators/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? "Could not activate. Please try again.");
        setBusy(false);
        return;
      }
      onActivated(d.creatorReferralCode);
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  };

  const listBlock = (title: string, color: string, items: string[], mark: string) => (
    <div style={{ flex: "1 1 260px" }}>
      <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 800, color, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 8 }}>
        {title}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((t) => (
          <li key={t} style={{ display: "flex", gap: 8, fontFamily: SANS, fontSize: 14, color: INK, lineHeight: 1.55 }}>
            <span style={{ color, fontWeight: 800, flexShrink: 0 }}>{mark}</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div>
      <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: INK, marginBottom: 4 }}>
        Creator Code of Conduct
      </div>
      <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, lineHeight: 1.6, margin: "0 0 18px" }}>
        Being an Impact Creator means carrying this mission with care. Please read and agree before you activate.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginBottom: 20 }}>
        {listBlock("Do", GREEN, DO_LIST, "+")}
        {listBlock("Don't", "#b91c1c", DONT_LIST, "-")}
      </div>

      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginBottom: 16 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          style={{ marginTop: 3, width: 18, height: 18, accentColor: GREEN, flexShrink: 0 }}
        />
        <span style={{ fontFamily: SANS, fontSize: 14, color: INK, lineHeight: 1.55 }}>
          I have read the Creator Code of Conduct and I agree to represent this mission with honesty and to protect the dignity and privacy of every mother and baby.
        </span>
      </label>

      {error && (
        <p style={{ fontFamily: SANS, fontSize: 13, color: "#b91c1c", margin: "0 0 12px" }}>{error}</p>
      )}

      <button
        onClick={activate}
        disabled={!checked || busy}
        style={{
          fontFamily: SANS, fontSize: 15, fontWeight: 700, color: "#fff",
          background: !checked || busy ? "#9bbcae" : GREEN,
          border: "none", borderRadius: 999, padding: "12px 26px",
          cursor: !checked || busy ? "not-allowed" : "pointer",
        }}
      >
        {busy ? "Activating..." : "Activate my creator link"}
      </button>
    </div>
  );
}
