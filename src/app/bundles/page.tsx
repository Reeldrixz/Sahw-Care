"use client";

import { useEffect, useState, useCallback } from "react";
import { Package, X, ChevronDown, CheckCircle } from "lucide-react";
import BottomNav from "@/components/BottomNav";

type BundleStage = "PREGNANCY" | "LABOUR" | "NEWBORN" | "POSTPARTUM";

interface BundleItem {
  id: string;
  code: string;
  name: string;
  stage: BundleStage;
  description: string;
  contentsMarkdown: string;
  estimatedValue: number;
  slotsPerMonth: number;
  slotsUsed: number;
  slotsRemaining: number;
}

type StageFilter = "ALL" | BundleStage;

const STAGE_LABEL: Record<BundleStage, string> = {
  PREGNANCY:  "Pregnancy",
  LABOUR:     "Labour",
  NEWBORN:    "Newborn",
  POSTPARTUM: "Postpartum",
};

const STAGE_COLOR: Record<BundleStage, { bg: string; text: string; bar: string; light: string }> = {
  PREGNANCY:  { bg: "#e8f5f1", text: "#1a7a5e", bar: "#1a7a5e",  light: "#e8f5f1" },
  LABOUR:     { bg: "#fff8ed", text: "#d97706", bar: "#d97706",  light: "#fff8ed" },
  NEWBORN:    { bg: "#e0f2fe", text: "#0284c7", bar: "#0284c7",  light: "#e0f2fe" },
  POSTPARTUM: { bg: "#fce7f3", text: "#be185d", bar: "#be185d",  light: "#fce7f3" },
};

const STAGE_FILTERS: { key: StageFilter; label: string }[] = [
  { key: "ALL",       label: "All"       },
  { key: "PREGNANCY", label: "Pregnancy" },
  { key: "LABOUR",    label: "Labour"    },
  { key: "NEWBORN",   label: "Newborn"   },
  { key: "POSTPARTUM",label: "Postpartum"},
];

const PROVINCES = [
  "Alberta","British Columbia","Manitoba","New Brunswick",
  "Newfoundland and Labrador","Northwest Territories","Nova Scotia",
  "Nunavut","Ontario","Prince Edward Island","Quebec","Saskatchewan","Yukon",
];

const fmt = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function parseMd(md: string): React.ReactNode[] {
  return md.split("\n").map((line, i) => {
    const text = line.replace(/^- /, "");
    const parts = text.split(/(\*[^*]+\*)/g).map((p, j) =>
      p.startsWith("*") && p.endsWith("*")
        ? <em key={j}>{p.slice(1, -1)}</em>
        : p
    );
    return (
      <li key={i} style={{ marginBottom: 4 }}>{parts}</li>
    );
  });
}

interface ApplyForm {
  fullName: string;
  phone: string;
  city: string;
  province: string;
  dueDate: string;
  babyDob: string;
  story: string;
  streetAddress: string;
  unit: string;
  postalCode: string;
}

const EMPTY_FORM: ApplyForm = {
  fullName: "", phone: "", city: "", province: "",
  dueDate: "", babyDob: "", story: "",
  streetAddress: "", unit: "", postalCode: "",
};

export default function BundlesPage() {
  const [bundles, setBundles]         = useState<BundleItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [stageFilter, setStageFilter] = useState<StageFilter>("ALL");
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [applying, setApplying]       = useState<BundleItem | null>(null);
  const [form, setForm]               = useState<ApplyForm>(EMPTY_FORM);
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const fetchBundles = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/bundles/catalogue");
    if (r.ok) {
      const d = await r.json();
      setBundles(d.bundles ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBundles(); }, [fetchBundles]);

  const visible = stageFilter === "ALL"
    ? bundles
    : bundles.filter((b) => b.stage === stageFilter);

  const openApply = (b: BundleItem) => {
    setApplying(b);
    setForm(EMPTY_FORM);
    setSubmitted(false);
    setError(null);
  };

  const closeApply = () => {
    setApplying(null);
    setForm(EMPTY_FORM);
    setSubmitted(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applying) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/bundles/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundleId: applying.id,
          ...form,
          dueDate:  form.dueDate  || null,
          babyDob:  form.babyDob  || null,
          unit:     form.unit     || null,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error ?? "Something went wrong. Please try again.");
      } else {
        setSubmitted(true);
        fetchBundles(); // refresh slot counts
      }
    } catch {
      setError("Network error. Please check your connection.");
    }
    setSubmitting(false);
  };

  const isPregnancy = applying?.stage === "PREGNANCY";
  const isNewbornOrPost = applying?.stage === "NEWBORN" || applying?.stage === "POSTPARTUM";

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">
        {/* Header */}
        <div style={{
          background: "var(--white)", borderBottom: "1px solid var(--border)",
          padding: "16px 16px 0", position: "sticky", top: 0, zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", background: "#e8f5f1",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Package size={18} color="#1a7a5e" strokeWidth={1.75} />
            </div>
            <div>
              <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2 }}>
                Care Bundles
              </div>
              <div style={{ fontSize: 12, color: "#555555", fontFamily: "Nunito, sans-serif" }}>
                Free care packages for mothers in need
              </div>
            </div>
          </div>

          {/* Stage filter tabs */}
          <div style={{ display: "flex", gap: 0, overflowX: "auto", scrollbarWidth: "none" }}>
            {STAGE_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStageFilter(key)}
                style={{
                  padding: "8px 14px", background: "none", border: "none",
                  borderBottom: `2px solid ${stageFilter === key ? "#1a7a5e" : "transparent"}`,
                  fontSize: 13, fontWeight: 700,
                  color: stageFilter === key ? "#1a7a5e" : "#555555",
                  cursor: "pointer", whiteSpace: "nowrap",
                  fontFamily: "Nunito, sans-serif",
                  transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Intro strip */}
        <div style={{
          margin: "12px 16px", padding: "14px 16px",
          background: "#e8f5f1", borderRadius: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>
            How it works
          </div>
          <div style={{ fontSize: 12, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
            Choose a bundle that matches your stage, fill in a short application, and our team will review it.
            Approved bundles are purchased and delivered directly to you — completely free. Each bundle has 10 slots per month.
          </div>
        </div>

        {/* Bundle grid */}
        <div style={{ padding: "0 16px 100px" }}>
          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : visible.length === 0 ? (
            <div style={{ padding: "60px 0", textAlign: "center" }}>
              <div style={{ fontSize: 14, color: "#555555", fontFamily: "Nunito, sans-serif" }}>
                No bundles found.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {visible.map((b) => {
                const sc = STAGE_COLOR[b.stage];
                const pct = Math.round((b.slotsUsed / b.slotsPerMonth) * 100);
                const full = b.slotsRemaining === 0;
                const isOpen = expanded === b.id;

                return (
                  <div
                    key={b.id}
                    style={{
                      background: "white", borderRadius: 16,
                      border: "1px solid #e0e0e0", overflow: "hidden",
                    }}
                  >
                    {/* Card header */}
                    <div style={{ padding: "16px 16px 12px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{
                              background: sc.bg, color: sc.text,
                              fontSize: 10, fontWeight: 800, padding: "2px 8px",
                              borderRadius: 20, fontFamily: "Nunito, sans-serif",
                              textTransform: "uppercase", letterSpacing: "0.5px",
                            }}>
                              {STAGE_LABEL[b.stage]}
                            </span>
                            <span style={{
                              fontSize: 10, color: "#9ca3af",
                              fontFamily: "Nunito, sans-serif", fontWeight: 700,
                            }}>
                              {b.code}
                            </span>
                          </div>
                          <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>
                            {b.name}
                          </div>
                          <div style={{ fontSize: 12, color: "#555555", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>
                            {b.description}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#1a7a5e", fontFamily: "Nunito, sans-serif" }}>
                            {fmt(b.estimatedValue)}
                          </div>
                          <div style={{ fontSize: 10, color: "#9ca3af", fontFamily: "Nunito, sans-serif" }}>
                            est. value
                          </div>
                        </div>
                      </div>

                      {/* Slot bar */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 11, color: "#555555", fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>
                            {full ? "All slots filled this month" : `${b.slotsRemaining} of ${b.slotsPerMonth} slots available`}
                          </span>
                          <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "Nunito, sans-serif" }}>
                            {pct}%
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: "#f0f0f0", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", borderRadius: 3,
                            background: full ? "#c0392b" : sc.bar,
                            width: `${pct}%`,
                            transition: "width 0.4s ease",
                          }} />
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => setExpanded(isOpen ? null : b.id)}
                          style={{
                            flex: 1, padding: "9px 0",
                            background: "none", border: "1.5px solid #e0e0e0",
                            borderRadius: 10, fontSize: 12, fontWeight: 700,
                            color: "#555555", cursor: "pointer",
                            fontFamily: "Nunito, sans-serif",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                          }}
                        >
                          What&apos;s included
                          <ChevronDown size={13} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "0.2s" }} />
                        </button>
                        <button
                          onClick={() => !full && openApply(b)}
                          disabled={full}
                          style={{
                            flex: 1, padding: "9px 0",
                            background: full ? "#f0f0f0" : "#1a7a5e",
                            border: "none", borderRadius: 10,
                            fontSize: 12, fontWeight: 800, color: full ? "#9ca3af" : "white",
                            cursor: full ? "not-allowed" : "pointer",
                            fontFamily: "Nunito, sans-serif",
                          }}
                        >
                          {full ? "Full this month" : "Apply"}
                        </button>
                      </div>
                    </div>

                    {/* Expandable contents */}
                    {isOpen && (
                      <div style={{
                        borderTop: "1px solid #f0f0f0",
                        padding: "12px 16px",
                        background: "#fafafa",
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", marginBottom: 8 }}>
                          What&apos;s included:
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
                          {parseMd(b.contentsMarkdown)}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNav />

      {/* Apply modal */}
      {applying && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }}
          onClick={(e) => { if (e.target === e.currentTarget) closeApply(); }}
        >
          <div style={{
            width: "100%", maxWidth: 640,
            background: "white", borderRadius: "20px 20px 0 0",
            maxHeight: "90vh", overflowY: "auto",
            padding: "0 0 32px",
          }}>
            {/* Modal header */}
            <div style={{
              position: "sticky", top: 0, background: "white",
              padding: "16px 20px 12px",
              borderBottom: "1px solid #f0f0f0", zIndex: 1,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, color: "#1a1a1a" }}>
                  Apply — {applying.name}
                </div>
                <div style={{ fontSize: 12, color: "#555555", fontFamily: "Nunito, sans-serif" }}>
                  {applying.slotsRemaining} slot{applying.slotsRemaining !== 1 ? "s" : ""} remaining this month
                </div>
              </div>
              <button onClick={closeApply} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <X size={20} color="#555555" />
              </button>
            </div>

            {submitted ? (
              <div style={{ padding: "48px 24px", textAlign: "center" }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%", background: "#e8f5f1",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                }}>
                  <CheckCircle size={28} color="#1a7a5e" strokeWidth={1.75} />
                </div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>
                  Application received!
                </div>
                <div style={{ fontSize: 13, color: "#555555", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, marginBottom: 24 }}>
                  Thank you for applying for the <strong>{applying.name}</strong> bundle.
                  Our team will review your application and be in touch within 2–3 business days.
                </div>
                <button
                  onClick={closeApply}
                  style={{
                    padding: "12px 32px", background: "#1a7a5e", border: "none",
                    borderRadius: 12, fontSize: 14, fontWeight: 800, color: "white",
                    cursor: "pointer", fontFamily: "Nunito, sans-serif",
                  }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ padding: "20px 20px 0" }}>
                {/* Personal details */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", marginBottom: 12 }}>
                    About you
                  </div>

                  <label style={labelStyle}>Full name *</label>
                  <input
                    required value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="Your full name"
                    style={inputStyle}
                  />

                  <label style={labelStyle}>Phone number *</label>
                  <input
                    required type="tel" value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="e.g. 416-555-0100"
                    style={inputStyle}
                  />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>City *</label>
                      <input
                        required value={form.city}
                        onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                        placeholder="City"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Province *</label>
                      <select
                        required value={form.province}
                        onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
                        style={inputStyle}
                      >
                        <option value="">Select…</option>
                        {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>

                  {isPregnancy && (
                    <>
                      <label style={labelStyle}>Due date (approximate)</label>
                      <input
                        type="date" value={form.dueDate}
                        onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                        style={inputStyle}
                      />
                    </>
                  )}

                  {isNewbornOrPost && (
                    <>
                      <label style={labelStyle}>Baby&apos;s date of birth</label>
                      <input
                        type="date" value={form.babyDob}
                        onChange={(e) => setForm((f) => ({ ...f, babyDob: e.target.value }))}
                        style={inputStyle}
                      />
                    </>
                  )}
                </div>

                {/* Story */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>
                    Your story *
                  </div>
                  <div style={{ fontSize: 11, color: "#555555", fontFamily: "Nunito, sans-serif", marginBottom: 8 }}>
                    Tell us a little about your situation and why this bundle would help (100–500 characters).
                  </div>
                  <textarea
                    required minLength={100} maxLength={500}
                    value={form.story}
                    onChange={(e) => setForm((f) => ({ ...f, story: e.target.value }))}
                    placeholder="Share a bit about your journey…"
                    rows={4}
                    style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
                  />
                  <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "Nunito, sans-serif", textAlign: "right" }}>
                    {form.story.length}/500
                  </div>
                </div>

                {/* Delivery address */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>
                    Delivery address
                  </div>
                  <div style={{ fontSize: 11, color: "#555555", fontFamily: "Nunito, sans-serif", marginBottom: 12 }}>
                    Your bundle will be delivered directly to this address. Your address is only shared with our fulfilment team and never published.
                  </div>

                  <label style={labelStyle}>Street address *</label>
                  <input
                    required value={form.streetAddress}
                    onChange={(e) => setForm((f) => ({ ...f, streetAddress: e.target.value }))}
                    placeholder="123 Main St"
                    style={inputStyle}
                  />

                  <label style={labelStyle}>Unit / Apt (optional)</label>
                  <input
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                    placeholder="Unit 4B"
                    style={inputStyle}
                  />

                  <label style={labelStyle}>Postal code *</label>
                  <input
                    required value={form.postalCode}
                    onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                    placeholder="A1A 1A1"
                    style={{ ...inputStyle, maxWidth: 160 }}
                  />
                </div>

                {error && (
                  <div style={{
                    padding: "10px 14px", background: "#fdecea", borderRadius: 10,
                    fontSize: 13, color: "#c0392b", fontFamily: "Nunito, sans-serif",
                    marginBottom: 16,
                  }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    width: "100%", padding: "14px",
                    background: submitting ? "#9ca3af" : "#1a7a5e",
                    border: "none", borderRadius: 12,
                    fontSize: 15, fontWeight: 800, color: "white",
                    cursor: submitting ? "not-allowed" : "pointer",
                    fontFamily: "Nunito, sans-serif",
                    marginBottom: 12,
                  }}
                >
                  {submitting ? "Submitting…" : "Submit application"}
                </button>

                <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", fontFamily: "Nunito, sans-serif", paddingBottom: 8 }}>
                  By applying you confirm the information above is accurate and that you are based in Canada.
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12, fontWeight: 700, color: "#1a1a1a",
  fontFamily: "Nunito, sans-serif",
  marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  display: "block", width: "100%",
  padding: "10px 12px", marginBottom: 14,
  border: "1.5px solid #e0e0e0", borderRadius: 10,
  fontSize: 14, color: "#1a1a1a",
  fontFamily: "Nunito, sans-serif",
  background: "white", boxSizing: "border-box",
  outline: "none",
};
