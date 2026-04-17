"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const CONTEXT_OPTIONS = [
  { value: "First-time Mom", emoji: "🌱", desc: "This is all new to me" },
  { value: "Experienced Mom", emoji: "💛", desc: "I've been here before" },
  { value: "Single Mom", emoji: "🦋", desc: "Doing this on my own" },
  { value: "Teen Mom", emoji: "🌸", desc: "Young and figuring it out" },
  { value: "Other", emoji: "✨", desc: "My story is my own" },
];

interface Props {
  onDone: () => void;
}

export function formatCircleIdentity(
  circleContext: string | null | undefined,
  circleDisplayName: string | null | undefined,
  fullName: string,
): string {
  const name = circleDisplayName?.trim() || fullName.split(" ")[0];
  if (circleContext) return `${circleContext} • ${name}`;
  return name;
}

export default function CircleIdentityModal({ onDone }: Props) {
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState<"context" | "name" | "preview">("context");
  const [selectedContext, setSelectedContext] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(user?.name?.split(" ")[0] ?? "");
  const [saving, setSaving] = useState(false);

  const previewName = displayName.trim() || user?.name?.split(" ")[0] || "You";
  const previewIdentity = selectedContext
    ? `${selectedContext} • ${previewName}`
    : previewName;

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/user/circle-identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: selectedContext, displayName: displayName.trim() || null, skip: false }),
    });
    await refreshUser();
    setSaving(false);
    onDone();
  };

  const handleSkip = async () => {
    await fetch("/api/user/circle-identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skip: true }),
    });
    onDone();
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleSkip(); }}
    >
      <div style={{ background: "var(--white)", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 430, maxHeight: "90vh", display: "flex", flexDirection: "column", animation: "sheetUp 0.3s ease", overflow: "hidden" }}>

        {/* Handle */}
        <div style={{ padding: "16px 20px 0", flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 4, margin: "0 auto 20px" }} />
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 28px" }}>

          {/* ── Step: Context ────────────────────────────────────────── */}
          {step === "context" && (
            <>
              <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginBottom: 8, lineHeight: 1.3 }}>
                How do you see yourself?
              </div>
              <p style={{ fontSize: 14, color: "var(--mid)", lineHeight: 1.6, marginBottom: 24 }}>
                This shows as a small label next to your name in your circle — only visible to other moms. Totally optional.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
                {CONTEXT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedContext(opt.value)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "14px 16px", borderRadius: 14,
                      border: `2px solid ${selectedContext === opt.value ? "var(--green)" : "var(--border)"}`,
                      background: selectedContext === opt.value ? "var(--green-light)" : "var(--white)",
                      cursor: "pointer", fontFamily: "Nunito, sans-serif", textAlign: "left",
                      transition: "all 0.15s",
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{opt.emoji}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: selectedContext === opt.value ? "var(--green)" : "var(--ink)" }}>
                        {opt.value}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--mid)" }}>{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setStep("name")}
                  disabled={!selectedContext}
                  style={{
                    flex: 1, padding: "13px", borderRadius: 14, border: "none",
                    background: selectedContext ? "var(--green)" : "var(--border)",
                    color: "white", fontSize: 15, fontWeight: 800, cursor: selectedContext ? "pointer" : "default",
                    fontFamily: "Nunito, sans-serif", transition: "background 0.15s",
                  }}
                >
                  Next →
                </button>
                <button
                  onClick={() => setStep("name")}
                  style={{
                    padding: "13px 18px", borderRadius: 14, border: "1.5px solid var(--border)",
                    background: "var(--white)", color: "var(--mid)", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", fontFamily: "Nunito, sans-serif",
                  }}
                >
                  Skip label
                </button>
              </div>

              <button
                onClick={handleSkip}
                style={{ width: "100%", marginTop: 14, padding: "10px", background: "none", border: "none", color: "var(--light)", fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
              >
                Skip for now — remind me later
              </button>
            </>
          )}

          {/* ── Step: Name ───────────────────────────────────────────── */}
          {step === "name" && (
            <>
              <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: "var(--ink)", marginBottom: 8, lineHeight: 1.3 }}>
                What should we call you?
              </div>
              <p style={{ fontSize: 14, color: "var(--mid)", lineHeight: 1.6, marginBottom: 24 }}>
                Your circle name — up to 20 characters. A nickname, first name, or whatever feels right.
              </p>

              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.slice(0, 20))}
                placeholder={user?.name?.split(" ")[0] ?? "Your name"}
                maxLength={20}
                style={{
                  width: "100%", padding: "14px 16px", borderRadius: 14,
                  border: "2px solid var(--green)", fontSize: 16, fontFamily: "Nunito, sans-serif",
                  outline: "none", boxSizing: "border-box", fontWeight: 700, marginBottom: 6,
                }}
              />
              <div style={{ fontSize: 11, color: "var(--light)", textAlign: "right", marginBottom: 28 }}>
                {displayName.length}/20
              </div>

              {/* Live preview */}
              <div style={{ background: "var(--bg)", borderRadius: 14, padding: "14px 16px", marginBottom: 28, border: "1.5px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--mid)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Preview</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 14 }}>
                    {(displayName.trim() || user?.name || "Y").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>{previewIdentity}</div>
                    <div style={{ fontSize: 11, color: "var(--mid)" }}>Just now</div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setStep("context")}
                  style={{ padding: "13px 18px", borderRadius: 14, border: "1.5px solid var(--border)", background: "var(--white)", color: "var(--mid)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                >
                  ← Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ flex: 1, padding: "13px", borderRadius: 14, border: "none", background: "var(--green)", color: "white", fontSize: 15, fontWeight: 800, cursor: saving ? "default" : "pointer", fontFamily: "Nunito, sans-serif", opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? "Saving…" : "Save my identity ✓"}
                </button>
              </div>

              <button
                onClick={handleSkip}
                style={{ width: "100%", marginTop: 14, padding: "10px", background: "none", border: "none", color: "var(--light)", fontSize: 12, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
              >
                Skip for now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
