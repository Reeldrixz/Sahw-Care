"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Package, X, CheckCircle, ArrowRight, Box, Sparkles,
  ChevronDown, ChevronRight, Gift, Heart, Users, Truck,
  Shield, Lock, Building2,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";

type BundleStage = "PREGNANCY" | "LABOUR" | "NEWBORN" | "POSTPARTUM";

interface BundleItem {
  id: string; code: string; name: string; stage: BundleStage;
  description: string; contentsMarkdown: string;
  estimatedValue: number; slotsPerMonth: number; slotsUsed: number; slotsRemaining: number;
}

type StageFilter = "ALL" | BundleStage;

const STAGE_LABEL: Record<BundleStage, string> = {
  PREGNANCY: "Pregnancy", LABOUR: "Labour & Delivery",
  NEWBORN: "Newborn", POSTPARTUM: "Postpartum",
};

const STAGE_THEME: Record<BundleStage, {
  imageBg: string; cardBorder: string; text: string; bar: string;
  pillBg: string; pillText: string; dotColor: string;
}> = {
  PREGNANCY:  { imageBg: "#d4edda", cardBorder: "#c3e6cb", text: "#1a7a5e", bar: "#1a7a5e", pillBg: "#e8f5f1", pillText: "#1a7a5e", dotColor: "#a8d5b5" },
  LABOUR:     { imageBg: "#fff3cd", cardBorder: "#fde8a0", text: "#b45309", bar: "#d97706", pillBg: "#fef3c7", pillText: "#b45309", dotColor: "#f9d07a" },
  NEWBORN:    { imageBg: "#d1ecf1", cardBorder: "#bee5eb", text: "#1e50a2", bar: "#3b82f6", pillBg: "#dbeafe", pillText: "#1e50a2", dotColor: "#93c5fd" },
  POSTPARTUM: { imageBg: "#f8d7da", cardBorder: "#f5c6cb", text: "#9d174d", bar: "#ec4899", pillBg: "#fce7f3", pillText: "#9d174d", dotColor: "#f9a8d4" },
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
  { q: "Who receives bundles?", a: "Verified mothers in Canada who are pregnant, in labour, have a newborn, or are in the postpartum period. Every application is reviewed by our team to ensure bundles reach those who need them most." },
  { q: "Where does funding come from?", a: "Kradəl Bundles are funded through platform operations and our generous sponsor community. No mother ever pays for a bundle — they are fully covered by Kradəl." },
  { q: "Can I choose which mother receives my support?", a: "No. To protect every mother's privacy and ensure the system is fair, our matching process is entirely private. All mothers are treated equally regardless of location, background, or circumstance." },
  { q: "Can I apply for a second bundle?", a: "Yes. Each bundle type resets every month. If your situation changes — for example your baby is born after you applied for a Pregnancy bundle — you are welcome to apply for the bundle that matches your current stage." },
];

const JOURNEY_STEPS = [
  { label: "Application",     detail: "Submit a short form with your stage and situation." },
  { label: "Review & Match",  detail: "Our team reviews every application privately and carefully." },
  { label: "Bundle Prepared", detail: "Kradəl sources and packs your curated essentials." },
  { label: "Delivered",       detail: "Your bundle is shipped directly to your door, free." },
  { label: "Ongoing Support", detail: "You're welcomed into the Kradəl community." },
];

const TRUST_PRINCIPLES = [
  { Icon: Heart,        label: "Dignity First",              desc: "Every mother is treated with care and respect." },
  { Icon: CheckCircle,  label: "Quality Guaranteed",         desc: "Only vetted, high-quality products in every bundle." },
  { Icon: Shield,       label: "Transparent & Responsible",  desc: "We publish how resources are allocated." },
  { Icon: Lock,         label: "Privacy Protected",          desc: "Personal information is never shared or sold." },
];

const fmt = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function itemCount(md: string) {
  return md.split("\n").filter((l) => l.startsWith("- ")).length;
}

function parseMd(md: string): React.ReactNode[] {
  return md.split("\n").map((line, i) => {
    const text  = line.replace(/^- /, "");
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
  const [bundles, setBundles]         = useState<BundleItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [stageFilter, setStageFilter] = useState<StageFilter>("ALL");
  const [expanded, setExpanded]       = useState<string | null>(null);
  const [applying, setApplying]       = useState<BundleItem | null>(null);
  const [form, setForm]               = useState<ApplyForm>(EMPTY_FORM);
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [openFaq, setOpenFaq]         = useState<number | null>(null);

  const fetchBundles = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/bundles/catalogue");
    if (r.ok) { const d = await r.json(); setBundles(d.bundles ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBundles(); }, [fetchBundles]);

  const visible          = stageFilter === "ALL" ? bundles : bundles.filter((b) => b.stage === stageFilter);
  const totalInProgress  = bundles.reduce((s, b) => s + b.slotsUsed, 0);

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
      } else { setSubmitted(true); fetchBundles(); }
    } catch { setError("Network error. Please check your connection."); }
    setSubmitting(false);
  };

  const isPregnancy     = applying?.stage === "PREGNANCY";
  const isNewbornOrPost = applying?.stage === "NEWBORN" || applying?.stage === "POSTPARTUM";

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <style>{`
        /* Hero */
        .hero-inner { display: flex; flex-direction: column; gap: 20px; }
        @media (min-width: 768px) {
          .hero-inner { flex-direction: row; align-items: flex-start; gap: 28px; }
          .hero-left  { flex: 1; }
          .hero-right { width: 280px; flex-shrink: 0; }
        }
        /* Bundle grid */
        .bundle-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        @media (min-width: 600px)  { .bundle-grid { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 1024px) { .bundle-grid { grid-template-columns: 1fr 1fr 1fr 1fr; } }
        /* Card */
        .bundle-card { background: white; border-radius: 16px; overflow: hidden; transition: box-shadow 0.2s ease, transform 0.2s ease; }
        .bundle-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.11); transform: translateY(-2px); }
        /* Bottom row */
        .bottom-row { display: flex; flex-direction: column; gap: 14px; }
        @media (min-width: 768px) { .bottom-row { flex-direction: row; align-items: flex-start; } }
        .journey-col { flex: 65; }
        .sponsor-col { flex: 35; }
        /* Journey steps */
        .journey-steps { display: flex; flex-direction: column; }
        @media (min-width: 600px) { .journey-steps { flex-direction: row; align-items: flex-start; } }
        /* Trust grid */
        .trust-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (min-width: 768px) { .trust-grid { grid-template-columns: 1fr 1fr 1fr 1fr; } }
      `}</style>

      <div className="discover-desktop">

        {/* ══════════════════════════════════════
            HERO — 2-col on desktop
        ══════════════════════════════════════ */}
        <div style={{ background: "#1a7a5e", padding: "36px 20px 32px", borderRadius: "0 0 0 0" }}>
          <div className="hero-inner">

            {/* Left column */}
            <div className="hero-left">
              <div style={{ fontFamily: "Lora, serif", fontSize: 30, fontWeight: 700, color: "white", marginBottom: 8, lineHeight: 1.2 }}>
                Kradəl Bundles
              </div>
              <div style={{ fontSize: 17, color: "rgba(255,255,255,0.9)", fontFamily: "Nunito, sans-serif", fontWeight: 700, marginBottom: 10 }}>
                Curated essentials. Delivered with dignity.
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontFamily: "Nunito, sans-serif", lineHeight: 1.65, marginBottom: 24 }}>
                Every month, Kradəl assembles and ships curated care bundles to mothers across Canada —
                free of charge. From pregnancy vitamins to newborn starter kits, each bundle is chosen
                with intention and delivered with love.
              </div>

              {/* CTA buttons */}
              <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                <a href="#bundle-grid" style={{
                  flex: 1, display: "block", textAlign: "center",
                  padding: "12px 0", background: "white",
                  borderRadius: 12, fontSize: 14, fontWeight: 800,
                  color: "#1a7a5e", fontFamily: "Nunito, sans-serif",
                  textDecoration: "none",
                }}>
                  Browse Bundles
                </a>
                <button style={{
                  flex: 1, padding: "12px 0",
                  background: "rgba(255,255,255,0.15)",
                  border: "1.5px solid rgba(255,255,255,0.4)",
                  borderRadius: 12, fontSize: 14, fontWeight: 800,
                  color: "white", cursor: "pointer",
                  fontFamily: "Nunito, sans-serif",
                }}>
                  Become a Sponsor
                </button>
              </div>

              {/* Trust pills */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["✓  Verified Mothers Only", "✓  Private & Respectful", "✓  Delivered Directly"].map((pill) => (
                  <span key={pill} style={{
                    background: "rgba(255,255,255,0.15)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    color: "rgba(255,255,255,0.95)",
                    fontSize: 11, fontWeight: 700,
                    padding: "5px 12px", borderRadius: 20,
                    fontFamily: "Nunito, sans-serif",
                  }}>
                    {pill}
                  </span>
                ))}
              </div>
            </div>

            {/* Right column — This Month at a Glance */}
            <div className="hero-right">
              <div style={{
                background: "white", borderRadius: 16,
                padding: "18px 18px 14px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 14 }}>
                  This Month at a Glance
                </div>

                {/* 4 stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[
                    { Icon: Package, value: totalInProgress || "—", label: "Bundles in progress", color: "#1a7a5e", bg: "#e8f5f1" },
                    { Icon: Truck,   value: 4,                      label: "Deliveries this week", color: "#b45309", bg: "#fef3c7" },
                    { Icon: Heart,   value: "47+",                  label: "Mothers supported",    color: "#9d174d", bg: "#fce7f3" },
                    { Icon: Users,   value: 3,                      label: "Communities active",   color: "#1e50a2", bg: "#dbeafe" },
                  ].map(({ Icon, value, label, color, bg }) => (
                    <div key={label} style={{ background: bg, borderRadius: 12, padding: "10px 10px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={14} color={color} strokeWidth={2} />
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 900, color, fontFamily: "Nunito, sans-serif", lineHeight: 1 }}>
                        {value}
                      </div>
                      <div style={{ fontSize: 10, color: "#555", fontFamily: "Nunito, sans-serif", lineHeight: 1.3 }}>
                        {label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Gift note */}
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  padding: "10px 12px", background: "#f8faf9",
                  borderRadius: 10, border: "1px solid #e0ede8",
                }}>
                  <Gift size={14} color="#1a7a5e" strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: 11, color: "#555", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 800, color: "#1a7a5e" }}>Powered by Kradəl and our amazing sponsors.</span>
                    {" "}Together we build stronger starts for families.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════
            STICKY FILTER TABS
        ══════════════════════════════════════ */}
        <div style={{
          background: "var(--white)", borderBottom: "1px solid var(--border)",
          padding: "14px 16px 0", position: "sticky", top: 0, zIndex: 10,
        }}>
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
            How it works
          </div>
          <div style={{ fontSize: 12, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
            Choose a bundle that matches your stage, fill in a short application, and our team will review it.
            Approved bundles are purchased and delivered directly to you — completely free. Each bundle has 10 slots per month.
          </div>
        </div>

        {/* ══════════════════════════════════════
            BUNDLE GRID
        ══════════════════════════════════════ */}
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
                const count   = itemCount(b.contentsMarkdown);
                const pct     = Math.round((b.slotsUsed / b.slotsPerMonth) * 100);
                const full    = b.slotsRemaining === 0;
                const popular = b.code === MOST_POPULAR;
                const isOpen  = expanded === b.id;

                return (
                  <div key={b.id} className="bundle-card" style={{ border: `1px solid ${th.cardBorder}` }}>

                    {/* Image area — coloured bg + dot pattern */}
                    <div style={{
                      height: 220, position: "relative",
                      background: th.imageBg,
                      backgroundImage: `radial-gradient(${th.dotColor}99 1.5px, transparent 1.5px)`,
                      backgroundSize: "22px 22px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      overflow: "hidden",
                    }}>
                      {/* Frosted icon circle */}
                      <div style={{
                        width: 72, height: 72, borderRadius: "50%",
                        background: "rgba(255,255,255,0.6)",
                        backdropFilter: "blur(4px)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                      }}>
                        <Package size={32} color={th.text} strokeWidth={1.5} />
                      </div>

                      {/* Most Popular badge */}
                      {popular && (
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

                      {/* Value chip */}
                      <div style={{
                        position: "absolute", top: 12, right: 12,
                        background: "rgba(255,255,255,0.80)",
                        backdropFilter: "blur(4px)",
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

                      {/* Description — 2-line clamp */}
                      <div style={{
                        fontSize: 12, color: "#666", fontFamily: "Nunito, sans-serif",
                        lineHeight: 1.5, marginBottom: 10,
                        display: "-webkit-box", WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}>
                        {b.description}
                      </div>

                      {/* Metadata tags */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#555", fontFamily: "Nunito, sans-serif" }}>
                          <Box size={11} color={th.text} strokeWidth={2} />
                          {count} essentials
                        </span>
                        <span style={{ color: "#d0d0d0", fontSize: 11 }}>·</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#555", fontFamily: "Nunito, sans-serif" }}>
                          <Sparkles size={11} color={th.text} strokeWidth={2} />
                          {STAGE_LABEL[b.stage]}
                        </span>
                      </div>

                      {/* Slot bar */}
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: full ? "#c0392b" : "#555", fontFamily: "Nunito, sans-serif" }}>
                            {full ? "All slots filled" : `${b.slotsRemaining} slot${b.slotsRemaining !== 1 ? "s" : ""} left`}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 800, color: full ? "#c0392b" : th.text, fontFamily: "Nunito, sans-serif" }}>
                            {pct}% filled
                          </span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: "#ebebeb", overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 3, background: full ? "#c0392b" : th.bar, width: `${pct}%`, transition: "width 0.4s ease" }} />
                        </div>
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
                          title="See what's included"
                        >
                          <ArrowRight size={16} color={th.text} strokeWidth={2}
                            style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "0.2s" }} />
                        </button>
                        <button
                          onClick={() => !full && openApply(b)}
                          disabled={full}
                          style={{
                            flex: 1, padding: "10px 0",
                            background: full ? "#f0f0f0" : th.text,
                            border: "none", borderRadius: 10,
                            fontSize: 13, fontWeight: 800,
                            color: full ? "#9ca3af" : "white",
                            cursor: full ? "not-allowed" : "pointer",
                            fontFamily: "Nunito, sans-serif",
                          }}
                        >
                          {full ? "Full this month" : "Apply now →"}
                        </button>
                      </div>
                    </div>

                    {/* Expandable contents */}
                    {isOpen && (
                      <div style={{ borderTop: `1px solid ${th.cardBorder}`, padding: "12px 14px 14px", background: th.pillBg }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: th.text, fontFamily: "Nunito, sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          What&apos;s included
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 16, listStyle: "disc", fontSize: 12, color: "#444", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
                          {parseMd(b.contentsMarkdown)}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* View all button */}
          {!loading && (
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button
                onClick={() => { setStageFilter("ALL"); document.getElementById("bundle-grid")?.scrollIntoView({ behavior: "smooth" }); }}
                style={{
                  padding: "11px 28px",
                  background: "none",
                  border: "1.5px solid #1a7a5e",
                  borderRadius: 12,
                  fontSize: 13, fontWeight: 800, color: "#1a7a5e",
                  cursor: "pointer", fontFamily: "Nunito, sans-serif",
                }}
              >
                View all 12 bundle programs →
              </button>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════
            BOTTOM ROW: Journey + Sponsor
        ══════════════════════════════════════ */}
        <div className="bottom-row" style={{ padding: "12px 16px 0" }}>

          {/* Journey — 65% */}
          <div className="journey-col" style={{ background: "white", borderRadius: 16, border: "1px solid #e8e8e8", padding: "22px 20px" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>
              How bundles reach mothers
            </div>
            <div style={{ fontSize: 12, color: "#666", fontFamily: "Nunito, sans-serif", marginBottom: 20, lineHeight: 1.5 }}>
              A private, careful process — from application to doorstep.
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
              <ChevronRight size={14} color="#9ca3af" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 11, color: "#888", fontFamily: "Nunito, sans-serif", lineHeight: 1.5, fontStyle: "italic" }}>
                Internal matching logic is never shown — we keep the system fair and private for every mother.
              </div>
            </div>
          </div>

          {/* Sponsor panel — 35% */}
          <div className="sponsor-col" style={{ background: "#0f5c45", borderRadius: 16, padding: "24px 20px" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "white", marginBottom: 8 }}>
              Sponsors Make It Possible
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "Nunito, sans-serif", lineHeight: 1.65, marginBottom: 20 }}>
              Every bundle delivered is made possible by the generosity of our sponsors.
              Join a growing community of organisations committed to maternal dignity across Canada.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {[
                { Icon: Gift,       text: "Sponsor a Bundle Cycle" },
                { Icon: Users,      text: "Sponsor a Community"    },
                { Icon: Building2,  text: "Corporate Partnerships" },
              ].map(({ Icon, text }) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={15} color="rgba(255,255,255,0.9)" strokeWidth={1.75} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "Nunito, sans-serif" }}>
                    {text}
                  </span>
                </div>
              ))}
            </div>

            <button style={{
              width: "100%", padding: "11px 0",
              background: "transparent",
              border: "1.5px solid rgba(255,255,255,0.5)",
              borderRadius: 12, fontSize: 13, fontWeight: 800,
              color: "white", cursor: "pointer",
              fontFamily: "Nunito, sans-serif",
            }}>
              Learn about CSR benefits →
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════
            TRUST PRINCIPLES — 4 columns
        ══════════════════════════════════════ */}
        <div style={{ padding: "12px 16px 0" }}>
          <div className="trust-grid">
            {TRUST_PRINCIPLES.map(({ Icon, label, desc }) => (
              <div key={label} style={{ background: "white", borderRadius: 14, border: "1px solid #e8e8e8", padding: "16px 14px" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <Icon size={17} color="#1a7a5e" strokeWidth={1.75} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>
                  {label}
                </div>
                <div style={{ fontSize: 11, color: "#666", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════
            FAQ ACCORDION
        ══════════════════════════════════════ */}
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
                  <div style={{ fontSize: 13, color: "#555", fontFamily: "Nunito, sans-serif", lineHeight: 1.65, paddingBottom: 14 }}>
                    {a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ height: 100 }} />
      </div>

      <BottomNav />

      {/* ══════════════════════════════════════
          APPLY MODAL
      ══════════════════════════════════════ */}
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
                  {applying.slotsRemaining} slot{applying.slotsRemaining !== 1 ? "s" : ""} remaining this month
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
                <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>Application received!</div>
                <div style={{ fontSize: 13, color: "#555555", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, marginBottom: 24 }}>
                  Thank you for applying for the <strong>{applying.name}</strong> bundle.
                  Our team will review your application and be in touch within 2–3 business days.
                </div>
                <button onClick={closeApply} style={{ padding: "12px 32px", background: "#1a7a5e", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, color: "white", cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Done</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ padding: "20px 20px 0" }}>
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
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>Your story *</div>
                  <div style={{ fontSize: 11, color: "#555555", fontFamily: "Nunito, sans-serif", marginBottom: 8 }}>Tell us a little about your situation and why this bundle would help (100–500 characters).</div>
                  <textarea required minLength={100} maxLength={500} value={form.story} onChange={(e) => setForm((f) => ({ ...f, story: e.target.value }))} placeholder="Share a bit about your journey…" rows={4} style={{ ...inputStyle, resize: "vertical", minHeight: 90 }} />
                  <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "Nunito, sans-serif", textAlign: "right" }}>{form.story.length}/500</div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>Delivery address</div>
                  <div style={{ fontSize: 11, color: "#555555", fontFamily: "Nunito, sans-serif", marginBottom: 12 }}>Your bundle will be delivered directly to this address. Your address is only shared with our fulfilment team and never published.</div>
                  <label style={labelStyle}>Street address *</label>
                  <input required value={form.streetAddress} onChange={(e) => setForm((f) => ({ ...f, streetAddress: e.target.value }))} placeholder="123 Main St" style={inputStyle} />
                  <label style={labelStyle}>Unit / Apt (optional)</label>
                  <input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="Unit 4B" style={inputStyle} />
                  <label style={labelStyle}>Postal code *</label>
                  <input required value={form.postalCode} onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))} placeholder="A1A 1A1" style={{ ...inputStyle, maxWidth: 160 }} />
                </div>

                {error && <div style={{ padding: "10px 14px", background: "#fdecea", borderRadius: 10, fontSize: 13, color: "#c0392b", fontFamily: "Nunito, sans-serif", marginBottom: 16 }}>{error}</div>}

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
