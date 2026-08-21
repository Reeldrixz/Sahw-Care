"use client";

import { useState } from "react";
import { CheckCircle, AlertTriangle } from "lucide-react";

const INK = "#1a1a1a";
const MUTED = "#555555";
const GREEN = "#1a7a5e";
const SERIF = "Lora, Georgia, serif";
const SANS = "Nunito, sans-serif";

interface Props {
  episodeId: string;
  formulaBrand: string;
  formulaType: string;
  formulaStage: string;
  formulaForm: string | null;
}

export default function FormulaConfirmCard({ episodeId, formulaBrand, formulaType, formulaStage, formulaForm }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "confirmed" | "corrected">(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [note, setNote] = useState("");

  const confirm = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/bundles/formula-support/${episodeId}/confirm`, { method: "POST" });
      if (r.ok) setDone("confirmed");
      else { const d = await r.json().catch(() => ({})); setError(d.error ?? "Something went wrong. Please try again."); }
    } catch { setError("Network error. Please check your connection."); }
    setBusy(false);
  };

  const sendCorrection = async () => {
    if (!note.trim()) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/bundles/formula-support/${episodeId}/request-correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
      });
      if (r.ok) setDone("corrected");
      else { const d = await r.json().catch(() => ({})); setError(d.error ?? "Something went wrong. Please try again."); }
    } catch { setError("Network error. Please check your connection."); }
    setBusy(false);
  };

  if (done === "confirmed") {
    return (
      <div style={{ background: "#e8f5f1", border: "1px solid #c3e6cb", borderRadius: 14, padding: "36px 24px", marginTop: 20, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "white", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <CheckCircle size={26} color={GREEN} strokeWidth={1.75} />
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: INK, marginBottom: 8 }}>Your formula support is active</div>
        <p style={{ fontSize: 14, color: MUTED, fontFamily: SANS, lineHeight: 1.7, maxWidth: 420, margin: "0 auto" }}>
          Thank you. Your formula support is now active. We&apos;re preparing your first month now. We aim for every month, though occasionally one may be delayed.
        </p>
      </div>
    );
  }

  if (done === "corrected") {
    return (
      <div style={{ background: "white", border: "1px solid #e8e8e8", borderRadius: 14, padding: "36px 24px", marginTop: 20, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <CheckCircle size={26} color={GREEN} strokeWidth={1.75} />
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: INK, marginBottom: 8 }}>Thank you</div>
        <p style={{ fontSize: 14, color: MUTED, fontFamily: SANS, lineHeight: 1.7, maxWidth: 420, margin: "0 auto" }}>
          We&apos;ve flagged this for our team. We&apos;ll update the details and check back with you before sending anything.
        </p>
      </div>
    );
  }

  const specRow = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
      <span style={{ fontSize: 13, color: MUTED, fontFamily: SANS }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: INK, fontFamily: SANS, textAlign: "right" }}>{value}</span>
    </div>
  );

  return (
    <div style={{ background: "white", border: "1px solid #e8e8e8", borderRadius: 14, padding: "24px 22px", marginTop: 20 }}>
      <h1 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, margin: "0 0 12px" }}>
        Confirm your baby&apos;s formula
      </h1>

      {/* Safety line */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#fff8ed", border: "1px solid #fde8c8", borderRadius: 10, padding: "12px 14px", marginBottom: 18 }}>
        <AlertTriangle size={16} color="#b45309" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 13, color: "#92400e", fontFamily: SANS, lineHeight: 1.6 }}>
          Formula isn&apos;t interchangeable, and the wrong product can upset or harm a baby. Please check every detail below matches exactly what your baby uses right now.
        </span>
      </div>

      {/* Exact spec */}
      <div style={{ marginBottom: 18 }}>
        {specRow("Brand", formulaBrand)}
        {specRow("Type or line", formulaType)}
        {specRow("Stage", formulaStage)}
        {specRow("Form", formulaForm ?? "—")}
      </div>

      {/* Honest caveat */}
      <p style={{ fontSize: 13, color: MUTED, fontFamily: SANS, lineHeight: 1.7, marginBottom: 20 }}>
        Formula support provides your baby&apos;s formula for six months — a one-time program with a clear end. We aim for every month, but can&apos;t always guarantee an uninterrupted schedule.
      </p>

      {error && (
        <div style={{ padding: "10px 14px", background: "#fdecea", borderRadius: 10, fontSize: 13, color: "#c0392b", fontFamily: SANS, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {!showCorrection ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={confirm} disabled={busy}
            style={{ width: "100%", padding: "14px", background: busy ? "#9ca3af" : GREEN, border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, color: "white", cursor: busy ? "not-allowed" : "pointer", fontFamily: SANS }}>
            {busy ? "Confirming…" : "Yes, this is exactly what my baby uses"}
          </button>
          <button onClick={() => setShowCorrection(true)} disabled={busy}
            style={{ width: "100%", padding: "12px", background: "white", border: "1.5px solid #e0e0e0", borderRadius: 12, fontSize: 14, fontWeight: 700, color: INK, cursor: "pointer", fontFamily: SANS }}>
            Something isn&apos;t right
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: INK, fontFamily: SANS }}>Tell us what needs to change</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. the stage should be Stage 2, or the type is Gentlease not Advance"
            style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e0e0e0", borderRadius: 10, fontSize: 14, fontFamily: SANS, resize: "vertical", minHeight: 80, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={sendCorrection} disabled={busy || !note.trim()}
              style={{ flex: 1, padding: "12px", background: (busy || !note.trim()) ? "#9ca3af" : GREEN, border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, color: "white", cursor: (busy || !note.trim()) ? "not-allowed" : "pointer", fontFamily: SANS }}>
              {busy ? "Sending…" : "Send correction"}
            </button>
            <button onClick={() => { setShowCorrection(false); setNote(""); }} disabled={busy}
              style={{ padding: "12px 16px", background: "white", border: "1.5px solid #e0e0e0", borderRadius: 12, fontSize: 14, fontWeight: 700, color: MUTED, cursor: "pointer", fontFamily: SANS }}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
