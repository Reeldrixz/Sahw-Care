"use client";

import { useState } from "react";
import { X, ChevronRight } from "lucide-react";

interface Props {
  journeyType: "pregnant" | "postpartum";
  onCompleted: () => void;
}

export default function StageRefinementBanner({ journeyType, onCompleted }: Props) {
  const [open,       setOpen]       = useState(false);
  const [dismissed,  setDismissed]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // pregnant: due date
  const [dueDate, setDueDate] = useState("");
  // postpartum: birth date
  const [birthDate, setBirthDate] = useState("");

  if (dismissed) return null;

  const dismiss = async (optout = false) => {
    setDismissed(true);
    await fetch("/api/user/stage-refinement", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: optout ? "optout" : "dismiss" }),
    }).catch(() => {});
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    const body =
      journeyType === "pregnant"
        ? { action: "submit", dueDate }
        : { action: "submit", babyBirthDate: birthDate };
    try {
      const res = await fetch("/api/user/stage-refinement", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      onCompleted();
      setOpen(false);
      setDismissed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const inputValid = journeyType === "pregnant" ? !!dueDate : !!birthDate;

  return (
    <>
      {/* Banner */}
      <div style={{
        background: "#e8f5f1", borderRadius: 14, padding: "13px 14px",
        display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
        border: "1px solid #b7dfd1",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 800, color: "#1a7a5e", marginBottom: 2 }}>
            Help us tailor your Circle journey
          </div>
          <div style={{ fontSize: 12, color: "#1a7a5e", opacity: 0.8, fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>
            Share a bit more so we can support you at the right moments.
          </div>
        </div>
        <button
          onClick={() => setOpen(true)}
          style={{
            display: "flex", alignItems: "center", gap: 3,
            background: "#1a7a5e", color: "white", border: "none",
            borderRadius: 10, padding: "7px 12px",
            fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 800,
            cursor: "pointer", flexShrink: 0,
          }}
        >
          Tell us more <ChevronRight size={14} />
        </button>
        <button
          onClick={() => dismiss(false)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 4, display: "flex", alignItems: "center", flexShrink: 0,
          }}
        >
          <X size={14} color="#1a7a5e" opacity={0.6} />
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white", borderRadius: "24px 24px 0 0",
              width: "100%", maxWidth: 520, padding: "28px 20px 48px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
                {journeyType === "pregnant" ? "When is your baby due?" : "What's your baby's birth date?"}
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ background: "var(--bg)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <X size={16} color="var(--mid)" />
              </button>
            </div>

            <div style={{ fontSize: 13, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 24, lineHeight: 1.6 }}>
              {journeyType === "pregnant"
                ? "This helps us predict when you'll transition to your next Circle and give you the right support at the right time."
                : "This helps us tailor your Circle journey and countdown to each new stage."}
            </div>

            {journeyType === "pregnant" ? (
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--mid)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 8 }}>
                  Estimated Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: 12,
                    border: "1.5px solid var(--border)", fontSize: 14,
                    fontFamily: "Nunito, sans-serif", outline: "none",
                    background: "var(--white)", color: "var(--ink)",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ) : (
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--mid)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 8 }}>
                  Baby's Birth Date
                </label>
                <input
                  type="date"
                  value={birthDate}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setBirthDate(e.target.value)}
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: 12,
                    border: "1.5px solid var(--border)", fontSize: 14,
                    fontFamily: "Nunito, sans-serif", outline: "none",
                    background: "var(--white)", color: "var(--ink)",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            {error && (
              <div style={{ fontSize: 12, color: "var(--terra)", background: "#fdf0e8", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontWeight: 600 }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => dismiss(true)}
                style={{
                  flex: 1, padding: "12px", borderRadius: 14,
                  border: "1.5px solid var(--border)", background: "transparent",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                  fontFamily: "Nunito, sans-serif", color: "var(--mid)",
                }}
              >
                Don&apos;t show again
              </button>
              <button
                onClick={submit}
                disabled={saving || !inputValid}
                style={{
                  flex: 2, padding: "12px", borderRadius: 14, border: "none",
                  background: saving || !inputValid ? "#aaa" : "#1a7a5e",
                  color: "white", fontSize: 14, fontWeight: 800, cursor: saving || !inputValid ? "not-allowed" : "pointer",
                  fontFamily: "Nunito, sans-serif",
                }}
              >
                {saving ? "Saving…" : "Save →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
