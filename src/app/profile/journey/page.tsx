"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import Toast from "@/components/Toast";

const JOURNEY_OPTIONS = [
  { value: "pregnant",   emoji: "🤰", label: "I'm pregnant",           sub: "You'll be placed in a pregnancy circle"      },
  { value: "postpartum", emoji: "🤱", label: "I'm a mother",            sub: "You'll be placed in a postpartum circle"     },
  { value: "donor",      emoji: "🎁", label: "I'm a giver", sub: "You'll see the platform as a giver"          },
];

export default function JourneyPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [toast,  setToast]  = useState<string | null>(null);

  if (!user) return null;

  const handleSelect = async (value: string) => {
    if (user.journeyType === value) return;
    if (!confirm(`Switch your journey to "${JOURNEY_OPTIONS.find(o => o.value === value)?.label}"? Your circle assignment will reset.`)) return;
    setSaving(true);
    const res = await fetch("/api/user/onboarding", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ journeyType: value, subTags: user.subTags ?? [] }),
    });
    if (res.ok) {
      await refreshUser();
      setToast("Journey updated!");
    }
    setSaving(false);
  };

  // Motherhood is independent of journey — its own endpoint, so toggling it
  // never disturbs her circle assignment.
  const handleMotherhood = async (next: boolean) => {
    setSaving(true);
    const res = await fetch("/api/user/motherhood", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isMother: next }),
    });
    if (res.ok) {
      await refreshUser();
      setToast(next
        ? "Thank you — you can share what you've learned in Experiences."
        : "Updated. Anything you've already shared stays where it is.");
    }
    setSaving(false);
  };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 80 }}>
      <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "20px 16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}
          >
            <ArrowLeft size={16} strokeWidth={2} color="white" />
          </button>
          <div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "white" }}>My Journey</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Choose your current stage</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        <p style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.6, marginBottom: 16 }}>
          You can both donate and receive support. Choosing your journey sets your primary experience on Kradel.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {JOURNEY_OPTIONS.map(({ value, emoji, label, sub }) => {
            const isActive = user.journeyType === value;
            return (
              <button
                key={value}
                disabled={saving}
                onClick={() => handleSelect(value)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "16px", borderRadius: 16,
                  border: `2px solid ${isActive ? "#1a7a5e" : "var(--border)"}`,
                  background: isActive ? "#e8f5f1" : "white",
                  cursor: isActive ? "default" : "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 28, flexShrink: 0 }}>{emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: isActive ? "#1a7a5e" : "var(--ink)", fontFamily: "Nunito, sans-serif" }}>{label}</div>
                  <div style={{ fontSize: 12, color: "var(--mid)", marginTop: 2 }}>{sub}</div>
                </div>
                {isActive && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#1a7a5e", background: "white", border: "1.5px solid #1a7a5e", padding: "3px 10px", borderRadius: 20, flexShrink: 0 }}>
                    Current
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Motherhood — Experiences eligibility. Separate from journey on
            purpose: motherhood is who she is, journey is what she's doing now.
            The copy keeps belonging tied to motherhood, never to giving. */}
        <div style={{ marginTop: 24, padding: "16px", borderRadius: 16, background: "white", border: "1.5px solid var(--border)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", fontFamily: "Nunito, sans-serif", marginBottom: 6 }}>
            Are you a mother?
          </div>
          <div style={{ fontSize: 12.5, color: "var(--mid)", lineHeight: 1.65, marginBottom: 14 }}>
            Kradel has a space called Experiences, where mothers write down what they&apos;ve learned
            for the mothers who come after them. If you&apos;re a mother too, you&apos;re welcome
            there, whatever brought you to Kradel. We never show this to other people.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={saving || user.isMother}
              onClick={() => handleMotherhood(true)}
              style={{
                flex: 1, padding: "11px 0", borderRadius: 12,
                border: `2px solid ${user.isMother ? "#1a7a5e" : "var(--border)"}`,
                background: user.isMother ? "#e8f5f1" : "white",
                color: user.isMother ? "#1a7a5e" : "var(--ink)",
                fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif",
                cursor: user.isMother ? "default" : "pointer",
              }}
            >
              Yes{user.isMother ? " ✓" : ""}
            </button>
            <button
              disabled={saving || !user.isMother}
              onClick={() => handleMotherhood(false)}
              style={{
                flex: 1, padding: "11px 0", borderRadius: 12,
                border: "1.5px solid var(--border)", background: "white",
                color: "var(--mid)", fontSize: 13, fontWeight: 700,
                fontFamily: "Nunito, sans-serif",
                cursor: !user.isMother ? "default" : "pointer",
              }}
            >
              No
            </button>
          </div>
          {user.isMother && (
            <div style={{ fontSize: 11.5, color: "var(--light)", marginTop: 10, lineHeight: 1.6 }}>
              Changing this to No stops new posts and comments. Anything you&apos;ve already shared stays — other mothers may be relying on it.
            </div>
          )}
        </div>

        {saving && (
          <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
            <div className="spinner" />
          </div>
        )}
      </div>

      <BottomNav />
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
