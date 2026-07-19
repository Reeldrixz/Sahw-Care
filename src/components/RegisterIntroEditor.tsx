"use client";

import { useState } from "react";
import { Sparkles, Loader2, Check, X, Pencil } from "lucide-react";

const MAX_INPUT = 1500;

export default function RegisterIntroEditor({
  registerId,
  firstName,
  initialIntro,
  onSaved,
}: {
  registerId: string;
  firstName: string;
  initialIntro: string | null;
  onSaved: (intro: string | null) => void;
}) {
  const [intro, setIntro]       = useState<string | null>(initialIntro);
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState(initialIntro ?? "");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [polishing, setPolishing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const open = () => {
    setDraft(intro ?? "");
    setSuggestion(null);
    setError(null);
    setEditing(true);
  };

  const polish = async () => {
    if (!draft.trim()) { setError("Write your intro first."); return; }
    setError(null);
    setPolishing(true);
    setSuggestion(null);
    try {
      const res = await fetch(`/api/registers/${registerId}/intro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft.trim() }),
      });
      const d = await res.json();
      if (res.ok) setSuggestion(d.edited);
      else setError(d.error ?? "Could not polish your intro.");
    } catch {
      setError("Could not polish your intro.");
    }
    setPolishing(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/registers/${registerId}/intro`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intro: draft.trim() || null }),
      });
      const d = await res.json();
      if (res.ok) {
        setIntro(d.intro ?? null);
        onSaved(d.intro ?? null);
        setEditing(false);
        setSuggestion(null);
      } else {
        setError(d.error ?? "Could not save.");
      }
    } catch {
      setError("Could not save.");
    }
    setSaving(false);
  };

  // ── Collapsed view ──────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div style={{ margin: "16px 16px 0", background: "var(--white)", borderRadius: 12, border: "1px solid var(--border)", padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", color: "var(--ink)" }}>Your intro</div>
          <button
            onClick={open}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "1.5px solid var(--green)", color: "var(--green)", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
          >
            <Pencil size={12} strokeWidth={2.25} /> {intro ? "Edit" : "Add your intro"}
          </button>
        </div>
        {intro ? (
          <div style={{ fontSize: 12.5, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{intro}</div>
        ) : (
          <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
            You haven&apos;t added a personal intro yet. Donors currently see a default message. Add your own words to tell them, in your voice, what this register means to you.
          </div>
        )}
      </div>
    );
  }

  // ── Editing view ────────────────────────────────────────────────────────────
  return (
    <div style={{ margin: "16px 16px 0", background: "var(--white)", borderRadius: 12, border: "1.5px solid var(--green)", padding: "16px" }}>
      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "Lora, serif", color: "#1a3a2e", marginBottom: 4 }}>Write your intro</div>
      <div style={{ fontSize: 11.5, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.5, marginBottom: 10 }}>
        Tell donors, in your own words, what this register means to you. You can polish it with a light AI edit. It only fixes grammar and tightens wording, never changes your story. You always have the final say.
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, MAX_INPUT))}
        placeholder={`e.g. I'm ${firstName}, and I'm getting ready to welcome my first baby…`}
        rows={5}
        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", resize: "vertical", outline: "none", lineHeight: 1.55, boxSizing: "border-box" }}
      />
      <div style={{ fontSize: 11, color: "var(--light)", fontFamily: "Nunito, sans-serif", textAlign: "right", marginTop: 4 }}>
        {draft.length}/{MAX_INPUT}
      </div>

      <button
        onClick={polish}
        disabled={polishing || !draft.trim()}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#e8f5f1", border: "none", color: "#1a7a5e", borderRadius: 20, padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: draft.trim() ? "pointer" : "default", fontFamily: "Nunito, sans-serif", opacity: draft.trim() ? 1 : 0.5, marginTop: 4 }}
      >
        {polishing ? <Loader2 size={13} strokeWidth={2.5} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={13} strokeWidth={2.25} />}
        {polishing ? "Polishing…" : "Polish with AI"}
      </button>

      {/* AI suggestion — requires her explicit approval to apply */}
      {suggestion && (
        <div style={{ marginTop: 12, background: "#f9faf8", border: "1px solid #d8e8e1", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Suggested edit</div>
          <div style={{ fontSize: 13, color: "var(--ink)", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 10 }}>{suggestion}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { setDraft(suggestion); setSuggestion(null); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--green)", border: "none", color: "white", borderRadius: 20, padding: "7px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
            >
              <Check size={13} strokeWidth={2.5} /> Use this version
            </button>
            <button
              onClick={() => setSuggestion(null)}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "1.5px solid var(--border)", color: "var(--mid)", borderRadius: 20, padding: "7px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
            >
              <X size={13} strokeWidth={2.5} /> Keep mine
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#c0392b", fontFamily: "Nunito, sans-serif", fontWeight: 600 }}>{error}</div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button
          onClick={() => { setEditing(false); setSuggestion(null); setError(null); }}
          style={{ flex: 1, background: "none", border: "1.5px solid var(--border)", color: "var(--mid)", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving}
          style={{ flex: 2, background: "var(--green)", border: "none", color: "white", borderRadius: 10, padding: "11px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Publishing…" : draft.trim() ? "Publish intro" : "Remove intro"}
        </button>
      </div>
    </div>
  );
}
