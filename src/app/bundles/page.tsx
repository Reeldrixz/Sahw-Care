"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Package, X, CheckCircle, Box, Sparkles,
  ChevronDown, ChevronRight, Gift, Heart, Users, Truck,
  Shield, Lock, Building2, Clock, AlertCircle, Milk,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { canApplyForBundle } from "@/lib/access";
import { suppressFeedback } from "@/lib/feedbackSuppress";

type BundleStage = "PREGNANCY" | "LABOUR" | "NEWBORN" | "POSTPARTUM";

interface BundleItem {
  id: string; code: string; name: string; stage: BundleStage;
  description: string; contentsMarkdown: string;
  slotsPerMonth: number; slotsUsed: number; slotsRemaining: number;
  itemCount: number;
  sponsorName?: string | null; sponsorUrl?: string | null;
}

// Only linkify sponsor URLs that are http(s); never a javascript:/data: sink.
// (Sponsor text is rendered as JSX and auto-escaped by React.)
function safeHttpUrl(url?: string | null): string | null {
  if (!url) return null;
  const t = url.trim();
  return /^https?:\/\//i.test(t) ? t : null;
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
  { q: "Is this a first-come-first-served system?", a: "No. Every application is read privately and carefully by the Kradel team. It is not simply who applies first." },
  { q: "Where does funding come from?", a: "Kradəl Bundles are funded through platform operations, community partners, and CSR programs. No mother ever pays for a bundle. They are fully covered." },
  { q: "Can I apply for more than one bundle?", a: "You can have one open application at a time. Once it's delivered, or if you withdraw it or it closes, you're welcome to apply for another bundle." },
  { q: "How long does the review take?", a: "Fulfillment can take up to 90 days, depending on available resources. If we aren't able to review your application within that time, it will close and you're welcome to reapply, with priority for having waited. We'll notify you privately once your application is approved." },
];

const JOURNEY_STEPS = [
  { label: "Application",     detail: "Submit a short form sharing your stage." },
  { label: "Private Review",  detail: "Our team reviews every application carefully and privately." },
  { label: "Bundle Prepared", detail: "Kradəl sources and packs your curated essentials." },
  { label: "Delivered",       detail: "Your bundle is shipped directly to your door, free." },
  { label: "Ongoing Support", detail: "You're welcomed into the Kradəl community." },
];

const TRUST_PRINCIPLES = [
  { Icon: Heart,       label: "Dignity First",             desc: "Every mother is treated with care and respect. No public competition, no pressure." },
  { Icon: CheckCircle, label: "Quality Guaranteed",        desc: "Only vetted, high-quality products are included in every bundle." },
  { Icon: Shield,      label: "Reviewed Fairly",           desc: "Every application is read privately and carefully, never ranked by who applies first." },
  { Icon: Lock,        label: "Privacy Protected",         desc: "Personal information is never shared, published, or visible to other users." },
];


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
  fullName: string; phone: string; email: string; city: string; province: string;
  dueDate: string; babyDob: string;
  streetAddress: string; unit: string; postalCode: string;
  disclaimerAcknowledged: boolean;
}
const EMPTY_FORM: ApplyForm = {
  fullName: "", phone: "", email: "", city: "", province: "",
  dueDate: "", babyDob: "", streetAddress: "", unit: "", postalCode: "",
  disclaimerAcknowledged: false,
};

const MOST_POPULAR = "B06";

export default function BundlesPage() {
  const [bundles,                    setBundles]                    = useState<BundleItem[]>([]);
  const [myActiveApplication,        setMyActiveApplication]        = useState<{ id: string; bundleId: string; status: string } | null>(null);
  const [myLifetimeDelivered,        setMyLifetimeDelivered]        = useState(0);
  const [withdrawing,                setWithdrawing]                = useState(false);
  const [withdrawNotice,             setWithdrawNotice]             = useState<string | null>(null);
  const [isRecipient,                setIsRecipient]                = useState(false);
  const [loading,                    setLoading]                    = useState(true);
  const [stageFilter,                setStageFilter]                = useState<StageFilter>("ALL");
  const [expanded,                   setExpanded]                   = useState<string | null>(null);
  const [applying,                   setApplying]                   = useState<BundleItem | null>(null);
  const [form,                       setForm]                       = useState<ApplyForm>(EMPTY_FORM);
  const [submitting,                 setSubmitting]                 = useState(false);
  const [submitted,                  setSubmitted]                  = useState(false);
  const [error,                      setError]                      = useState<string | null>(null);
  const [openFaq,                    setOpenFaq]                    = useState<number | null>(null);
  const [bundleCooldownUntil,        setBundleCooldownUntil]        = useState<string | null>(null);
  const [bundleLastApprovedAt,       setBundleLastApprovedAt]       = useState<string | null>(null);

  const { user, loading: authLoading } = useAuth();
  const isRecipientUser = user?.role === "RECIPIENT";

  const fetchBundles = useCallback(async () => {
    setLoading(true);
    try {
      // no-store: this response is per-session (isRecipient, cooldowns, "X of 12"
      // all key off the auth cookie). Without it the browser can serve a stale
      // cached body — e.g. one captured before the session was recognised
      // (isRecipient:false) — leaving recipient chrome hidden until a later
      // request busts the cache. Matches AuthContext's /api/auth/me fetch.
      const r = await fetch("/api/bundles/catalogue", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setBundles(d.bundles ?? []);
        setMyActiveApplication(d.myActiveApplication ?? null);
        setMyLifetimeDelivered(d.myLifetimeDelivered ?? 0);
        setIsRecipient(d.isRecipient ?? false);
        setBundleCooldownUntil(d.bundleCooldownUntil ?? null);
        setBundleLastApprovedAt(d.bundleLastApprovedAt ?? null);
      }
    } finally {
      // Always clear loading — a thrown fetch must never leave the page stuck.
      setLoading(false);
    }
  }, []);

  // Mother withdraws her own PENDING application (self-service, no penalty).
  const handleWithdraw = async (bundleName: string) => {
    if (!myActiveApplication || withdrawing) return;
    if (!window.confirm(`Withdraw your ${bundleName} application? This frees you up to apply for a different bundle. There's no penalty and you can apply again anytime.`)) return;
    setWithdrawing(true);
    try {
      const r = await fetch(`/api/bundles/applications/${myActiveApplication.id}/withdraw`, { method: "POST" });
      if (r.ok) {
        setWithdrawNotice("Your application has been withdrawn. You can apply for another bundle whenever you're ready.");
        await fetchBundles();
      }
    } finally {
      setWithdrawing(false);
    }
  };

  // Warm date formatter for the cooldown banner (UTC to match the server's
  // UTC-based cooldown dates).
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  const inBundleCooldown = !!bundleCooldownUntil;

  // Only recipient mothers load the catalogue. Everyone else sees the
  // "coming soon" layer, so we never ship them the bundle list.
  useEffect(() => {
    if (authLoading || !isRecipientUser) return;
    fetchBundles();
  }, [authLoading, isRecipientUser, fetchBundles]);

  // Hide the beta feedback pill while the apply modal is open (no noise at a
  // sensitive moment).
  useEffect(() => {
    if (!applying) return;
    return suppressFeedback();
  }, [applying]);

  const visible         = stageFilter === "ALL" ? bundles : bundles.filter((b) => b.stage === stageFilter);
  const totalInProgress = bundles.reduce((s, b) => s + b.slotsUsed, 0);

  const openApply  = (b: BundleItem) => { setApplying(b); setForm(EMPTY_FORM); setSubmitted(false); setError(null); setWithdrawNotice(null); };
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
          email: form.email || null,
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

  // ── Visibility gate (Piece 1) ───────────────────────────────────────
  // Only recipient mothers see the bundles catalogue. Everyone else
  // (visitors, donors, admins-as-viewers) gets a calm "coming soon" layer.
  // A future phase subdivides recipients by batch; keep this additive.
  if (authLoading) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
        <div className="loading" style={{ minHeight: "60vh" }}><div className="spinner" /></div>
        <BottomNav />
      </div>
    );
  }

  if (!isRecipientUser) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
          <div style={{ maxWidth: 460, width: "100%", background: "white", borderRadius: 20, border: "1px solid #e8e8e8", padding: "40px 28px", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.05)" }}>
            <div style={{ width: 68, height: 68, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Package size={30} color="#1a7a5e" strokeWidth={1.5} />
            </div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 24, fontWeight: 700, color: "#1a1a1a", marginBottom: 12, lineHeight: 1.25 }}>
              Care bundles are coming soon
            </div>
            <div style={{ fontSize: 14, color: "#555555", fontFamily: "Nunito, sans-serif", lineHeight: 1.7, marginBottom: 24 }}>
              We&apos;re preparing curated care bundles for mothers across Canada, fully funded and delivered free. They&apos;re not open just yet. As Kradel grows, we&apos;ll welcome mothers in, one community at a time.
            </div>
            <div style={{ paddingTop: 20, borderTop: "1px solid #f0f0f0" }}>
              <div style={{ fontSize: 13, color: "#666", fontFamily: "Nunito, sans-serif", marginBottom: 10 }}>
                Want to help make them possible?
              </div>
              <a href="/partners" style={{ display: "inline-block", padding: "11px 24px", background: "#1a7a5e", borderRadius: 12, fontSize: 14, fontWeight: 800, color: "white", fontFamily: "Nunito, sans-serif", textDecoration: "none" }}>
                Become a Community Partner →
              </a>
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

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
                Each month, Kradəl assembles carefully curated care bundles for mothers across Canada. They are
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
                <a href="/partners" style={{
                  flex: 1, padding: "12px 0", textAlign: "center", textDecoration: "none",
                  background: "rgba(255,255,255,0.15)",
                  border: "1.5px solid rgba(255,255,255,0.4)",
                  borderRadius: 12, fontSize: 14, fontWeight: 800,
                  color: "white", cursor: "pointer", fontFamily: "Nunito, sans-serif",
                }}>
                  Become a Community Partner
                </a>
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
                    <span style={{ fontWeight: 800, color: "#1a7a5e" }}>Funded by Kradəl and our partners.</span>
                    {" "}Every bundle is fully covered. No cost to any mother.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CHOOSE YOUR SUPPORT (Piece E.1) ────────────────────────────────
            The post-approval decision point: two paths with the honest
            explanation for each. The formula 6-month caveat renders HERE,
            before she commits — not only post-admission. Framing gate, not a
            hard lock: the paths aren't mutually exclusive. Recipient-only.
            Keyed on isRecipientUser (auth role) — which is already guaranteed
            true in this branch — NOT the catalogue payload's isRecipient, so the
            gate can't be hidden by a stale/slow/failed catalogue fetch. */}
        {isRecipientUser && (
          <div style={{ margin: "16px 16px 4px" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>
              Choose your support
            </div>
            <div style={{ fontSize: 13, color: "#555555", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, marginBottom: 14 }}>
              Two ways we can help. You&apos;re welcome to explore both, and come back anytime.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>

              {/* Bundle Kits */}
              <div style={{ flex: "1 1 260px", background: "white", border: "1px solid #c3e6cb", borderRadius: 14, padding: "20px 20px 18px", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Package size={20} color="#1a7a5e" strokeWidth={1.75} />
                  </div>
                  <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, color: "#1a1a1a" }}>Bundle Kits</div>
                </div>
                <div style={{ fontSize: 13, color: "#555555", fontFamily: "Nunito, sans-serif", lineHeight: 1.65, marginBottom: 16, flex: 1 }}>
                  Curated newborn and maternity essentials, delivered free. You can receive up to 12 bundles over your journey, one at a time. Each application is reviewed privately and can take up to 90 days.
                </div>
                <button
                  onClick={() => document.getElementById("bundle-grid")?.scrollIntoView({ behavior: "smooth" })}
                  style={{ width: "100%", textAlign: "center", padding: "11px 0", background: "#1a7a5e", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 800, color: "white", fontFamily: "Nunito, sans-serif", cursor: "pointer" }}>
                  Browse bundle kits →
                </button>
              </div>

              {/* Formula Support */}
              <div style={{ flex: "1 1 260px", background: "white", border: "1px solid #e8e8e8", borderRadius: 14, padding: "20px 20px 18px", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Milk size={20} color="#1a7a5e" strokeWidth={1.75} />
                  </div>
                  <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, color: "#1a1a1a" }}>Formula Support</div>
                </div>
                <div style={{ fontSize: 13, color: "#555555", fontFamily: "Nunito, sans-serif", lineHeight: 1.65, marginBottom: 10 }}>
                  If your baby is already on formula and you qualify, we provide six months of your baby&apos;s exact formula, one month at a time.
                </div>
                <div style={{ fontSize: 11.5, color: "#6b7280", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, marginBottom: 16, background: "#f8faf9", border: "1px solid #e0ede8", borderRadius: 8, padding: "10px 12px", flex: 1 }}>
                  We aim to send every month, though we can&apos;t guarantee an uninterrupted schedule. You won&apos;t need to reapply.
                </div>
                <a
                  href="/bundles/formula-support"
                  style={{ display: "block", width: "100%", boxSizing: "border-box", textAlign: "center", padding: "11px 0", background: "#1a7a5e", borderRadius: 10, fontSize: 13, fontWeight: 800, color: "white", fontFamily: "Nunito, sans-serif", textDecoration: "none" }}>
                  Request formula support →
                </a>
              </div>

            </div>
          </div>
        )}

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

        {/* Donor framing: honest context for non-recipients. Bundles are a
            showcase they can browse, not a program being distributed today. */}
        {!loading && !isRecipient && (
          <div style={{ margin: "12px 16px 0", padding: "14px 16px", background: "#faf6ee", borderRadius: 12, border: "1px solid #ece4d3" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.6 }}>
              Care bundles are complete starter kits for mothers, a program we&apos;re building toward as Kradel grows.
            </div>
          </div>
        )}

        {/* How it works strip */}
        <div style={{ margin: "12px 16px", padding: "14px 16px", background: "#e8f5f1", borderRadius: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>
            How our support programs work
          </div>
          <div style={{ fontSize: 12, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
            Browse the programs below and apply for the one that matches your stage. Applications are reviewed
            privately by the Kradel team, and we read every one carefully.
            Approved bundles are packed and delivered directly to you, completely free.
          </div>
        </div>

        {/* Formula-support path now lives in the "Choose your support" decision
            gate above (Piece E.1), where its honest 6-month caveat renders
            before she commits. */}

        {myLifetimeDelivered >= 12 ? (
          /* ── PROGRAMME COMPLETION BANNER ─────────────────────────────── */
          <div id="bundle-grid" style={{ margin: "16px", padding: "40px 24px", background: "white", borderRadius: 16, border: "1px solid #c3e6cb", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <CheckCircle size={28} color="#1a7a5e" strokeWidth={1.75} />
            </div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>
              You&apos;ve received all 12 Kradel bundles — the full programme.
            </div>
            <div style={{ fontSize: 13, color: "#555555", fontFamily: "Nunito, sans-serif", lineHeight: 1.7 }}>
              Thank you for allowing us to support your journey.
            </div>
          </div>
        ) : (
          <>
            {/* Lifetime progress: "X of 12 received". DELIVERED-only count from
                the catalogue API. Recipient-only; hidden at 0 (reads cold). */}
            {isRecipient && myLifetimeDelivered > 0 && (
              <div style={{ margin: "0 16px 12px", padding: "14px 16px", background: "white", borderRadius: 12, border: "1px solid #c3e6cb" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif" }}>
                    You&apos;ve received <span style={{ color: "#1a7a5e" }}>{myLifetimeDelivered} of 12</span> bundles
                  </div>
                </div>
                <div style={{ height: 8, borderRadius: 20, background: "#e8f5f1", overflow: "hidden" }}>
                  <div style={{ width: `${(myLifetimeDelivered / 12) * 100}%`, height: "100%", borderRadius: 20, background: "#1a7a5e", transition: "width 0.3s ease" }} />
                </div>
                <div style={{ fontSize: 11.5, color: "#6b7280", fontFamily: "Nunito, sans-serif", lineHeight: 1.55, marginTop: 8 }}>
                  Kradel bundles are yours up to twelve times — apply whenever you need the next one.
                </div>
              </div>
            )}

            {/* Monthly receipt cooldown notice: warm, dignity-first (here's why
                + when you're welcome back), shown when she received a bundle
                within the last month. */}
            {inBundleCooldown && bundleLastApprovedAt && bundleCooldownUntil && (
              <div style={{ margin: "0 16px 12px", padding: "12px 16px", background: "#e8f5f1", borderRadius: 12, border: "1px solid #c3e6cb", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <CheckCircle size={16} color="#1a7a5e" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
                  You received a bundle on <strong style={{ fontWeight: 800 }}>{fmtDate(bundleLastApprovedAt)}</strong>. So support can reach as many mothers as possible, each mother receives one bundle a month. You&apos;re welcome to apply again from <strong style={{ fontWeight: 800 }}>{fmtDate(bundleCooldownUntil)}</strong>.
                </div>
              </div>
            )}

            {/* Withdraw success notice (shown after she withdraws). */}
            {withdrawNotice && (
              <div style={{ margin: "0 16px 12px", padding: "12px 16px", background: "#e8f5f1", borderRadius: 12, border: "1px solid #c3e6cb", display: "flex", alignItems: "flex-start", gap: 10 }}>
                <CheckCircle size={16} color="#1a7a5e" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
                  {withdrawNotice}
                </div>
              </div>
            )}

            {/* Active application notice — one open application at a time.
                PENDING: she may withdraw to free herself. APPROVED: in progress,
                no withdraw (an admin releases it if it can't be delivered). */}
            {myActiveApplication && (() => {
              const activeBundle = bundles.find((b) => b.id === myActiveApplication.bundleId);
              const activeName = activeBundle?.name ?? "bundle";
              if (myActiveApplication.status === "APPROVED") {
                return (
                  <div style={{ margin: "0 16px 12px", padding: "12px 16px", background: "#e8f5f1", borderRadius: 12, border: "1px solid #c3e6cb", display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <CheckCircle size={16} color="#1a7a5e" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 12, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
                      Your {activeName} application is approved, and we&apos;re preparing it now.
                    </div>
                  </div>
                );
              }
              return (
                <div style={{ margin: "0 16px 12px", padding: "12px 16px", background: "#fef3c7", borderRadius: 12, border: "1px solid #fde68a", display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <AlertCircle size={16} color="#b45309" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12, color: "#92400e", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
                    <strong style={{ fontWeight: 800 }}>You have an application under review.</strong>
                    {" "}While it&apos;s open, other bundles are paused. You can withdraw it below if you&apos;d rather apply for a different bundle.
                    <div style={{ marginTop: 10 }}>
                      <button
                        onClick={() => handleWithdraw(activeName)}
                        disabled={withdrawing}
                        style={{ padding: "8px 16px", background: "white", border: "1.5px solid #d97706", borderRadius: 8, fontSize: 12, fontWeight: 800, color: "#b45309", cursor: withdrawing ? "default" : "pointer", fontFamily: "Nunito, sans-serif", opacity: withdrawing ? 0.6 : 1 }}
                      >
                        {withdrawing ? "Withdrawing…" : "Withdraw application"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

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

                const isMyApplication  = b.id === myActiveApplication?.bundleId;
                const hasOtherActive   = !!myActiveApplication && !isMyApplication;
                const bundleAccess     = isRecipient && user ? canApplyForBundle(user) : null;
                const bundleBlocked    = !!bundleAccess && !bundleAccess.allowed;
                const bundleHeld       = bundleAccess?.code === "ACCOUNT_UNDER_REVIEW";
                const isDisabled       = !isRecipient || hasOtherActive;
                const preview          = getPreviewItems(b.contentsMarkdown, 3);

                const btnLabel = !isRecipient
                  ? "Available for mothers in need"
                  : bundleBlocked
                  ? "Identity verification required"
                  : isMyApplication
                  ? "Application submitted ✓"
                  : inBundleCooldown
                  ? "One bundle a month"
                  : hasOtherActive
                  ? "Another application active"
                  : full
                  ? "Intake closed"
                  : "Apply for support →";

                const btnClickable = isRecipient && !bundleBlocked && !isMyApplication && !inBundleCooldown && !hasOtherActive && !full;

                const btnStyle: React.CSSProperties = {
                  flex: 1, padding: "10px 0",
                  border: "none", borderRadius: 10,
                  fontSize: 12, fontWeight: 800,
                  fontFamily: "Nunito, sans-serif",
                  cursor: btnClickable ? "pointer" : "default",
                  background: isMyApplication ? "#e8f5f1"
                    : (isDisabled || bundleBlocked || full || inBundleCooldown) ? "#f0f0f0"
                    : th.text,
                  color: isMyApplication ? "#1a7a5e"
                    : (isDisabled || bundleBlocked || full || inBundleCooldown) ? "#9ca3af"
                    : "white",
                };

                return (
                  <div
                    key={b.id}
                    className={`bundle-card${hasOtherActive ? " disabled-card" : ""}`}
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

                      {/* Sponsor recognition — quiet line celebrating the business + the bundle.
                          Never implies a mother owes anything; bundles remain completely free. */}
                      <div style={{ marginBottom: 12, paddingTop: 10, borderTop: "1px dashed #efeae3" }}>
                        {b.sponsorName ? (
                          <div style={{ fontSize: 11, color: "#8a8a8a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>
                            This month&apos;s {b.name} is made possible by{" "}
                            {safeHttpUrl(b.sponsorUrl) ? (
                              <a href={safeHttpUrl(b.sponsorUrl)!} target="_blank" rel="noopener noreferrer"
                                 style={{ color: th.text, fontWeight: 700, textDecoration: "underline" }}>
                                {b.sponsorName}
                              </a>
                            ) : (
                              <span style={{ color: th.text, fontWeight: 700 }}>{b.sponsorName}</span>
                            )}
                          </div>
                        ) : (
                          <a href="/partners" style={{ fontSize: 11, color: "#8a8a8a", fontFamily: "Nunito, sans-serif", textDecoration: "none", display: "inline-block" }}>
                            This bundle is open for a community partner{" "}
                            <span style={{ color: th.text, fontWeight: 700 }}>→</span>
                          </a>
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
                        <div style={{ flex: 1 }}>
                          {!isRecipient ? (
                            // Donors and logged-out visitors: a calm statement, not a
                            // disabled control. Bundles are a showcase for them.
                            <div style={{
                              padding: "10px 0", borderRadius: 10,
                              fontSize: 12, fontWeight: 800,
                              fontFamily: "Nunito, sans-serif", textAlign: "center",
                              background: th.pillBg, color: th.pillText,
                            }}>
                              Available for mothers in need
                            </div>
                          ) : (
                            <>
                              <button
                                disabled={!btnClickable}
                                onClick={() => btnClickable && openApply(b)}
                                style={btnStyle}
                              >
                                {btnLabel}
                              </button>
                              {bundleBlocked && (
                                <div style={{ fontSize: 10, fontFamily: "Nunito, sans-serif", textAlign: "center", marginTop: 4 }}>
                                  {bundleHeld
                                    ? <span style={{ color: "#92400e" }}>We need to confirm a few details. We'll be in touch.</span>
                                    : <a href="/profile" style={{ color: "#1a7a5e", fontWeight: 700, textDecoration: "underline" }}>Verify your identity on your profile →</a>
                                  }
                                </div>
                              )}
                            </>
                          )}
                        </div>
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
                        {/* Gentle, informational suitability note. Not a warning. */}
                        <p style={{ margin: "12px 0 0", fontSize: 11, color: "#6b7280", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
                          Bundle items are provided as general maternity and baby support. Please check with your healthcare provider before using anything you consume or apply during pregnancy or while breastfeeding.
                        </p>
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
                View all {bundles.length} support programs →
              </button>
            </div>
          )}
        </div>
          </>
        )}

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
              Your application is reviewed privately by our team, and we read every one carefully. Fulfillment can take up to 90 days depending on available resources. If we aren&apos;t able to review your application within that time, it will close and you&apos;re welcome to reapply, with priority for having waited. We&apos;ll get in touch once your application is approved.
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
              A private, careful process: from application to your doorstep.
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
              Partners Make It Possible
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "Nunito, sans-serif", lineHeight: 1.65, marginBottom: 20 }}>
              Every bundle delivered is made possible by the generosity of our partners.
              Join organisations committed to maternal dignity across Canada.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {[
                { Icon: Gift,      text: "Fund a Bundle Cycle" },
                { Icon: Users,     text: "Fund a Community"    },
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

            <a href="/community-partners" style={{
              display: "block", textAlign: "center", textDecoration: "none",
              width: "100%", padding: "11px 0", background: "transparent",
              border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 12,
              fontSize: 13, fontWeight: 800, color: "white", cursor: "pointer",
              fontFamily: "Nunito, sans-serif",
            }}>
              Meet our Community Partners →
            </a>
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

        {/* ── SPONSORSHIP FRAMING (restrained) ───────────────────────────── */}
        <div style={{ margin: "12px 16px 0" }}>
          <div style={{ background: "#f8faf9", border: "1px solid #e0ede8", borderRadius: 14, padding: "18px 20px", textAlign: "center" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>
              Local businesses stand behind these bundles
            </div>
            <div style={{ fontSize: 13, color: "#555", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, marginBottom: 12 }}>
              Every bundle is fully funded by our community partners, so it reaches a mother completely free.
            </div>
            <a href="/community-partners" style={{ fontSize: 13, fontWeight: 800, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", textDecoration: "none" }}>
              Meet our Community Partners →
            </a>
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
                <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, color: "#1a1a1a" }}>Apply for {applying.name}</div>
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
                  Your application is reviewed privately by our team, and we read every one carefully. Fulfillment can take up to 90 days depending on available resources. If we aren&apos;t able to review your application within that time, it will close and you&apos;re welcome to reapply, with priority for having waited. We&apos;ll get in touch once your application is approved.
                </div>
                <button onClick={closeApply} style={{ padding: "12px 32px", background: "#1a7a5e", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 800, color: "white", cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Done</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ padding: "20px 20px 0" }}>
                {/* Private review notice */}
                <div style={{ background: "#e8f5f1", borderRadius: 10, padding: "10px 14px", marginBottom: 20, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Shield size={14} color="#1a7a5e" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 11, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
                    Your application is reviewed privately by our team, and we read every one carefully. Fulfillment can take up to 90 days depending on available resources.
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", marginBottom: 12 }}>About you</div>
                  <label style={labelStyle}>Full name *</label>
                  <input required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Your full name" style={inputStyle} />
                  <label style={labelStyle}>Phone number *</label>
                  <input required type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="e.g. 416-555-0100" style={inputStyle} />
                  <label style={labelStyle}>Email address (for updates if you don&apos;t have an account)</label>
                  <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="you@example.com" style={inputStyle} />
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

                {/* Required safety acknowledgment — gentle, supportive gate. */}
                <label style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#f8faf9", border: "1px solid #e0ede8", borderRadius: 10, padding: "12px 14px", marginBottom: 16, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.disclaimerAcknowledged}
                    onChange={(e) => setForm((f) => ({ ...f, disclaimerAcknowledged: e.target.checked }))}
                    style={{ flexShrink: 0, marginTop: 2, width: 16, height: 16, accentColor: "#1a7a5e", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 12.5, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
                    I understand these items are general support and that I should check with my healthcare provider about anything I consume or apply during pregnancy or while breastfeeding.
                  </span>
                </label>

                <button type="submit" disabled={submitting || !form.disclaimerAcknowledged} style={{ width: "100%", padding: "14px", background: (submitting || !form.disclaimerAcknowledged) ? "#9ca3af" : "#1a7a5e", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, color: "white", cursor: (submitting || !form.disclaimerAcknowledged) ? "not-allowed" : "pointer", fontFamily: "Nunito, sans-serif", marginBottom: 12 }}>
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
