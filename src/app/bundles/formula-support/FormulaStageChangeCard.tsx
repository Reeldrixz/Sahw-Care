"use client";

import { useState } from "react";
import { CheckCircle, AlertTriangle, TrendingUp } from "lucide-react";

const INK = "#1a1a1a";
const MUTED = "#555555";
const GREEN = "#1a7a5e";
const SERIF = "Lora, Georgia, serif";
const SANS = "Nunito, sans-serif";

interface Props {
  episodeId: string;
  currentStage: string;
  proposedStage: string;
}

// D/F4d: mother's re-confirmation of a proposed stage-for-growth change. Mirrors
// FormulaConfirmCard's confirm-before-applies safety: nothing changes until she
// says yes. Declining leaves her baby on the current stage.
export default function FormulaStageChangeCard({ episodeId, currentStage, proposedStage }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "confirmed" | "declined">(null);
  const [showDecline, setShowDecline] = useState(false);
  const [note, setNote] = useState("");

  const confirm = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/bundles/formula-support/${episodeId}/confirm-stage`, { method: "POST" });
      if (r.ok) setDone("confirmed");
      else { const d = await r.json().catch(() => ({})); setError(d.error ?? "Something went wrong. Please try again."); }
    } catch { setError("Network error. Please check your connection."); }
    setBusy(false);
  };

  const decline = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/bundles/formula-support/${episodeId}/decline-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note.trim() ? { note: note.trim() } : {}),
      });
      if (r.ok) setDone("declined");
      else { const d = await r.json().catch(() => ({})); setError(d.error ?? "Something went wrong. Please try again."); }
    } catch { setError("Network error. Please check your connection."); }
    setBusy(false);
  };

  if (done === "confirmed") {
    return (
      <div style={{ background: "#e8f5f1", border: "1px solid #c3e6cb", borderRadius: 14, padding: "28px 24px", marginTop: 20, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "white", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <CheckCircle size={26} color={GREEN} strokeWidth={1.75} />
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: INK, marginBottom: 8 }}>Thank you</div>
        <p style={{ fontSize: 14, color: MUTED, fontFamily: SANS, lineHeight: 1.7, maxWidth: 420, margin: "0 auto" }}>
          Your formula is now Stage {proposedStage}. Your next month will be sent at the new stage.
        </p>
      </div>
    );
  }

  if (done === "declined") {
    return (
      <div style={{ background: "white", border: "1px solid #e8e8e8", borderRadius: 14, padding: "28px 24px", marginTop: 20, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <CheckCircle size={26} color={GREEN} strokeWidth={1.75} />
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: INK, marginBottom: 8 }}>Thank you</div>
        <p style={{ fontSize: 14, color: MUTED, fontFamily: SANS, lineHeight: 1.7, maxWidth: 420, margin: "0 auto" }}>
          We&apos;ve kept your formula at Stage {currentStage} and let our team know.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: "white", border: "1px solid #e8e8e8", borderRadius: 14, padding: "24px 22px", marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <TrendingUp size={22} color={GREEN} strokeWidth={2} />
        <h1 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, margin: 0 }}>
          A stage update for your baby
        </h1>
      </div>

      <p style={{ fontSize: 14, color: MUTED, fontFamily: SANS, lineHeight: 1.7, margin: "0 0 16px" }}>
        As babies grow, formula moves up in stages. We&apos;d like to update your support from{" "}
        <strong style={{ color: INK }}>Stage {currentStage}</strong> to <strong style={{ color: INK }}>Stage {proposedStage}</strong>.
        Only the stage changes — same brand, same type, same form.
      </p>

      {/* Safety line */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#fff8ed", border: "1px solid #fde8c8", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
        <AlertTriangle size={16} color="#b45309" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 13, color: "#92400e", fontFamily: SANS, lineHeight: 1.6 }}>
          Formula isn&apos;t interchangeable, and the wrong product can upset or harm a baby. Please confirm Stage {proposedStage} is right for your baby before we send it.
        </span>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "#fdecea", borderRadius: 10, fontSize: 13, color: "#c0392b", fontFamily: SANS, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {!showDecline ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={confirm} disabled={busy}
            style={{ width: "100%", padding: "14px", background: busy ? "#9ca3af" : GREEN, border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, color: "white", cursor: busy ? "not-allowed" : "pointer", fontFamily: SANS }}>
            {busy ? "Confirming…" : `Yes, move to Stage ${proposedStage}`}
          </button>
          <button onClick={() => setShowDecline(true)} disabled={busy}
            style={{ width: "100%", padding: "12px", background: "white", border: "1.5px solid #e0e0e0", borderRadius: 12, fontSize: 14, fontWeight: 700, color: INK, cursor: "pointer", fontFamily: SANS }}>
            This isn&apos;t right
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: INK, fontFamily: SANS }}>Tell us what&apos;s wrong</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. my baby is still on Stage 1"
            style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e0e0e0", borderRadius: 10, fontSize: 14, fontFamily: SANS, resize: "vertical", minHeight: 80, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={decline} disabled={busy}
              style={{ flex: 1, padding: "12px", background: busy ? "#9ca3af" : GREEN, border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, color: "white", cursor: busy ? "not-allowed" : "pointer", fontFamily: SANS }}>
              {busy ? "Sending…" : "Send"}
            </button>
            <button onClick={() => { setShowDecline(false); setNote(""); }} disabled={busy}
              style={{ padding: "12px 16px", background: "white", border: "1.5px solid #e0e0e0", borderRadius: 12, fontSize: 14, fontWeight: 700, color: MUTED, cursor: "pointer", fontFamily: SANS }}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
