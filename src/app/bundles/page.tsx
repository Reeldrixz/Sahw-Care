"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Package, X, CheckCircle, Box, Sparkles,
  ChevronDown, ChevronRight, Gift, Heart, Users, Truck,
  Shield, Lock, Building2, Clock, AlertCircle,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";

type BundleStage = "PREGNANCY" | "LABOUR" | "NEWBORN" | "POSTPARTUM";

interface BundleItem {
  id: string; code: string; name: string; stage: BundleStage;
  description: string; contentsMarkdown: string;
  estimatedValue: number; slotsPerMonth: number; slotsUsed: number; slotsRemaining: number;
  itemCount: number;
}

type StageFilter = "ALL" | BundleStage;

const STAGE_LABEL: Record<BundleStage, string> = {
  PREGNANCY: "Pregnancy", LABOUR: "Labour & Delivery",
  NEWBORN: "Newborn", POSTPARTUM: "Postpartum",
};

const STAGE_THEME: Record<BundleStage, {
  imageBg: string; cardBorder: string; text: string;
  pillBg: string; pillText: string; dotColor: string;
}> = {
  PREGNANCY:  { imageBg: "#d4edda", cardBorder: "#c3e6cb", text: "#1a7a5e", pillBg: "#e8f5f1", pillText: "#1a7a5e", dotColor: "#a8d5b5" },
  LABOUR:     { imageBg: "#fff3cd", cardBorder: "#fde8a0", text: "#b45309", pillBg: "#fef3c7", pillText: "#b45309", dotColor: "#f9d07a" },
  NEWBORN:    { imageBg: "#d1ecf1", cardBorder: "#bee5eb", text: "#1e50a2", pillBg: "#dbeafe", pillText: "#1e50a2", dotColor: "#93c5fd" },
  POSTPARTUM: { imageBg: "#f8d7da", cardBorder: "#f5c6cb", text: "#9d174d", pillBg: "#fce7f3", pillText: "#9d174d", dotColor: "#f9a8d4" },
};

const STAGE_FILTERS: { key: StageFilter; label: string }[] = [
  { key: "ALL", label: "All" }, { key: "PREGNANCY", label: "Pregnancy" },
  { key: "LABOUR", label: "Labour" }, { key: "NEWBORN", label: "Newborn" },
  { key: "POSTPARTUM", label: "Postpartum" },
];

const PROVINCES = [
  "Alberta","British Columbia","Manitoba","New Brunswick",
  "Newfoundland and Labrador","Northwest Territories","Nova Scotia",
  "Nunavut","Ontario","Prince Edward Island","Quebec","Saskatchewan","Yukon",
];

const FAQS: { q: string; a: string }[] = [
  { q: "Who is eligible for a bundle?", a: "Verified mothers in Canada who are pregnant, have a newborn, or are in the postpartum period. Every application is reviewed by our team to ensure bundles reach those who need them most." },
  { q: "Is this a first-come-first-served system?", a: "No. Applications are reviewed privately by the Kradəl team. Selection considers timing, stage of journey, urgency, verification status, and relevance to the bundle — not simply who applies first." },
  { q: "Where does funding come from?", a: "Kradəl Bundles are funded through platform operations, sponsors, and CSR partners. No mother ever pays for a bundle — they are fully covered." },
  { q: "Can I apply for more than one bundle?", a: "One application per monthly cycle. This ensures fairness across all mothers. If your application is not approved, you're welcome to apply to another relevant bundle in the next cycle." },
  { q: "How long does the review take?", a: "Our team reviews applications within 2–3 business days. You'll receive a private notification through the platform once a decision has been made." },
];

const JOURNEY_STEPS = [
  { label: "Application",     detail: "Submit a short form sharing your stage and situation." },
  { label: "Private Review",  detail: "Our team reviews every application carefully and privately." },
  { label: "Bundle Prepared", detail: "Kradəl sources and packs your curated essentials." },
  { label: "Delivered",       detail: "Your bundle is shipped directly to your door, free." },
  { label: "Ongoing Support", detail: "You're welcomed into the Kradəl community." },
];

const TRUST_PRINCIPLES = [
  { Icon: Heart,       label: "Dignity First",             desc: "Every mother is treated with care and respect — no public competition, no pressure." },
  { Icon: CheckCircle, label: "Quality Guaranteed",        desc: "Only vetted, high-quality products are included in every bundle." },
  { Icon: Shield,      label: "Reviewed Fairly",           desc: "Applications are matched by our team based on stage, urgency, and need — not speed." },
  { Icon: Lock,        label: "Privacy Protected",         desc: "Personal information is never shared, published, or visible to other users." },
];

const fmt = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function getPreviewItems(md: string, n: number): string[] {
  return md.split("\n")
    .filter(l => l.startsWith("- "))
    .slice(0, n)
    .map(l => l.slice(2).replace(/\*[^*]+\*/g, "").trim());
}

function parseMd(md: string): React.ReactNode[] {
  return md.split("\n").filter(l => l.startsWith("- ")).map((line, i) => {
    const text  = line.slice(2);
    const parts = text.split(/(\*[^*]+\*)/g).map((p, j) =>
      p.startsWith("*") && p.endsWith("*") ? <em key={j}>{p.slice(1, -1)}</em> : p
    );
    return <li key={i} style={{ marginBottom: 4 }}>{parts}</li>;
  });
}

interface ApplyForm {
  fullName: string; phone: string; city: string; province: string;
  dueDate: string; babyDob: string; story: string;
  streetAddress: string; unit: string; postalCode: string;
}
const EMPTY_FORM: ApplyForm = {
  fullName: "", phone: "", city: "", province: "",
  dueDate: "", babyDob: "", story: "", streetAddress: "", unit: "", postalCode: "",
};

const MOST_POPULAR = "B06";

export default function BundlesPage() {
  const [bundles,                    setBundles]                    = useState<BundleItem[]>([]);
  const [myActiveApplicationBundleId, setMyActiveApplicationBundleId] = useState<string | null>(null);
  const [loading,                    setLoading]                    = useState(true);
  const [stageFilter,                setStageFilter]                = useState<StageFilter>("ALL");
  const [expanded,                   setExpanded]                   = useState<string | null>(null);
  const [applying,                   setApplying]                   = useState<BundleItem | null>(null);
  const [form,                       setForm]                       = useState<ApplyForm>(EMPTY_FORM);
  const [submitting,                 setSubmitting]                 = useState(false);
  const [submitted,                  setSubmitted]                  = useState(false);
  const [error,                      setError]                      = useState<string | null>(null);
  const [openFaq,                    setOpenFaq]                    = useState<number | null>(null);

  const fetchBundles = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/bundles/catalogue");
    if (r.ok) {
      const d = await r.json();
      setBundles(d.bundles ?? []);
      setMyActiveApplicationBundleId(d.myActiveApplicationBundleId ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBundles(); }, [fetchBundles]);

  const visible         = stageFilter === "ALL" ? bundles : bundles.filter((b) => b.stage === stageFilter);
  const totalInProgress = bundles.reduce((s, b) => s + b.slotsUsed, 0);

  const openApply  = (b: BundleItem) => { setApplying(b); setForm(EMPTY_FORM); setSubmitted(false); setError(null); };
  const closeApply = () => { setApplying(null); setForm(EMPTY_FORM); setSubmitted(false); setError(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applying) return;
    setSubmitting(true); setError(null);
    try {
      const r = await fetch("/api/bundles/apply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundleId: applying.id, ...form,
          dueDate: form.dueDate || null, babyDob: form.babyDob || null, unit: form.unit || null,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error ?? "Something went wrong. Please try again.");
      } else {
        setSubmitted(true);
        fetchBundles();
      }
    } catch { setError("Network error. Please check your connection."); }
    setSubmitting(false);
  };

  const isPregnancy     = applying?.stage === "PREGNANCY";
  const isNewbornOrPost = applying?.stage === "NEWBORN" || applying?.stage === "POSTPARTUM";

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <style>{`
        .hero-inner { display: flex; flex-direction: column; gap: 20px; }
        @media (min-width: 768px) {
          .hero-inner { flex-direction: row; align-items: flex-start; gap: 28px; }
          .hero-left  { flex: 1; }
          .hero-right { width: 280px; flex-shrink: 0; }
        }
        .bundle-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 600px)  { .bundle-grid { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 1024px) { .bundle-grid { grid-template-columns: 1fr 1fr 1fr 1fr; } }
        .bundle-card { background: white; border-radius: 16px; overflow: hidden; transition: box-shadow 0.2s ease, transform 0.2s ease; }
        .bundle-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.11); transform: translateY(-2px); }
        .bundle-card.disabled-card { opacity: 0.55; pointer-events: none; }
        .bottom-row { display: flex; flex-direction: column; gap: 14px; }
        @media (min-width: 768px) { .bottom-row { flex-direction: row; align-items: flex-start; } }
        .journey-col { flex: 65; }
        .sponsor-col { flex: 35; }
        .journey-steps { display: flex; flex-direction: column; }
        @media (min-width: 600px) { .journey-steps { flex-direction: row; align-items: flex-start; } }
        .trust-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (min-width: 768px) { .trust-grid { grid-template-columns: 1fr 1fr 1fr 1fr; } }
      `}</style>

      <div className="discover-desktop">

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <div style={{ background: "#1a7a5e", padding: "36px 20px 32px" }}>
          <div className="hero-inner">

            <div className="hero-left">
              <div style={{ fontFamily: "Lora, serif", fontSize: 30, fontWeight: 700, color: "white", marginBottom: 8, lineHeight: 1.2 }}>
                Kradəl Bundles
              </div>
              <div style={{ fontSize: 17, color: "rgba(255,255,255,0.9)", fontFamily: "Nunito, sans-serif", fontWeight: 700, marginBottom: 10 }}>
                Curated essentials. Delivered with dignity.
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontFamily: "Nunito, sans-serif", lineHeight: 1.65, marginBottom: 24 }}>
                Each month, Kradəl assembles carefully curated care bundles for mothers across Canada —
                fully funded and delivered free of charge. Each bundle is a structured care program,
                reviewed and matched privately by our team.
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                <a href="#bundle-grid" style={{
                  flex: 1, display: "block", textAlign: "center",
                  padding: "12px 0", background: "white",
                  borderRadius: 12, fontSize: 14, fontWeight: 800,
                  color: "#1a7a5e", fontFamily: "Nunito, sans-serif",
                  textDecoration: "none",
                }}>
                  Browse Programs
                </a>
                <button style={{
                  flex: 1, padding: "12px 0",
                  background: "rgba(255,255,255,0.15)",
                  border: "1.5px solid rgba(255,255,255,0.4)",
                  borderRadius: 12, fontSize: 14, fontWeight: 800,
                  color: "white", cursor: "pointer", fontFamily: "Nunito, sans-serif",
                }}>
                  Become a Sponsor
                </button>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["✓  Verified Mothers Only", "✓  Privately Reviewed", "✓  Delivered Free"].map((pill) => (
                  <span key={pill} style={{
                    background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
                    color: "rgba(255,255,255,0.95)", fontSize: 11, fontWeight: 700,
                    padding: "5px 12px", borderRadius: 20, fontFamily: "Nunito, sans-serif",
                  }}>
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — This Month at a Glance */}
            <div className="hero-right">
              <div style={{ background: "white", borderRadius: 16, padding: "18px 18px 14px", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 14 }}>
                  This Month at a Glance
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[
                    { Icon: Package, value: totalInProgress || "—", label: "Applications in review", color: "#1a7a5e", bg: "#e8f5f1" },
                    { Icon: Truck,   value: 4,                      label: "Deliveries this week",  color: "#b45309", bg: "#fef3c7" },
                    { Icon: Heart,   value: "47+",                  label: "Mothers supported",     color: "#9d174d", bg: "#fce7f3" },
                    { Icon: Users,   value: 3,                      label: "Communities active",    color: "#1e50a2", bg: "#dbeafe" },
                  ].map(({ Icon, value, label, color, bg }) => (
                    <div key={label} style={{ background: bg, borderRadius: 12, padding: "10px 10px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={14} color={color} strokeWidth={2} />
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 900, color, fontFamily: "Nunito, sans-serif", lineHeight: 1 }}>{value}</div>
                      <div style={{ fontSize: 10, color: "#555", fontFamily: "Nunito, sans-serif", lineHeight: 1.3 }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", background: "#f8faf9", borderRadius: 10, border: "1px solid #e0ede8" }}>
                  <Gift size={14} color="#1a7a5e" strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: 11, color: "#555", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 800, color: "#1a7a5e" }}>Funded by Kradəl and our sponsors.</span>
                    {" "}Every bundle is fully covered — no cost to any mother.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── STICKY FILTER TABS ─────────────────────────────────────────── */}
        <div style={{ background: "var(--white)", borderBottom: "1px solid var(--border)", padding: "14px 16px 0", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", gap: 0, overflowX: "auto", scrollbarWidth: "none" }}>
            {STAGE_FILTERS.map(({ key, label }) => (
              <button key={key} onClick={() => setStageFilter(key)} style={{
                padding: "8px 14px", background: "none", border: "none",
                borderBottom: `2px solid ${stageFilter === key ? "#1a7a5e" : "transparent"}`,
                fontSize: 13, fontWeight: 700,
                color: stageFilter === key ? "#1a7a5e" : "#555555",
                cursor: "pointer", whiteSpace: "nowrap",
                fontFamily: "Nunito, sans-serif", transition: "all 0.15s",
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* How it works strip */}
        <div style={{ margin: "12px 16px", padding: "14px 16px", background: "#e8f5f1", borderRadius: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>
            How our support programs work
          </div>
          <div style={{ fontSize: 12, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
            Browse the programs below and apply for the one that matches your stage. Applications are reviewed
            privately by the Kradəl team — selection is based on stage, urgency, and relevance, not first-come-first-served.
            Approved bundles are packed and delivered directly to you, completely free.
          </div>
        </div>

        {/* Active application notice */}
        {myActiveApplicationBundleId && (
          <div style={{ margin: "0 16px 12px", padding: "12px 16px", background: "#fef3c7", borderRadius: 12, border: "1px solid #fde68a", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <AlertCircle size={16} color="#b45309" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: "#92400e", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
              <strong style={{ fontWeight: 800 }}>You have an active application this cycle.</strong>
              {" "}Other bundles are paused while your application is under review. If it is not approved, you may apply to a different program next cycle.
            </div>
          </div>
        )}

        {/* ── BUNDLE GRID ────────────────────────────────────────────────── */}
        <div id="bundle-grid" style={{ padding: "0 16px 8px" }}>
          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : visible.length === 0 ? (
            <div style={{ padding: "60px 0", textAlign: "center" }}>
              <div style={{ fontSize: 14, color: "#555555", fontFamily: "Nunito, sans-serif" }}>No bundles found.</div>
            </div>
          ) : (
            <div className="bundle-grid">
              {visible.map((b) => {
                const th      = STAGE_THEME[b.stage];
                const full    = b.slotsRemaining === 0;
                const popular = b.code === MOST_POPULAR;
                const isOpen  = expanded === b.id;

                const isMyApplication = b.id === myActiveApplicationBundleId;
                const isDisabled      = !!myActiveApplicationBundleId && !isMyApplication;
                const preview         = getPreviewItems(b.contentsMarkdown, 3);

                const btnLabel = isMyApplication
                  ? "Application submitted ✓"
                  : isDisabled
                  ? "Another application active"
                  : full
                  ? "Intake closed"
                  : "Apply for support →";

                const btnStyle: React.CSSProperties = {
                  flex: 1, padding: "10px 0",
                  border: "none", borderRadius: 10,
                  fontSize: 12, fontWeight: 800,
                  fontFamily: "Nunito, sans-serif",
                  cursor: (isMyApplication || isDisabled || full) ? "default" : "pointer",
                  background: isMyApplication ? "#e8f5f1"
                    : (isDisabled || full) ? "#f0f0f0"
                    : th.text,
                  color: isMyApplication ? "#1a7a5e"
                    : (isDisabled || full) ? "#9ca3af"
                    : "white",
                };

                return (
                  <div
                    key={b.id}
                    className={`bundle-card${isDisabled ? " disabled-card" : ""}`}
                    style={{ border: `1px solid ${isMyApplication ? "#1a7a5e" : th.cardBorder}`, position: "relative" }}
                  >
                    {/* Image area */}
                    <div style={{
                      height: 200, position: "relative",
                      background: th.imageBg,
                      backgroundImage: `radial-gradient(${th.dotColor}99 1.5px, transparent 1.5px)`,
                      backgroundSize: "22px 22px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      overflow: "hidden",
                    }}>
                      <div style={{
                        width: 72, height: 72, borderRadius: "50%",
                        background: "rgba(255,255,255,0.6)", backdropFilter: "blur(4px)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                      }}>
                        <Package size={32} color={th.text} strokeWidth={1.5} />
                      </div>

                      {/* Most Popular badge */}
                      {popular && !isMyApplication && (
                        <div style={{
                          position: "absolute", top: 12, left: 12,
                          background: "#1a7a5e", color: "white",
                          fontSize: 10, fontWeight: 800, padding: "4px 10px",
                          borderRadius: 20, fontFamily: "Nunito, sans-serif",
                          display: "flex", alignItems: "center", gap: 4,
                        }}>
                          <Sparkles size={10} strokeWidth={2} />
                          Most Popular
                        </div>
                      )}

                      {/* "Application submitted" badge on my bundle */}
                      {isMyApplication && (
                        <div style={{
                          position: "absolute", top: 12, left: 12,
                          background: "#1a7a5e", color: "white",
                          fontSize: 10, fontWeight: 800, padding: "4px 10px",
                          borderRadius: 20, fontFamily: "Nunito, sans-serif",
                          display: "flex", alignItems: "center", gap: 4,
                        }}>
                          <CheckCircle size={10} strokeWidth={2.5} />
                          Applied
                        </div>
                      )}

                      {/* Value chip */}
                      <div style={{
                        position: "absolute", top: 12, right: 12,
                        background: "rgba(255,255,255,0.85)", backdropFilter: "blur(4px)",
                        padding: "4px 10px", borderRadius: 20,
                        fontSize: 12, fontWeight: 800, color: th.text,
                        fontFamily: "Nunito, sans-serif",
                      }}>
                        {fmt(b.estimatedValue)} value
                      </div>
                    </div>

                    {/* Card body */}
                    <div style={{ padding: "14px 14px 12px" }}>
                      {/* Code + stage pill */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>{b.code}</span>
                        <span style={{ color: "#d0d0d0" }}>·</span>
                        <span style={{ background: th.pillBg, color: th.pillText, fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, fontFamily: "Nunito, sans-serif" }}>
                          {STAGE_LABEL[b.stage]}
                        </span>
                      </div>

                      {/* Name */}
                      <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "#1a1a1a", marginBottom: 5, lineHeight: 1.3 }}>
                        {b.name}
                      </div>

                      {/* Description */}
                      <div style={{
                        fontSize: 12, color: "#666", fontFamily: "Nunito, sans-serif",
                        lineHeight: 1.5, marginBottom: 10,
                        display: "-webkit-box", WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}>
                        {b.description}
                      </div>

                      {/* Inline content preview chips */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
                        {preview.map((item) => (
                          <span key={item} style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px",
                            borderRadius: 20, background: th.pillBg, color: th.pillText,
                            fontFamily: "Nunito, sans-serif",
                          }}>
                            {item}
                          </span>
                        ))}
                        {b.itemCount > 3 && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px",
                            borderRadius: 20, background: "#f3f4f6", color: "#6b7280",
                            fontFamily: "Nunito, sans-serif",
                          }}>
                            +{b.itemCount - 3} more
                          </span>
                        )}
                      </div>

                      {/* Intake status (replaces progress bar) */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, color: "#9ca3af", fontFamily: "Nunito, sans-serif", marginBottom: 5, fontWeight: 600 }}>
                          Monthly intake: {b.slotsPerMonth} mothers
                        </div>
                        {full ? (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fef3c7", borderRadius: 20, padding: "4px 10px" }}>
                            <Clock size={10} color="#b45309" strokeWidth={2.5} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#b45309", fontFamily: "Nunito, sans-serif" }}>Applications under review</span>
                          </div>
                        ) : (
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: isMyApplication ? "#e8f5f1" : `${th.pillBg}`, borderRadius: 20, padding: "4px 10px" }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: isMyApplication ? "#1a7a5e" : th.text, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: isMyApplication ? "#1a7a5e" : th.text, fontFamily: "Nunito, sans-serif" }}>
                              {isMyApplication
                                ? "Your application is under review"
                                : `${b.slotsRemaining} ${b.slotsRemaining === 1 ? "space" : "spaces"} remaining · Intake open`}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button
                          onClick={() => setExpanded(isOpen ? null : b.id)}
                          style={{
                            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                            border: `1.5px solid ${th.cardBorder}`,
                            background: isOpen ? th.pillBg : "white",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", transition: "background 0.15s",
                          }}
                          title="View contents"
                        >
                          <ChevronRight size={16} color={th.text} strokeWidth={2}
                            style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "0.2s" }} />
                        </button>
                        <button
                          onClick={() => !isMyApplication && !isDisabled && !full && openApply(b)}
                          style={btnStyle}
                        >
                          {btnLabel}
                        </button>
                      </div>
                    </div>

                    {/* Expandable full contents */}
                    {isOpen && (
                      <div style={{ borderTop: `1px solid ${th.cardBorder}`, padding: "12px 14px 14px", background: th.pillBg }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: th.text, fontFamily: "Nunito, sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          What&apos;s included ({b.itemCount} items)
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 16, listStyle: "disc", fontSize: 12, color: "#444", fontFamily: "Nunito, sans-serif", lineHeight: 1.7 }}>
                          {parseMd(b.contentsMarkdown)}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!loading && (
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button
                onClick={() => { setStageFilter("ALL"); document.getElementById("bundle-grid")?.scrollIntoView({ behavior: "smooth" }); }}
                style={{
                  padding: "11px 28px", background: "none",
                  border: "1.5px solid #1a7a5e", borderRadius: 12,
                  fontSize: 13, fontWeight: 800, color: "#1a7a5e",
                  cursor: "pointer", fontFamily: "Nunito, sans-serif",
                }}
              >
                View all 12 support programs →
              </button>
            </div>
          )}
        </div>

        {/* ── PRIVATE REVIEW NOTE ────────────────────────────────────────── */}
        <div style={{ margin: "12px 16px 0", padding: "16px 18px", background: "white", borderRadius: 14, border: "1px solid #e8e8e8", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Shield size={17} color="#1a7a5e" strokeWidth={1.75} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", marginBottom: 3 }}>
              Applications are reviewed privately
            </div>
            <div style={{ fontSize: 12, color: "#666", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
              Selection is not first-come-first-served. Our team reviews every application privately
              to ensure fair and relevant support — considering your stage, urgency, and verification status.
            </div>
          </div>
        </div>

        {/* ── BOTTOM ROW: Journey + Sponsor ──────────────────────────────── */}
        <div className="bottom-row" style={{ padding: "12px 16px 0" }}>

          <div className="journey-col" style={{ background: "white", borderRadius: 16, border: "1px solid #e8e8e8", padding: "22px 20px" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>
              How support reaches mothers
            </div>
            <div style={{ fontSize: 12, color: "#666", fontFamily: "Nunito, sans-serif", marginBottom: 20, lineHeight: 1.5 }}>
              A private, careful process — from application to your doorstep.
            </div>

            <div className="journey-steps">
              {JOURNEY_STEPS.map((step, i) => (
                <div key={step.label} style={{ display: "flex", flex: 1 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", width: "100%", marginBottom: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                        background: "#1a7a5e", color: "white",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 900, fontFamily: "Nunito, sans-serif",
                      }}>
                        {i + 1}
                      </div>
                      {i < JOURNEY_STEPS.length - 1 && (
                        <div style={{ flex: 1, height: 2, background: "#e0e0e0", margin: "0 6px" }} />
                      )}
                    </div>
                    <div style={{ width: "100%", paddingRight: i < JOURNEY_STEPS.length - 1 ? 12 : 0, paddingBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", marginBottom: 3 }}>{step.label}</div>
                      <div style={{ fontSize: 11, color: "#666", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>{step.detail}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: "10px 14px", background: "#fafafa", borderRadius: 10, border: "1px solid #e8e8e8", display: "flex", alignItems: "flex-start", gap: 8 }}>
              <Lock size={13} color="#9ca3af" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 11, color: "#888", fontFamily: "Nunito, sans-serif", lineHeight: 1.5, fontStyle: "italic" }}>
                The matching and review process is always private. No mother&apos;s application is visible to anyone outside the Kradəl team.
              </div>
            </div>
          </div>

          <div className="sponsor-col" style={{ background: "#0f5c45", borderRadius: 16, padding: "24px 20px" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "white", marginBottom: 8 }}>
              Sponsors Make It Possible
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "Nunito, sans-serif", lineHeight: 1.65, marginBottom: 20 }}>
              Every bundle delivered is made possible by the generosity of our sponsors.
              Join organisations committed to maternal dignity across Canada.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {[
                { Icon: Gift,      text: "Sponsor a Bundle Cycle" },
                { Icon: Users,     text: "Sponsor a Community"    },
                { Icon: Building2, text: "Corporate Partnerships" },
              ].map(({ Icon, text }) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={15} color="rgba(255,255,255,0.9)" strokeWidth={1.75} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "Nunito, sans-serif" }}>{text}</span>
                </div>
              ))}
            </div>

            <button style={{
              width: "100%", padding: "11px 0", background: "transparent",
              border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 12,
              fontSize: 13, fontWeight: 800, color: "white", cursor: "pointer",
              fontFamily: "Nunito, sans-serif",
            }}>
              Learn about CSR benefits →
            </button>
          </div>
        </div>

        {/* ── TRUST PRINCIPLES ───────────────────────────────────────────── */}
        <div style={{ padding: "12px 16px 0" }}>
          <div className="trust-grid">
            {TRUST_PRINCIPLES.map(({ Icon, label, desc }) => (
              <div key={label} style={{ background: "white", borderRadius: 14, border: "1px solid #e8e8e8", padding: "16px 14px" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <Icon size={17} color="#1a7a5e" strokeWidth={1.75} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 11, color: "#666", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ ACCORDION ──────────────────────────────────────────────── */}
        <div style={{ margin: "12px 16px 0", padding: "22px 20px 6px", background: "white", borderRadius: 16, border: "1px solid #e8e8e8" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, color: "#1a1a1a", marginBottom: 18 }}>
            Frequently asked questions
          </div>
          {FAQS.map(({ q, a }, i) => {
            const open = openFaq === i;
            return (
              <div key={i} style={{ borderBottom: i < FAQS.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                <button
                  onClick={() => setOpenFaq(open ? null : i)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", flex: 1 }}>{q}</span>
                  <ChevronDown size={16} color="#9ca3af" strokeWidth={2} style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }} />
                </button>
                {open && (
                  <div style={{ fontSize: 13, color: "#555", fontFamily: "Nunito, sans-serif", lineHeight: 1.65, paddingBottom: 14 }}>{a}</div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ height: 100 }} />
      </div>

      <BottomNav />

      {/* ── APPLY MODAL ────────────────────────────────────────────────── */}
      {applying && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeApply(); }}
        >
          <div style={{ width: "100%", maxWidth: 640, background: "white", borderRadius: "20px 20px 0 0", maxHeight: "90vh", overflowY: "auto", padding: "0 0 32px" }}>
            <div style={{ position: "sticky", top: 0, background: "white", padding: "16px 20px 12px", borderBottom: "1px solid #f0f0f0", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, color: "#1a1a1a" }}>Apply — {applying.name}</div>
                <div style={{ fontSize: 12, color: "#555555", fontFamily: "Nunito, sans-serif" }}>
                  Reviewed privately by the Kradəl team
                </div>
              </div>
              <button onClick={closeApply} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <X size={20} color="#555555" />
              </button>
            </div>

            {submitted ? (
              <div style={{ padding: "48px 24px", textAlign: "center" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <CheckCircle size={28} color="#1a7a5e" strokeWidth={1.75} />
                </div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>Application received</div>
                <div style={{ fontSize: 13, color: "#555555", fontFamily: "Nunito, sans-serif", lineHeight: 1.7, marginBottom: 8, maxWidth: 340, margin: "0 auto 8px" }}>
                  Thank you for applying for the <strong>{applying.name}</strong>.
                </div>
                <div style={{ fontSize: 12, color: "#888", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, maxWidth: 340, margin: "0 auto 24px" }}>
                  Our team will review your application privately. You&apos;ll receive a notification within 2–3 business days. This is not a first-come-first-served process — every application is read carefully.
                </div>
                <button onClick={closeApply} style={{ padding: "12px 32px", background: "#1a7a5e", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, color: "white", cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Done</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ padding: "20px 20px 0" }}>
                {/* Private review notice */}
                <div style={{ background: "#e8f5f1", borderRadius: 10, padding: "10px 14px", marginBottom: 20, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Shield size={14} color="#1a7a5e" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 11, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
                    Your application is reviewed privately by our team. Selection is based on stage, urgency, and relevance — not speed of submission.
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", marginBottom: 12 }}>About you</div>
                  <label style={labelStyle}>Full name *</label>
                  <input required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Your full name" style={inputStyle} />
                  <label style={labelStyle}>Phone number *</label>
                  <input required type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="e.g. 416-555-0100" style={inputStyle} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={labelStyle}>City *</label>
                      <input required value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="City" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Province *</label>
                      <select required value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} style={inputStyle}>
                        <option value="">Select…</option>
                        {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  {isPregnancy && (<><label style={labelStyle}>Due date (approximate)</label><input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} style={inputStyle} /></>)}
                  {isNewbornOrPost && (<><label style={labelStyle}>Baby&apos;s date of birth</label><input type="date" value={form.babyDob} onChange={(e) => setForm((f) => ({ ...f, babyDob: e.target.value }))} style={inputStyle} /></>)}
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>Your situation *</div>
                  <div style={{ fontSize: 11, color: "#555555", fontFamily: "Nunito, sans-serif", marginBottom: 8 }}>
                    Tell us a little about your situation and why this bundle would support you (100–500 characters).
                  </div>
                  <textarea required minLength={100} maxLength={500} value={form.story} onChange={(e) => setForm((f) => ({ ...f, story: e.target.value }))} placeholder="Share a bit about your journey…" rows={4} style={{ ...inputStyle, resize: "vertical", minHeight: 90 }} />
                  <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "Nunito, sans-serif", textAlign: "right" }}>{form.story.length}/500</div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>Delivery address</div>
                  <div style={{ fontSize: 11, color: "#555555", fontFamily: "Nunito, sans-serif", marginBottom: 12 }}>
                    Your bundle will be delivered here. Your address is only shared with our fulfilment team and never published.
                  </div>
                  <label style={labelStyle}>Street address *</label>
                  <input required value={form.streetAddress} onChange={(e) => setForm((f) => ({ ...f, streetAddress: e.target.value }))} placeholder="123 Main St" style={inputStyle} />
                  <label style={labelStyle}>Unit / Apt (optional)</label>
                  <input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="Unit 4B" style={inputStyle} />
                  <label style={labelStyle}>Postal code *</label>
                  <input required value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} placeholder="A1A 1A1" style={{ ...inputStyle, maxWidth: 160 }} />
                </div>

                {error && (
                  <div style={{ padding: "10px 14px", background: "#fdecea", borderRadius: 10, fontSize: 13, color: "#c0392b", fontFamily: "Nunito, sans-serif", marginBottom: 16 }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={submitting} style={{ width: "100%", padding: "14px", background: submitting ? "#9ca3af" : "#1a7a5e", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, color: "white", cursor: submitting ? "not-allowed" : "pointer", fontFamily: "Nunito, sans-serif", marginBottom: 12 }}>
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
  display: "block", fontSize: 12, fontWeight: 700, color: "#1a1a1a",
  fontFamily: "Nunito, sans-serif", marginBottom: 5,
};
const inputStyle: React.CSSProperties = {
  display: "block", width: "100%", padding: "10px 12px", marginBottom: 14,
  border: "1.5px solid #e0e0e0", borderRadius: 10, fontSize: 14, color: "#1a1a1a",
  fontFamily: "Nunito, sans-serif", background: "white", boxSizing: "border-box", outline: "none",
};
