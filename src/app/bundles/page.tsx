"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Heart, Package, Gift, Coins, Shield, Users, TrendingUp,
  Droplets, Sparkles, Building2, Sun, CheckCircle, Lock,
  ChevronDown, ChevronUp, Calendar,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import Toast from "@/components/Toast";

interface Goal {
  id: string;
  month: string;
  targetBundles: number;
  fundedBundles: number;
  deliveredBundles: number;
  bundlesFundedToday: number;
  costPerBundle: number;
  daysRemaining: number;
  percentFunded: number;
  contributorCount: number;
  mothersSupportedThisMonth: number;
  isFullyFunded: boolean;
}

interface MyContribution {
  totalBundles: number;
  campaigns: number;
  mothersSupported: number;
}

function fmtMonth(m: string) {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });
}

// Count-up hook
function useCountUp(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (target === 0 || started.current) return;
    started.current = true;
    const steps = 40;
    const stepMs = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setVal(Math.round((target * step) / steps));
      if (step >= steps) { clearInterval(timer); setVal(target); }
    }, stepMs);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
}

const NEWBORN_BUNDLES = [
  { name: "First Days Kit",         tag: "0–2 weeks",   desc: "Everything needed for the very first weeks at home", icon: Package,    items: 8  },
  { name: "Growth Support Kit",     tag: "1–3 months",  desc: "Essentials for the first three months",               icon: TrendingUp, items: 7  },
  { name: "Feeding Kit",            tag: "Any stage",   desc: "Bottles, formula support and feeding tools",          icon: Droplets,   items: 6  },
  { name: "Care Kit",               tag: "Any stage",   desc: "Bath time, health monitoring and hygiene",             icon: Sparkles,   items: 8  },
  { name: "Complete Newborn Bundle",tag: "All stages",  desc: "Everything she needs, start to finish",               icon: Gift,       items: 29, isHero: true },
];

const MATERNITY_BUNDLES = [
  { name: "Pregnancy Essentials",    tag: "Third trimester", desc: "Comfort and support through the third trimester",     icon: Heart,     items: 7  },
  { name: "Delivery Kit",            tag: "Delivery",        desc: "Everything ready for the big day",                    icon: Building2, items: 9  },
  { name: "Recovery Kit",            tag: "Postpartum",      desc: "Support for the first weeks after birth",             icon: Sun,       items: 8  },
  { name: "Feeding Support",         tag: "Postpartum",      desc: "For breastfeeding mothers",                           icon: Droplets,  items: 5  },
  { name: "Complete Maternal Bundle",tag: "Full journey",    desc: "Full support from pregnancy through recovery",        icon: Gift,      items: 29, isHero: true },
];

const FAQ = [
  { q: "Who receives bundles?", a: "Verified mothers who have been confirmed by the Kradəl team. We prioritise mothers closest to their due date and those who have completed document verification." },
  { q: "Where does my money go?", a: "85% goes directly to bundle contents — items purchased and delivered to mothers. 15% covers logistics, packing and operations. Nothing is transferred to individuals directly." },
  { q: "Can I choose which mother receives my contribution?", a: "No. All contributions go into a shared pool and are matched by the Kradəl team based on need and timing. This keeps the system fair and private." },
  { q: "Can I get a refund?", a: "Contributions are non-refundable once confirmed, as they immediately join the monthly pool. If you have a concern, contact us and we'll do our best to help." },
];

function BundleHeroCard({ bundle }: { bundle: typeof NEWBORN_BUNDLES[0] }) {
  const Icon = bundle.icon;
  return (
    <div style={{
      background: "#1a7a5e", color: "white", borderRadius: 16, padding: "20px 18px",
      marginBottom: 10, position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: 100, height: 100, borderRadius: "0 16px 0 100%", background: "rgba(255,255,255,0.06)" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 800, background: "rgba(255,255,255,0.18)", color: "white", padding: "3px 10px", borderRadius: 20, fontFamily: "Nunito, sans-serif", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Most Complete
        </span>
        <Icon size={28} color="white" strokeWidth={1.5} />
      </div>
      <div style={{ fontFamily: "Lora, serif", fontSize: 19, fontWeight: 700, marginBottom: 4 }}>{bundle.name}</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: "Nunito, sans-serif", marginBottom: 12 }}>{bundle.desc}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,0.15)", color: "white", padding: "4px 10px", borderRadius: 20, fontFamily: "Nunito, sans-serif" }}>
          {bundle.items} items included
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,0.15)", color: "white", padding: "4px 10px", borderRadius: 20, fontFamily: "Nunito, sans-serif" }}>
          {bundle.tag}
        </span>
      </div>
    </div>
  );
}

function BundleKitCard({ bundle }: { bundle: typeof NEWBORN_BUNDLES[0] }) {
  const Icon = bundle.icon;
  return (
    <div style={{
      background: "var(--white)", borderRadius: 12, padding: "14px",
      borderTop: "3px solid #1a7a5e", border: "1.5px solid var(--border)",
      borderTopColor: "#1a7a5e", borderTopWidth: 3,
    }}>
      <Icon size={24} color="#1a7a5e" strokeWidth={1.8} style={{ marginBottom: 8 }} />
      <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 3 }}>{bundle.name}</div>
      <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.5, marginBottom: 8 }}>{bundle.desc}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 700, background: "#e8f5f1", color: "#1a7a5e", padding: "3px 8px", borderRadius: 20, fontFamily: "Nunito, sans-serif" }}>{bundle.tag}</span>
        <span style={{ fontSize: 10, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>{bundle.items} items</span>
      </div>
    </div>
  );
}

function StatPill({ value, label }: { value: number; label: string }) {
  const display = useCountUp(value);
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "14px 8px" }}>
      <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 22, fontWeight: 800, color: "#1a7a5e", marginBottom: 2 }}>
        {display.toLocaleString()}
      </div>
      <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.4 }}>{label}</div>
    </div>
  );
}

export default function BundlesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [goal, setGoal]               = useState<Goal | null>(null);
  const [totalAllTime, setTotalAllTime] = useState(0);
  const [goalLoading, setGoalLoading] = useState(true);
  const [myContrib, setMyContrib]     = useState<MyContribution | null>(null);
  const [showSheet, setShowSheet]     = useState(false);
  const [selectedCount, setSelectedCount] = useState<number | null>(null);
  const [customCount, setCustomCount] = useState("");
  const [contributing, setContributing] = useState(false);
  const [contributed, setContributed] = useState(false);
  const [contributedCount, setContributedCount] = useState(0);
  const [toast, setToast]             = useState<string | null>(null);
  const [openFaq, setOpenFaq]         = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth");
  }, [user, authLoading, router]);

  useEffect(() => {
    fetch("/api/bundles/goal/current")
      .then(r => r.json())
      .then(d => {
        setGoal(d.goal);
        setTotalAllTime(d.totalBundlesAllTime ?? 0);
        setGoalLoading(false);
      })
      .catch(() => setGoalLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch("/api/bundles/contributions/mine")
      .then(r => r.json())
      .then(d => {
        const confirmed = (d.contributions ?? []).filter((c: { status: string }) => c.status === "CONFIRMED");
        const total = confirmed.reduce((s: number, c: { bundleCount: number }) => s + c.bundleCount, 0);
        const campaigns = new Set(confirmed.map((c: { goal: { month: string } }) => c.goal?.month)).size;
        setMyContrib({ totalBundles: total, campaigns, mothersSupported: total });
      })
      .catch(() => {});
  }, [user]);

  const isDonor  = user?.journeyType === "donor";
  const isMother = user?.journeyType === "pregnant" || user?.journeyType === "postpartum";

  const effectiveCount = selectedCount ?? (customCount ? parseInt(customCount) || 0 : 0);
  const costDisplay = goal && effectiveCount > 0
    ? `$${((effectiveCount * goal.costPerBundle) / 100).toFixed(0)}`
    : "";

  const showActivityStrip =
    (goal?.deliveredBundles ?? 0) > 0 ||
    (goal?.mothersSupportedThisMonth ?? 0) > 0 ||
    totalAllTime > 0;

  const handleContribute = async () => {
    if (!effectiveCount || effectiveCount < 1) return;
    setContributing(true);
    try {
      const res = await fetch("/api/bundles/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleCount: effectiveCount }),
      });
      const d = await res.json();
      if (!res.ok) { setToast(d.error ?? "Something went wrong"); return; }
      setGoal(prev => prev ? {
        ...prev,
        fundedBundles: d.goal.fundedBundles,
        percentFunded: d.goal.percentFunded,
        isFullyFunded: d.goal.fundedBundles >= prev.targetBundles,
      } : prev);
      setContributedCount(effectiveCount);
      setContributed(true);
      setSelectedCount(null);
      setCustomCount("");
    } catch {
      setToast("Network error. Please try again.");
    } finally {
      setContributing(false);
    }
  };

  const shareText = encodeURIComponent("Help fund care bundles for mothers in need — every contribution goes into one shared pool. https://sahw-care.vercel.app/bundles");

  if (authLoading || !user) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 80 }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>

        {/* ── PART 1: Hero ─────────────────────────────────────── */}
        <div style={{ background: "#e8f5f1", padding: "28px 20px 24px" }}>

          {/* Activity pill */}
          {(goal?.mothersSupportedThisMonth ?? 0) > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "white", borderRadius: 20, padding: "6px 12px", marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
              <Heart size={13} color="#1a7a5e" strokeWidth={2.5} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1a7a5e", fontFamily: "Nunito, sans-serif" }}>
                {goal!.mothersSupportedThisMonth} mother{goal!.mothersSupportedThisMonth !== 1 ? "s" : ""} supported this month
              </span>
            </div>
          )}

          <div style={{ fontFamily: "Lora, serif", fontSize: 24, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.3, marginBottom: 10 }}>
            Every bundle is a community decision.
          </div>
          <div style={{ fontSize: 15, color: "#555555", lineHeight: 1.6, fontFamily: "Nunito, sans-serif", marginBottom: 20 }}>
            When you contribute to the bundle pool, Kradəl matches each mother to what she needs most — and delivers it.
          </div>

          {goalLoading ? (
            <div style={{ height: 80, background: "rgba(26,122,94,0.08)", borderRadius: 16 }} />
          ) : goal ? (
            goal.isFullyFunded ? (
              /* Fully funded state */
              <div style={{ background: "white", borderRadius: 16, padding: "16px", borderLeft: "3px solid #1a7a5e" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <CheckCircle size={18} color="#1a7a5e" strokeWidth={2} />
                  <span style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "#1a3a2e" }}>This month&apos;s goal is fully funded!</span>
                </div>
                <div style={{ fontSize: 13, color: "#555555", fontFamily: "Nunito, sans-serif" }}>
                  Kradəl is dispatching bundles to verified mothers now.
                </div>
              </div>
            ) : (
              /* Active campaign card */
              <div style={{ background: "white", borderRadius: 16, padding: "16px", borderLeft: "3px solid #1a7a5e" }}>
                <div style={{ fontSize: 12, color: "#555555", fontFamily: "Nunito, sans-serif", fontWeight: 600, marginBottom: 8 }}>
                  {fmtMonth(goal.month)} · Bundle Campaign
                </div>
                <div style={{ height: 12, borderRadius: 8, background: "#e8f5f1", overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ width: `${goal.percentFunded}%`, height: "100%", background: "#1a7a5e", borderRadius: 8, transition: "width 0.5s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#555555", fontFamily: "Nunito, sans-serif", fontWeight: 600, marginBottom: 14 }}>
                  <span>
                    {goal.fundedBundles === 0
                      ? "Be the first to contribute this month"
                      : `${goal.fundedBundles} of ${goal.targetBundles} bundles funded`}
                  </span>
                  <span>{goal.daysRemaining} day{goal.daysRemaining !== 1 ? "s" : ""} left</span>
                </div>
                {isDonor && (
                  <button
                    onClick={() => setShowSheet(true)}
                    style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "#1a7a5e", color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                  >
                    Fund this month&apos;s bundles
                  </button>
                )}
              </div>
            )
          ) : (
            /* No active campaign */
            <div style={{ background: "#fff8e6", borderRadius: 16, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Calendar size={18} color="#d97706" strokeWidth={2} />
                <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 700, color: "#92400e" }}>
                  The next campaign opens soon.
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#92400e", fontFamily: "Nunito, sans-serif", marginBottom: 12, opacity: 0.8 }}>
                Sign up to be notified when it launches.
              </div>
              <button
                style={{ padding: "10px 20px", borderRadius: 10, border: "1.5px solid #d97706", background: "transparent", color: "#d97706", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                onClick={() => setToast("We'll notify you when the next campaign opens.")}
              >
                Notify me
              </button>
            </div>
          )}
        </div>

        {/* ── PART 2: Activity Strip ────────────────────────────── */}
        {showActivityStrip && (
          <div style={{ background: "var(--white)", marginTop: 12, marginBottom: 0 }}>
            <div style={{ display: "flex" }}>
              <StatPill value={goal?.deliveredBundles ?? 0} label="bundles delivered this month" />
              <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
              <StatPill value={goal?.mothersSupportedThisMonth ?? 0} label="mothers supported" />
              <div style={{ width: 1, background: "var(--border)", alignSelf: "stretch" }} />
              <StatPill value={totalAllTime} label="bundles delivered all time" />
            </div>
            <div style={{ textAlign: "center", fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", padding: "6px 0 12px" }}>
              Updated in real time
            </div>
          </div>
        )}

        {/* ── PART 3: How it works ──────────────────────────────── */}
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, marginBottom: 16 }}>How it works</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            {[
              { Icon: Coins,   title: "You contribute",             sub: "Your contribution joins the monthly pool" },
              { Icon: Package, title: "Kradəl sources & packs",     sub: "We purchase and prepare each bundle" },
              { Icon: Heart,   title: "A mother receives her bundle", sub: "Matched by need and delivered directly" },
            ].map(({ Icon, title, sub }, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}>
                  <Icon size={22} color="#1a7a5e" strokeWidth={2} />
                </div>
                <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 800, color: "var(--ink)", marginBottom: 3, lineHeight: 1.3 }}>{title}</div>
                <div style={{ fontSize: 10, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.4 }}>{sub}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", textAlign: "center", padding: "10px 0 4px", borderTop: "1px solid var(--border)" }}>
            Nothing goes to individuals directly — Kradəl handles everything.
          </div>
        </div>

        {/* ── PART 4: Bundle Types ──────────────────────────────── */}
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>This Month&apos;s Bundles</div>
          <div style={{ fontSize: 13, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 16 }}>
            Every bundle funded this month will be delivered to a verified mother.
          </div>

          {/* Newborn hero */}
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 8 }}>
            Newborn
          </div>
          <BundleHeroCard bundle={NEWBORN_BUNDLES[4]} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {NEWBORN_BUNDLES.slice(0, 4).map((b, i) => (
              <BundleKitCard key={i} bundle={b} />
            ))}
          </div>

          {/* Maternity hero */}
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 8 }}>
            Maternity
          </div>
          <BundleHeroCard bundle={MATERNITY_BUNDLES[4]} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {MATERNITY_BUNDLES.slice(0, 4).map((b, i) => (
              <BundleKitCard key={i} bundle={b} />
            ))}
          </div>
        </div>

        {/* ── Donor impact summary ──────────────────────────────── */}
        {isDonor && myContrib && myContrib.totalBundles > 0 && (
          <div style={{ margin: "0 16px 20px", background: "#e8f5f1", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "#1a3a2e", marginBottom: 4 }}>Bundle contributions</div>
            <div style={{ fontSize: 13, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", fontWeight: 600 }}>
              {myContrib.campaigns} campaign{myContrib.campaigns !== 1 ? "s" : ""} · {myContrib.totalBundles} bundle{myContrib.totalBundles !== 1 ? "s" : ""} funded · {myContrib.mothersSupported} mother{myContrib.mothersSupported !== 1 ? "s" : ""} supported
            </div>
          </div>
        )}

        {/* ── Mother: about bundles ─────────────────────────────── */}
        {isMother && (
          <div style={{ margin: "0 16px 20px", background: "var(--white)", borderRadius: 12, padding: "14px 16px", border: "1.5px solid var(--border)", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ background: "#e8f5f1", borderRadius: 10, padding: 10, flexShrink: 0 }}>
              <Package size={20} color="#1a7a5e" />
            </div>
            <div>
              <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>How bundles reach mothers</div>
              <div style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.6, fontFamily: "Nunito, sans-serif" }}>
                Bundles are matched to verified mothers closest to their due date. Stay active, complete your verification, and our team will reach out when a bundle is available for you.
              </div>
            </div>
          </div>
        )}

        {/* ── PART 5: Transparency ─────────────────────────────── */}
        <div style={{ padding: "0 16px 20px" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Where your contribution goes</div>
          <div style={{ background: "var(--white)", borderRadius: 12, padding: "16px", marginBottom: 10, border: "1.5px solid var(--border)" }}>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>How contributions are used</div>
            {[
              { pct: 85, label: "Bundle contents & delivery", color: "#1a7a5e" },
              { pct: 15, label: "Operations & logistics",     color: "#9ca3af" },
            ].map(({ pct, label, color }) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)", fontFamily: "Nunito, sans-serif" }}>{pct}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 6, background: "#f3f4f6", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: "var(--white)", borderRadius: 12, padding: "16px", border: "1.5px solid var(--border)" }}>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>How bundles reach mothers</div>
            {[
              "Verified pregnancy or newborn",
              "Closest to due date gets priority",
              "One bundle per family per cycle",
              "Reviewed by the Kradəl team",
            ].map((line) => (
              <div key={line} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <CheckCircle size={14} color="#1a7a5e" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>{line}</span>
              </div>
            ))}
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
              Internal matching logic is never shown to donors — we keep the system fair and private.
            </div>
          </div>
        </div>

        {/* ── PART 6: Trust Footer ─────────────────────────────── */}
        <div style={{ background: "#f9fafb", padding: "20px 16px", marginBottom: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {[
              { Icon: Shield,  title: "Verified mothers only",      sub: "Every recipient is verified by the Kradəl team" },
              { Icon: Package, title: "Kradəl delivers everything", sub: "We source, pack and ship — nothing goes directly to individuals" },
              { Icon: Users,   title: "Fair distribution",          sub: "Matched by timing and need — not first come first served" },
            ].map(({ Icon, title, sub }) => (
              <div key={title} style={{ textAlign: "center" }}>
                <Icon size={20} color="#1a7a5e" strokeWidth={2} style={{ margin: "0 auto 6px" }} />
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)", fontFamily: "Nunito, sans-serif", marginBottom: 3 }}>{title}</div>
                <div style={{ fontSize: 10, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.4 }}>{sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── PART 7: Social Sharing (mothers only) ────────────── */}
        {isMother && (
          <div style={{ padding: "0 16px 20px" }}>
            <div style={{ background: "var(--white)", borderRadius: 12, padding: "16px", border: "1.5px solid var(--border)" }}>
              <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Help spread the word</div>
              <div style={{ fontSize: 12, color: "var(--mid)", marginBottom: 14, fontFamily: "Nunito, sans-serif" }}>
                The more donors who contribute, the more mothers we can support this month.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <a href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: "#25D366", color: "white", textAlign: "center", fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", textDecoration: "none" }}>
                  WhatsApp
                </a>
                <a href={`https://twitter.com/intent/tweet?text=${shareText}`} target="_blank" rel="noopener noreferrer"
                  style={{ flex: 1, padding: "11px 0", borderRadius: 10, background: "#1DA1F2", color: "white", textAlign: "center", fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", textDecoration: "none" }}>
                  Twitter
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ── PART 8: FAQ ───────────────────────────────────────── */}
        <div style={{ padding: "0 16px 24px" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Common questions</div>
          {FAQ.map((item, i) => (
            <div key={i} style={{ background: "var(--white)", borderRadius: 12, border: "1.5px solid var(--border)", marginBottom: 8, overflow: "hidden" }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{ width: "100%", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--ink)", flex: 1, marginRight: 8 }}>{item.q}</span>
                {openFaq === i
                  ? <ChevronUp size={16} color="var(--mid)" />
                  : <ChevronDown size={16} color="var(--mid)" />}
              </button>
              {openFaq === i && (
                <div style={{ padding: "0 16px 14px", fontSize: 13, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>

      </div>

      {/* ── Contribution Sheet ────────────────────────────────── */}
      {showSheet && isDonor && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowSheet(false); setContributed(false); } }}
        >
          <div style={{
            background: "var(--white)", borderRadius: "24px 24px 0 0", padding: "20px 18px 40px",
            width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", animation: "sheetUp 0.3s ease",
          }}>
            <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 4, margin: "0 auto 16px" }} />

            {contributed ? (
              /* Confirmation screen */
              <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <CheckCircle size={32} color="#1a7a5e" strokeWidth={2} />
                </div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#1a3a2e" }}>
                  You&apos;ve contributed to {goal ? fmtMonth(goal.month) : "this month"}&apos;s bundle pool.
                </div>
                <div style={{ fontSize: 14, color: "#555555", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, marginBottom: 16 }}>
                  Your contribution joins {goal?.contributorCount ?? 0} others this month. Kradəl will match and deliver bundles to verified mothers as the goal is reached.
                </div>
                {goal && (
                  <div style={{ background: "#e8f5f1", borderRadius: 12, padding: "12px 14px", marginBottom: 20, fontSize: 13, color: "#1a7a5e", fontWeight: 600, fontFamily: "Nunito, sans-serif" }}>
                    If the goal is met: {goal.targetBundles} mother{goal.targetBundles !== 1 ? "s" : ""} will receive bundles this month.
                  </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <a
                    href={`https://wa.me/?text=${shareText}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ flex: 1, padding: "13px 0", borderRadius: 12, border: "none", background: "#25D366", color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif", textDecoration: "none", textAlign: "center" }}
                  >
                    Share this campaign
                  </a>
                  <button
                    onClick={() => { setShowSheet(false); setContributed(false); }}
                    style={{ flex: 1, padding: "13px 0", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--white)", color: "var(--ink)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                  >
                    See bundle details
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Month + progress */}
                <div style={{ fontSize: 13, color: "#555555", fontFamily: "Nunito, sans-serif", fontWeight: 600, marginBottom: 8 }}>
                  {goal ? fmtMonth(goal.month) : ""} · Bundle Campaign
                </div>
                {goal && (
                  <>
                    <div style={{ height: 12, borderRadius: 8, background: "#e8f5f1", overflow: "hidden", marginBottom: 6 }}>
                      <div style={{ width: `${goal.percentFunded}%`, height: "100%", background: "#1a7a5e", borderRadius: 8, transition: "width 0.4s" }} />
                    </div>
                    <div style={{ fontSize: 12, color: "#555555", fontFamily: "Nunito, sans-serif", fontWeight: 600, marginBottom: 18 }}>
                      {goal.fundedBundles} of {goal.targetBundles} bundles funded — {goal.percentFunded}% complete
                    </div>
                  </>
                )}

                {/* Bundle count selector */}
                <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  How many bundles would you like to fund?
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {[
                    { count: 1,  label: "1 bundle",  price: goal ? `$${(goal.costPerBundle / 100).toFixed(0)}` : "$40" },
                    { count: 3,  label: "3 bundles", price: goal ? `$${(3 * goal.costPerBundle / 100).toFixed(0)}` : "$120" },
                    { count: 5,  label: "5 bundles", price: goal ? `$${(5 * goal.costPerBundle / 100).toFixed(0)}` : "$200" },
                  ].map(({ count, label, price }) => (
                    <button
                      key={count}
                      onClick={() => { setSelectedCount(count); setCustomCount(""); }}
                      style={{
                        flex: 1, padding: "12px 6px", borderRadius: 12, minHeight: 48,
                        border: `2px solid ${selectedCount === count ? "#1a7a5e" : "var(--border)"}`,
                        background: selectedCount === count ? "#e8f5f1" : "var(--bg)",
                        cursor: "pointer", fontFamily: "Nunito, sans-serif",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#1a7a5e" }}>{price}</div>
                      <div style={{ fontSize: 10, color: "var(--mid)", fontWeight: 600 }}>{label}</div>
                    </button>
                  ))}
                </div>

                {/* Custom input */}
                <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif", fontWeight: 600, marginBottom: 6 }}>Or choose your own number</div>
                <div style={{ position: "relative", marginBottom: 6 }}>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="Number of bundles"
                    value={customCount}
                    onChange={e => { setCustomCount(e.target.value); setSelectedCount(null); }}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
                {customCount && parseInt(customCount) > 0 && goal && (
                  <div style={{ fontSize: 12, color: "#1a7a5e", fontWeight: 600, fontFamily: "Nunito, sans-serif", marginBottom: 14 }}>
                    {customCount} bundle{parseInt(customCount) !== 1 ? "s" : ""} = ${((parseInt(customCount) * goal.costPerBundle) / 100).toFixed(0)}
                  </div>
                )}

                {/* What your contribution does */}
                <div style={{ background: "#e8f5f1", borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 13, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", fontWeight: 600, lineHeight: 1.6 }}>
                  1 bundle = complete newborn essentials for 1 mother. Kradəl purchases, packs, and delivers — you fund the pool.
                </div>

                {/* Trust block */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#f9fafb", borderRadius: 10, padding: "10px 12px", marginBottom: 16 }}>
                  <Lock size={14} color="#555555" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 11, color: "#555555", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
                    85% of your contribution goes directly to bundle contents. 15% covers logistics and operations. Nothing is transferred to individuals directly.
                  </div>
                </div>

                {/* Primary button */}
                <button
                  onClick={handleContribute}
                  disabled={!effectiveCount || effectiveCount < 1 || contributing || !goal}
                  style={{
                    width: "100%", padding: "15px", borderRadius: 12, border: "none", minHeight: 48,
                    background: !effectiveCount || contributing || !goal ? "#9ca3af" : "#1a7a5e",
                    color: "white", fontSize: 14, fontWeight: 800,
                    cursor: !effectiveCount || contributing || !goal ? "default" : "pointer",
                    fontFamily: "Nunito, sans-serif", marginBottom: 10,
                  }}
                >
                  {contributing
                    ? "Processing…"
                    : effectiveCount > 0 && goal
                      ? `Fund ${effectiveCount} bundle${effectiveCount > 1 ? "s" : ""} · ${costDisplay}`
                      : "Select an amount to continue"}
                </button>

                {/* Ghost button + corporate link */}
                <button
                  onClick={() => setShowSheet(false)}
                  style={{ width: "100%", padding: "13px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--white)", color: "var(--mid)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", marginBottom: 14 }}
                >
                  Maybe later
                </button>
                <div style={{ textAlign: "center", fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                  Funding bundles on behalf of a company?{" "}
                  <a href="mailto:hello@sahw.care" style={{ color: "#1a7a5e", fontWeight: 700, textDecoration: "none" }}>
                    Fund bundles for your team or company
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <BottomNav />
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
