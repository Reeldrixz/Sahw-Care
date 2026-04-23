"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import Toast from "@/components/Toast";
import { Package, Heart, Gift, ChevronDown, ChevronUp } from "lucide-react";

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
}

const BUNDLE_AMOUNTS = [
  { count: 1,  label: "$40",  impact: "Covers a newborn's first week of essentials" },
  { count: 5,  label: "$200", impact: "Supports five families this month" },
  { count: 10, label: "$400", impact: "Helps ten mothers through their hardest weeks" },
];

const NEWBORN_BUNDLES = [
  { name: "Immediate Survival Kit",  tag: "0–2 weeks",    desc: "Diapers, wipes, onesies, swaddles, feeding bottle, burp cloths, baby soap",  sub: "Day 1 survival" },
  { name: "Growth Kit",              tag: "1–3 months",   desc: "Larger diapers, wipes, clothing, lotion, extra cloths",                        sub: "Sustain early growth" },
  { name: "Feeding Support Kit",     tag: "Any stage",    desc: "Formula/feeding support, bottles, cleaning tools, optional breast pump",        sub: "Solve feeding challenges" },
  { name: "Hygiene & Care Kit",      tag: "Any stage",    desc: "Bathtub, towels, washcloths, nail clipper, thermometer, lotion",                sub: "Cleanliness and health" },
  { name: "Full Care Bundle",        tag: "All kits",     desc: "All four kits combined — complete newborn support",                             sub: "Complete newborn support" },
];

const MATERNITY_BUNDLES = [
  { name: "Expecting Mom Survival Kit",  tag: "Pregnancy",    desc: "Maternity wear, vitamins, slippers, water bottle, pillow",                              sub: "Comfort during pregnancy" },
  { name: "Hospital / Delivery Kit",    tag: "Delivery",     desc: "Maternity pads, gown, slippers, towel, toiletries, baby's first outfit",                sub: "Delivery preparation" },
  { name: "Postpartum Recovery Kit",    tag: "Postpartum",   desc: "Pads, nursing bras, breast pads, underwear, body care",                                 sub: "Recovery after birth" },
  { name: "Breastfeeding Support Kit",  tag: "Postpartum",   desc: "Breast pump, storage bags, nursing cover, care cream",                                   sub: "Feeding support" },
  { name: "Full Maternal Care Bundle",  tag: "All kits",     desc: "All four kits combined — full support from pregnancy to recovery",                      sub: "Full support: pregnancy to recovery" },
];

export default function BundlesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [goal, setGoal] = useState<Goal | null>(null);
  const [goalLoading, setGoalLoading] = useState(true);
  const [selectedCount, setSelectedCount] = useState<number | null>(null);
  const [customCount, setCustomCount] = useState("");
  const [contributing, setContributing] = useState(false);
  const [contributed, setContributed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showNewborn, setShowNewborn] = useState(false);
  const [showMaternity, setShowMaternity] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth");
  }, [user, authLoading, router]);

  useEffect(() => {
    fetch("/api/bundles/goal/current")
      .then(r => r.json())
      .then(d => { setGoal(d.goal); setGoalLoading(false); })
      .catch(() => setGoalLoading(false));
  }, []);

  const isDonor = user?.journeyType === "donor";
  const isMother = user?.journeyType === "pregnant" || user?.journeyType === "postpartum";

  const effectiveCount = selectedCount ?? (customCount ? parseInt(customCount) || 0 : 0);
  const dollarsDisplay = goal ? `$${((effectiveCount * goal.costPerBundle) / 100).toFixed(0)}` : "";

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
      } : prev);
      setContributed(true);
      setSelectedCount(null);
      setCustomCount("");
    } catch {
      setToast("Network error. Please try again.");
    } finally {
      setContributing(false);
    }
  };

  const shareText = encodeURIComponent("Help fund care bundles for mothers in need — every contribution goes into one shared pool. https://kraedel.com/bundles");

  if (authLoading || !user) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 80 }}>

      {/* ── Section A: Monthly Funding Header ─────────────────────────── */}
      <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "28px 16px 24px" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: "white", lineHeight: 1.3, marginBottom: 8 }}>
            Every bundle, a community effort.
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.6, marginBottom: 20, fontFamily: "Nunito, sans-serif" }}>
            Each month, Kradel delivers bundles to verified mothers across Toronto. Every contribution goes into one shared pool — distributed where it is needed most.
          </div>

          {/* Progress bar */}
          {goalLoading ? (
            <div style={{ height: 12, background: "rgba(255,255,255,0.15)", borderRadius: 8, marginBottom: 16 }} />
          ) : goal ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.8)", marginBottom: 6, fontFamily: "Nunito, sans-serif", fontWeight: 600 }}>
                <span>{goal.fundedBundles} funded</span>
                <span>{goal.percentFunded}% of {goal.targetBundles} goal</span>
              </div>
              <div style={{ height: 10, background: "rgba(255,255,255,0.15)", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
                <div style={{ width: `${goal.percentFunded}%`, height: "100%", background: "#4ade80", borderRadius: 8, transition: "width 0.5s ease" }} />
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 12, color: "rgba(255,255,255,0.8)", fontFamily: "Nunito, sans-serif" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontWeight: 800, fontSize: 18, color: "white" }}>{goal.fundedBundles}</span>
                  <span>bundles funded</span>
                </div>
                <div style={{ width: 1, background: "rgba(255,255,255,0.2)" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontWeight: 800, fontSize: 18, color: "white" }}>{goal.deliveredBundles}</span>
                  <span>delivered this month</span>
                </div>
                <div style={{ width: 1, background: "rgba(255,255,255,0.2)" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontWeight: 800, fontSize: 18, color: "white" }}>{goal.daysRemaining}</span>
                  <span>days left</span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: "Nunito, sans-serif" }}>No active funding goal this month.</div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px" }}>

        {/* ── Section B: Contribution Panel ─────────────────────────────── */}
        <div style={{ background: "var(--white)", borderRadius: 16, padding: "20px 18px", marginTop: 16, border: "1px solid var(--border)" }}>
          {isDonor ? (
            <>
              <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
                Fund a bundle today
              </div>
              <div style={{ fontSize: 12, color: "var(--mid)", marginBottom: 16, fontFamily: "Nunito, sans-serif" }}>
                Your contribution goes directly into this month's shared pool.
              </div>

              {contributed ? (
                <div style={{ background: "#e8f5f1", borderRadius: 12, padding: "16px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>💚</div>
                  <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: "#1a7a5e", marginBottom: 4 }}>Thank you!</div>
                  <div style={{ fontSize: 13, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                    Your contribution has been recorded. It will help a mother this month.
                  </div>
                  <button
                    onClick={() => setContributed(false)}
                    style={{ marginTop: 12, fontSize: 12, color: "#1a7a5e", background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: "Nunito, sans-serif" }}
                  >
                    Fund more bundles →
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                    {BUNDLE_AMOUNTS.map(({ count, label, impact }) => (
                      <button
                        key={count}
                        onClick={() => { setSelectedCount(count); setCustomCount(""); }}
                        style={{
                          flex: "1 1 auto", minWidth: 80, padding: "10px 8px", borderRadius: 12,
                          border: `2px solid ${selectedCount === count ? "#1a7a5e" : "var(--border)"}`,
                          background: selectedCount === count ? "#e8f5f1" : "var(--bg)",
                          cursor: "pointer", fontFamily: "Nunito, sans-serif", transition: "all 0.15s",
                        }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#1a7a5e" }}>{label}</div>
                        <div style={{ fontSize: 10, color: "var(--mid)", marginTop: 2 }}>{count} bundle{count > 1 ? "s" : ""}</div>
                        {selectedCount === count && (
                          <div style={{ fontSize: 10, color: "#1a7a5e", marginTop: 4, fontWeight: 600, lineHeight: 1.3 }}>{impact}</div>
                        )}
                      </button>
                    ))}
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      placeholder="Custom amount (bundles)"
                      value={customCount}
                      onChange={e => { setCustomCount(e.target.value); setSelectedCount(null); }}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", outline: "none", boxSizing: "border-box" }}
                    />
                    {customCount && parseInt(customCount) > 0 && goal && (
                      <div style={{ fontSize: 11, color: "var(--mid)", marginTop: 4, fontFamily: "Nunito, sans-serif" }}>
                        {customCount} bundle{parseInt(customCount) > 1 ? "s" : ""} = ${((parseInt(customCount) * goal.costPerBundle) / 100).toFixed(0)}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleContribute}
                    disabled={!effectiveCount || effectiveCount < 1 || contributing || !goal}
                    style={{
                      width: "100%", padding: "14px", borderRadius: 12, border: "none",
                      background: "#1a7a5e", color: "white", fontSize: 14, fontWeight: 800,
                      cursor: !effectiveCount || contributing || !goal ? "default" : "pointer",
                      opacity: !effectiveCount || contributing || !goal ? 0.5 : 1,
                      fontFamily: "Nunito, sans-serif", transition: "opacity 0.15s",
                    }}
                  >
                    <Heart size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                    {contributing ? "Processing…" : effectiveCount ? `Fund ${effectiveCount} bundle${effectiveCount > 1 ? "s" : ""} ${dollarsDisplay}` : "Select an amount"}
                  </button>
                </>
              )}
            </>
          ) : isMother ? (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ background: "#e8f5f1", borderRadius: 10, padding: 10, flexShrink: 0 }}>
                <Package size={20} color="#1a7a5e" />
              </div>
              <div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>About your bundle access</div>
                <div style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.6, fontFamily: "Nunito, sans-serif" }}>
                  Bundles are distributed based on your verification status, trust score, and need — not on request. Stay active in your circle, complete your verification, and our team will reach out when a bundle is available for you.
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
              Log in to fund or receive bundles.
            </div>
          )}
        </div>

        {/* ── Section C: Bundle Types ────────────────────────────────────── */}
        <div style={{ marginTop: 16 }}>
          {/* Newborn Bundle System */}
          <div style={{ background: "var(--white)", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 10 }}>
            <button
              onClick={() => setShowNewborn(v => !v)}
              style={{ width: "100%", padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Gift size={18} color="#1a7a5e" />
                Newborn Bundle System
              </div>
              {showNewborn ? <ChevronUp size={18} color="var(--mid)" /> : <ChevronDown size={18} color="var(--mid)" />}
            </button>
            {showNewborn && (
              <div style={{ borderTop: "1px solid var(--border)", padding: "4px 0 8px" }}>
                {NEWBORN_BUNDLES.map((b, i) => (
                  <div key={i} style={{ padding: "12px 18px", borderBottom: i < NEWBORN_BUNDLES.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 800 }}>{b.name}</div>
                      <span style={{ fontSize: 10, background: "#e8f5f1", color: "#1a7a5e", padding: "2px 8px", borderRadius: 20, fontWeight: 700, fontFamily: "Nunito, sans-serif", whiteSpace: "nowrap", marginLeft: 8 }}>{b.tag}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--mid)", lineHeight: 1.5, fontFamily: "Nunito, sans-serif" }}>{b.desc}</div>
                    <div style={{ fontSize: 11, color: "#1a7a5e", fontWeight: 700, marginTop: 4, fontFamily: "Nunito, sans-serif" }}>"{b.sub}"</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Maternity Bundle System */}
          <div style={{ background: "var(--white)", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
            <button
              onClick={() => setShowMaternity(v => !v)}
              style={{ width: "100%", padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", cursor: "pointer", fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Package size={18} color="#1a7a5e" />
                Maternity Bundle System
              </div>
              {showMaternity ? <ChevronUp size={18} color="var(--mid)" /> : <ChevronDown size={18} color="var(--mid)" />}
            </button>
            {showMaternity && (
              <div style={{ borderTop: "1px solid var(--border)", padding: "4px 0 8px" }}>
                {MATERNITY_BUNDLES.map((b, i) => (
                  <div key={i} style={{ padding: "12px 18px", borderBottom: i < MATERNITY_BUNDLES.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 800 }}>{b.name}</div>
                      <span style={{ fontSize: 10, background: "#e8f5f1", color: "#1a7a5e", padding: "2px 8px", borderRadius: 20, fontWeight: 700, fontFamily: "Nunito, sans-serif", whiteSpace: "nowrap", marginLeft: 8 }}>{b.tag}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--mid)", lineHeight: 1.5, fontFamily: "Nunito, sans-serif" }}>{b.desc}</div>
                    <div style={{ fontSize: 11, color: "#1a7a5e", fontWeight: 700, marginTop: 4, fontFamily: "Nunito, sans-serif" }}>"{b.sub}"</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Section D: Transparency Strip ─────────────────────────────── */}
        <div style={{ background: "var(--white)", borderRadius: 16, padding: "18px 18px", marginTop: 16, border: "1px solid var(--border)" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, marginBottom: 12 }}>How your contribution is used</div>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, background: "#e8f5f1", borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1a7a5e", fontFamily: "Nunito, sans-serif" }}>85%</div>
              <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginTop: 2 }}>Goes directly to bundle fulfilment</div>
            </div>
            <div style={{ flex: 1, background: "var(--bg)", borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", fontFamily: "Nunito, sans-serif" }}>15%</div>
              <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginTop: 2 }}>Covers logistics and operations</div>
            </div>
          </div>
          {goal && (
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
              <span><strong style={{ color: "var(--ink)" }}>{goal.deliveredBundles}</strong> delivered this month</span>
              <span>·</span>
              <span><strong style={{ color: "var(--ink)" }}>{goal.fundedBundles}</strong> funded this month</span>
            </div>
          )}
        </div>

        {/* ── Section E: Share Panel (mothers only) ─────────────────────── */}
        {isMother && (
          <div style={{ background: "var(--white)", borderRadius: 16, padding: "18px 18px", marginTop: 16, border: "1px solid var(--border)", marginBottom: 8 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Help spread the word</div>
            <div style={{ fontSize: 12, color: "var(--mid)", marginBottom: 14, fontFamily: "Nunito, sans-serif" }}>
              The more donors who contribute, the more mothers we can support this month.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <a
                href={`https://wa.me/?text=${shareText}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "#25D366", color: "white", textAlign: "center", fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", textDecoration: "none" }}
              >
                WhatsApp
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${shareText}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "#1DA1F2", color: "white", textAlign: "center", fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", textDecoration: "none" }}
              >
                Twitter
              </a>
              <a
                href="https://www.instagram.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "linear-gradient(135deg, #f09433,#e6683c,#dc2743,#cc2366,#bc1888)", color: "white", textAlign: "center", fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", textDecoration: "none" }}
              >
                Instagram
              </a>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
