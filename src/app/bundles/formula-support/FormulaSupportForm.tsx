"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";

const INK = "#1a1a1a";
const MUTED = "#555555";
const GREEN = "#1a7a5e";
const SERIF = "Lora, Georgia, serif";
const SANS = "Nunito, sans-serif";

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 700, color: INK,
  fontFamily: SANS, marginBottom: 5,
};
const inputStyle: React.CSSProperties = {
  display: "block", width: "100%", padding: "10px 12px", marginBottom: 14,
  border: "1.5px solid #e0e0e0", borderRadius: 10, fontSize: 14, color: INK,
  fontFamily: SANS, background: "white", boxSizing: "border-box", outline: "none",
};

const FORMULA_FORMS = ["Powder", "Ready-to-feed", "Concentrate"] as const;

interface FormState {
  formulaBrand: string;
  formulaType: string;
  formulaStage: string;
  formulaForm: string;
  babyDob: string;
  note: string;
  confirmedFormulaFed: boolean;
  breastfeedingResourcesRequested: boolean;
}

const EMPTY: FormState = {
  formulaBrand: "", formulaType: "", formulaStage: "", formulaForm: "",
  babyDob: "", note: "",
  confirmedFormulaFed: false, breastfeedingResourcesRequested: false,
};

export default function FormulaSupportForm() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !!form.formulaBrand.trim() && !!form.formulaType.trim() &&
    !!form.formulaStage.trim() && !!form.formulaForm && !!form.babyDob && form.confirmedFormulaFed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true); setError(null);
    try {
      const r = await fetch("/api/bundles/formula-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error ?? "Something went wrong. Please try again.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Network error. Please check your connection.");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div style={{ background: "white", border: "1px solid #e8e8e8", borderRadius: 14, padding: "40px 24px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <CheckCircle size={26} color={GREEN} strokeWidth={1.75} />
        </div>
        <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: INK, marginBottom: 8 }}>Request received</div>
        <p style={{ fontSize: 13, color: MUTED, fontFamily: SANS, lineHeight: 1.7, maxWidth: 400, margin: "0 auto" }}>
          Our team will review it individually and follow up with you. Formula support depends on available funding, so
          we cannot guarantee every request, but we will be in touch.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: "white", border: "1px solid #e8e8e8", borderRadius: 14, padding: "20px" }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: INK, fontFamily: SANS, marginBottom: 12 }}>
        Your baby&apos;s exact formula
      </div>

      <label style={labelStyle}>Formula brand *</label>
      <input required value={form.formulaBrand} onChange={(e) => setForm((f) => ({ ...f, formulaBrand: e.target.value }))} placeholder="e.g. Similac, Enfamil, Kirkland" style={inputStyle} />

      <label style={labelStyle}>Type or variant *</label>
      <input required value={form.formulaType} onChange={(e) => setForm((f) => ({ ...f, formulaType: e.target.value }))} placeholder="e.g. Pro Advance, Gentlease, Sensitive" style={inputStyle} />

      <label style={labelStyle}>Stage *</label>
      <input required value={form.formulaStage} onChange={(e) => setForm((f) => ({ ...f, formulaStage: e.target.value }))} placeholder="e.g. Stage 1, 0 to 6 months" style={inputStyle} />

      <label style={labelStyle}>Formula form</label>
      <select required value={form.formulaForm} onChange={(e) => setForm((f) => ({ ...f, formulaForm: e.target.value }))} style={{ ...inputStyle, marginBottom: 6, appearance: "auto" }}>
        <option value="" disabled>Choose one…</option>
        {FORMULA_FORMS.map((ff) => <option key={ff} value={ff}>{ff}</option>)}
      </select>
      <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: SANS, margin: "0 0 16px" }}>
        How your baby&apos;s formula comes — check the packaging if you&apos;re unsure.
      </div>

      <label style={labelStyle}>Baby&apos;s date of birth *</label>
      <input required type="date" value={form.babyDob} onChange={(e) => setForm((f) => ({ ...f, babyDob: e.target.value }))} style={{ ...inputStyle, maxWidth: 220 }} />
      <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: SANS, margin: "-8px 0 16px" }}>
        Approximate is okay. This helps us check the formula suits your baby&apos;s age.
      </div>

      <label style={labelStyle}>Anything else we should know (optional)</label>
      <textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={3} maxLength={500} placeholder="Any relevant detail" style={{ ...inputStyle, resize: "vertical", minHeight: 72 }} />

      {/* Required safety confirmation */}
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#f8faf9", border: "1px solid #e0ede8", borderRadius: 10, padding: "12px 14px", marginBottom: 12, cursor: "pointer" }}>
        <input type="checkbox" checked={form.confirmedFormulaFed} onChange={(e) => setForm((f) => ({ ...f, confirmedFormulaFed: e.target.checked }))} style={{ flexShrink: 0, marginTop: 2, width: 16, height: 16, accentColor: GREEN, cursor: "pointer" }} />
        <span style={{ fontSize: 12.5, color: INK, fontFamily: SANS, lineHeight: 1.6 }}>
          This is for a formula-fed infant currently in my care.
        </span>
      </label>

      {/* Optional breastfeeding-support signal (WHO code: support breastfeeding) */}
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "4px 2px 4px", marginBottom: 16, cursor: "pointer" }}>
        <input type="checkbox" checked={form.breastfeedingResourcesRequested} onChange={(e) => setForm((f) => ({ ...f, breastfeedingResourcesRequested: e.target.checked }))} style={{ flexShrink: 0, marginTop: 2, width: 16, height: 16, accentColor: GREEN, cursor: "pointer" }} />
        <span style={{ fontSize: 12.5, color: MUTED, fontFamily: SANS, lineHeight: 1.6 }}>
          I would also like information about breastfeeding support.
        </span>
      </label>

      {error && (
        <div style={{ padding: "10px 14px", background: "#fdecea", borderRadius: 10, fontSize: 13, color: "#c0392b", fontFamily: SANS, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* Honest expectations, kept directly above the button */}
      <div style={{ fontSize: 12, color: "#6b7280", fontFamily: SANS, lineHeight: 1.6, marginBottom: 12 }}>
        Formula requests are reviewed individually by our team. Formula support depends on available funding, so we
        cannot guarantee every request, but we will follow up with you about next steps.
      </div>

      <button type="submit" disabled={submitting || !canSubmit} style={{ width: "100%", padding: "14px", background: (submitting || !canSubmit) ? "#9ca3af" : GREEN, border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, color: "white", cursor: (submitting || !canSubmit) ? "not-allowed" : "pointer", fontFamily: SANS }}>
        {submitting ? "Submitting…" : "Submit formula request"}
      </button>
    </form>
  );
}
