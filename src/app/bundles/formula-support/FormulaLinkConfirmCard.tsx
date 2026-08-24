"use client";

import { useState } from "react";
import { CheckCircle, AlertTriangle, ExternalLink } from "lucide-react";

const INK = "#1a1a1a";
const MUTED = "#555555";
const GREEN = "#1a7a5e";
const SERIF = "Lora, Georgia, serif";
const SANS = "Nunito, sans-serif";

interface Props {
  episodeId: string;
  purchaseUrl: string;
  formulaBrand: string;
  formulaType: string;
  formulaStage: string;
  formulaForm: string | null;
}

// F3: she checks the exact product before we buy it. The safety of the whole
// flow rests on her actually OPENING the listing, so the link is the hero action
// and "Yes, this is the right product" stays disabled until she does.
//
// The decline button is NEVER gated or disabled, and its note is optional: a
// safety flag must never have a barrier in front of it.
export default function FormulaLinkConfirmCard({
  episodeId, purchaseUrl, formulaBrand, formulaType, formulaStage, formulaForm,
}: Props) {
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "confirmed" | "declined">(null);
  const [showDecline, setShowDecline] = useState(false);
  const [note, setNote] = useState("");

  const confirm = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/bundles/formula-support/${episodeId}/confirm-link`, { method: "POST" });
      if (r.ok) setDone("confirmed");
      else { const d = await r.json().catch(() => ({})); setError(d.error ?? "Something went wrong. Please try again."); }
    } catch { setError("Network error. Please check your connection."); }
    setBusy(false);
  };

  const decline = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch(`/api/bundles/formula-support/${episodeId}/decline-link`, {
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
      <div style={{ background: "#e8f5f1", border: "1px solid #c3e6cb", borderRadius: 14, padding: "32px 24px", marginTop: 20, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "white", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <CheckCircle size={26} color={GREEN} strokeWidth={1.75} />
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: INK, marginBottom: 8 }}>Thank you</div>
        <p style={{ fontSize: 14, color: MUTED, fontFamily: SANS, lineHeight: 1.7, maxWidth: 420, margin: "0 auto" }}>
          We&apos;ll buy exactly this and send it to you. You won&apos;t need to check again unless the product changes.
        </p>
      </div>
    );
  }

  if (done === "declined") {
    return (
      <div style={{ background: "white", border: "1px solid #e8e8e8", borderRadius: 14, padding: "32px 24px", marginTop: 20, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <CheckCircle size={26} color={GREEN} strokeWidth={1.75} />
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: INK, marginBottom: 8 }}>Thank you for telling us</div>
        <p style={{ fontSize: 14, color: MUTED, fontFamily: SANS, lineHeight: 1.7, maxWidth: 420, margin: "0 auto" }}>
          We won&apos;t buy anything until we&apos;ve got it right. We&apos;ll find the correct product and check back with you.
        </p>
      </div>
    );
  }

  const checklist: [string, string][] = [
    ["Brand", formulaBrand],
    ["Type or line", formulaType],
    ["Stage", formulaStage],
    ["Form", formulaForm ?? "—"],
  ];

  return (
    <div style={{ background: "white", border: "1px solid #e8e8e8", borderRadius: 14, padding: "24px 22px", marginTop: 20 }}>
      <h1 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, margin: "0 0 8px" }}>
        Check this is the right formula
      </h1>
      <p style={{ fontSize: 14, color: MUTED, fontFamily: SANS, lineHeight: 1.7, margin: "0 0 16px" }}>
        Before we buy anything, please open the product and make sure it&apos;s exactly what your baby uses.
      </p>

      {/* Safety line */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#fff8ed", border: "1px solid #fde8c8", borderRadius: 10, padding: "12px 14px", marginBottom: 18 }}>
        <AlertTriangle size={16} color="#b45309" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 13, color: "#92400e", fontFamily: SANS, lineHeight: 1.6 }}>
          Formula isn&apos;t interchangeable, and the wrong product can upset or harm a baby. Please open it and check carefully — we&apos;ll buy exactly what you confirm.
        </span>
      </div>

      {/* HERO: the actual product link. The safety of this flow depends on her
          opening it, so it is the biggest, most prominent action on the card. */}
      <a
        href={purchaseUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setOpened(true)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", boxSizing: "border-box", padding: "18px 16px", marginBottom: 18,
          background: opened ? "#0f5c45" : GREEN, border: "none", borderRadius: 12,
          fontSize: 16, fontWeight: 800, color: "white", fontFamily: SANS, textDecoration: "none",
        }}
      >
        <ExternalLink size={18} strokeWidth={2.25} />
        {opened ? "Open the product again" : "Open the product"}
      </a>

      {/* Checklist to compare against */}
      <div style={{ fontSize: 13, fontWeight: 800, color: INK, fontFamily: SANS, marginBottom: 8 }}>
        Then check each of these matches:
      </div>
      <div style={{ marginBottom: 6 }}>
        {checklist.map(([label, value]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0f0f0" }}>
            <span style={{ fontSize: 13, color: MUTED, fontFamily: SANS }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: INK, fontFamily: SANS, textAlign: "right" }}>{value}</span>
          </div>
        ))}
        <div style={{ padding: "10px 0", fontSize: 13, color: MUTED, fontFamily: SANS, lineHeight: 1.6 }}>
          And that the <strong style={{ color: INK }}>tin or pack size</strong> looks like what you buy.
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "#fdecea", borderRadius: 10, fontSize: 13, color: "#c0392b", fontFamily: SANS, marginBottom: 14, marginTop: 8 }}>
          {error}
        </div>
      )}

      {!showDecline ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          <button onClick={confirm} disabled={busy || !opened}
            style={{ width: "100%", padding: "14px", background: (busy || !opened) ? "#9ca3af" : GREEN, border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, color: "white", cursor: (busy || !opened) ? "not-allowed" : "pointer", fontFamily: SANS }}>
            {busy ? "Confirming…" : "Yes, this is the right product"}
          </button>
          {!opened && (
            <div style={{ fontSize: 12, color: "#9ca3af", fontFamily: SANS, textAlign: "center", marginTop: -4 }}>
              Please open the product first.
            </div>
          )}
          {/* Never gated: flagging a problem must always be one tap away. */}
          <button onClick={() => setShowDecline(true)} disabled={busy}
            style={{ width: "100%", padding: "12px", background: "white", border: "1.5px solid #e0e0e0", borderRadius: 12, fontSize: 14, fontWeight: 700, color: INK, cursor: "pointer", fontFamily: SANS }}>
            Something doesn&apos;t look right
          </button>
          <div style={{ fontSize: 12, color: "#9ca3af", fontFamily: SANS, textAlign: "center", lineHeight: 1.6 }}>
            Telling us costs nothing and saves your baby from the wrong formula — please never hesitate.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: INK, fontFamily: SANS }}>
            What doesn&apos;t match? <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. that's the 638g tin, mine is the 964g"
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
