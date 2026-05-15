"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";

interface ImpactData {
  month: string;
  totalMothersInNeed: number;
  bundles:      { helped: number; percent: number };
  registers:    { helped: number; percent: number };
  discover:     { helped: number; percent: number };
  allThreeAreas:{ helped: number; percent: number };
  overallPercent: number;
  tagline: string;
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Nunito:wght@400;600;700;800&display=swap');

  .ip-page *, .ip-page *::before, .ip-page *::after { box-sizing: border-box; }
  .ip-page {
    font-family: 'Nunito', sans-serif;
    background: #faf8f3;
    min-height: 100vh;
    color: #2a2a2a;
    padding: 0 0 100px;
  }
  .ip-inner { max-width: 1100px; margin: 0 auto; padding: 20px 16px; }

  /* top grid */
  .ip-top { display: grid; grid-template-columns: 1fr; gap: 20px; }
  @media (min-width: 860px) {
    .ip-top { grid-template-columns: 1.35fr 1fr; align-items: start; }
  }

  /* bottom channel cards */
  .ip-channels { display: grid; grid-template-columns: 1fr; gap: 14px; margin-top: 20px; }
  @media (min-width: 600px) {
    .ip-channels { grid-template-columns: repeat(3, 1fr); }
  }

  .ip-card {
    background: white; border-radius: 20px; padding: 22px 20px;
    border: 1px solid #ede8df;
  }
  .ip-card-label {
    font-family: 'Lora', serif; font-size: 11px; font-weight: 700;
    letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 16px;
    color: #1a7a5e;
  }

  /* Venn diagram */
  .venn-wrap {
    position: relative; width: 300px; height: 285px; margin: 0 auto;
  }
  .venn-circle {
    position: absolute; width: 168px; height: 168px; border-radius: 50%;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 5px;
  }
  .venn-center {
    position: absolute; width: 80px; height: 80px; border-radius: 50%;
    background: rgba(26,122,94,0.12); border: 1px solid rgba(26,122,94,0.25);
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; z-index: 20; gap: 1px;
  }
  .venn-label {
    position: absolute; font-size: 10px; font-weight: 700;
    text-align: center; line-height: 1.3;
    font-family: 'Nunito', sans-serif;
  }

  /* mini square grid inside venn circles */
  .sq-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 1.5px; }
  .sq { width: 6px; height: 6px; border-radius: 1px; }

  /* channel card square grid */
  .ch-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; margin: 10px 0; }
  .ch-sq { width: 8px; height: 8px; border-radius: 2px; }

  /* share buttons */
  .share-btn {
    width: 100%; padding: 10px 14px; border-radius: 10px;
    border: 1px solid #ede8df; background: #faf8f3;
    font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 700;
    color: #2a2a2a; cursor: pointer; display: flex; align-items: center;
    gap: 8px; margin-bottom: 8px; text-align: left;
  }
  .share-btn:hover { background: #f0ede6; }
  .share-btn:last-of-type { margin-bottom: 0; }

  .highlight-bar {
    background: linear-gradient(135deg, #1a7a5e 0%, #22a37c 100%);
    border-radius: 16px; padding: 16px 20px; margin-top: 16px; color: white;
    font-family: 'Nunito', sans-serif; font-size: 14px; line-height: 1.5;
  }
  .highlight-bar b { font-size: 18px; }

  .ip-footer {
    margin-top: 28px; padding: 16px 20px; text-align: center;
    border-top: 1px solid #ede8df; font-size: 11px; color: #8a8a8a;
    font-family: 'Nunito', sans-serif; line-height: 1.8;
  }
`;

function SquareGrid({ total, filled, filledColor, emptyColor = "#d4cfc8", cols = 10 }: {
  total: number; filled: number; filledColor: string; emptyColor?: string; cols?: number;
}) {
  return (
    <div className="sq-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="sq" style={{ background: i < filled ? filledColor : emptyColor }} />
      ))}
    </div>
  );
}

function ChannelGrid({ percent, filledColor }: { percent: number; filledColor: string }) {
  const filled = Math.round((percent / 100) * 50);
  return (
    <div className="ch-grid">
      {Array.from({ length: 50 }, (_, i) => (
        <div key={i} className="ch-sq" style={{ background: i < filled ? filledColor : "#e8e4de" }} />
      ))}
    </div>
  );
}

function pctLabel(helped: number, total: number, pct: number): string {
  if (total < 5 && helped > 0) return `${helped} of ${total} moms`;
  return `${pct}%`;
}

export default function ImpactPage() {
  const router = useRouter();
  const [data,    setData]    = useState<ImpactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(false);

  useEffect(() => {
    fetch("/api/impact/monthly")
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = () => {
    const url = typeof window !== "undefined" ? window.location.origin : "https://kradel.com";
    navigator.clipboard.writeText(`${url}/profile/impact`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Zero-state defaults while loading or no data
  const d: ImpactData = data ?? {
    month: new Date().toISOString().slice(0, 7),
    totalMothersInNeed: 0,
    bundles:      { helped: 0, percent: 0 },
    registers:    { helped: 0, percent: 0 },
    discover:     { helped: 0, percent: 0 },
    allThreeAreas:{ helped: 0, percent: 0 },
    overallPercent: 0,
    tagline: "You show up. They feel it. We all rise together.",
  };

  const [year, mon] = d.month.split("-");
  const monthLabel = new Date(parseInt(year), parseInt(mon) - 1, 1)
    .toLocaleString("en", { month: "long", year: "numeric" });

  const isEmpty = d.totalMothersInNeed === 0 && !loading;

  return (
    <>
      <style>{styles}</style>
      <div className="ip-page">

        {/* Header */}
        <div style={{ background: "white", borderBottom: "1px solid #ede8df", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "#faf8f3", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: "#2a2a2a" }}>Monthly Impact</div>
            <div style={{ fontSize: 11, color: "#8a8a8a", fontFamily: "Nunito, sans-serif" }}>{monthLabel}</div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 20, background: "#e8f5f1", color: "#1a7a5e", letterSpacing: "0.8px" }}>IMPACT CARD</span>
        </div>

        <div className="ip-inner">

          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#8a8a8a" }}>
              <div className="spinner" style={{ margin: "0 auto 12px" }} />
              Loading impact data…
            </div>
          ) : isEmpty ? (
            <div style={{ textAlign: "center", padding: "48px 20px" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🌱</div>
              <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: "#1a7a5e", marginBottom: 8 }}>Your impact story is just beginning</div>
              <div style={{ fontSize: 14, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
                As more moms receive support this month, this card will fill with their stories.
              </div>
            </div>
          ) : (
            <>
              {/* Top heading */}
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: "#2a2a2a", lineHeight: 1.3, marginBottom: 6 }}>
                  Together, we turned need into support.
                </div>
                <div style={{ fontSize: 13, color: "#5a5a5a", fontFamily: "Nunito, sans-serif" }}>
                  Here&rsquo;s the impact we made this month.
                </div>
              </div>

              <div className="ip-top">

                {/* ── LEFT: Venn + highlight ── */}
                <div>
                  <div className="ip-card" style={{ padding: "24px 16px" }}>

                    {/* Venn diagram */}
                    <div className="venn-wrap">

                      {/* Bundles — top center */}
                      <div className="venn-circle" style={{ top: 0, left: 66, background: "rgba(235,229,255,0.75)", border: "2px solid #9b87d4", zIndex: 3 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#7c68c8", letterSpacing: "0.5px" }}>BUNDLES</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#6d5acd" }}>
                          {pctLabel(d.bundles.helped, d.totalMothersInNeed, d.bundles.percent)}
                        </div>
                        <SquareGrid total={50} filled={Math.round((d.bundles.percent / 100) * 50)} filledColor="#c4b8e8" emptyColor="rgba(255,255,255,0.6)" />
                      </div>

                      {/* Registers — bottom left */}
                      <div className="venn-circle" style={{ top: 107, left: 0, background: "rgba(255,237,220,0.75)", border: "2px solid #e8a87c", zIndex: 2 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#c4784a", letterSpacing: "0.5px" }}>REGISTERS</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#c4784a" }}>
                          {pctLabel(d.registers.helped, d.totalMothersInNeed, d.registers.percent)}
                        </div>
                        <SquareGrid total={50} filled={Math.round((d.registers.percent / 100) * 50)} filledColor="#e8a87c" emptyColor="rgba(255,255,255,0.6)" />
                      </div>

                      {/* Discover — bottom right */}
                      <div className="venn-circle" style={{ top: 107, left: 132, background: "rgba(220,242,232,0.75)", border: "2px solid #8db580", zIndex: 2 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#4e8a42", letterSpacing: "0.5px" }}>DISCOVER</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#3d7a32" }}>
                          {pctLabel(d.discover.helped, d.totalMothersInNeed, d.discover.percent)}
                        </div>
                        <SquareGrid total={50} filled={Math.round((d.discover.percent / 100) * 50)} filledColor="#8db580" emptyColor="rgba(255,255,255,0.6)" />
                      </div>

                      {/* Center overlap — All 3 Areas */}
                      <div className="venn-center" style={{ top: 130, left: 110 }}>
                        <div style={{ fontSize: 16 }}>💚</div>
                        <div style={{ fontSize: 8, fontWeight: 800, color: "#1a7a5e", letterSpacing: "0.5px" }}>ALL 3 AREAS</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#1a7a5e" }}>
                          {pctLabel(d.allThreeAreas.helped, d.totalMothersInNeed, d.allThreeAreas.percent)}
                        </div>
                        <div style={{ fontSize: 7, color: "#5a9a72" }}>of moms</div>
                      </div>

                      {/* Circle labels below */}
                      <div className="venn-label" style={{ top: 274, left: 66, width: 168, color: "#9b87d4" }}>
                        Bundles · {pctLabel(d.bundles.helped, d.totalMothersInNeed, d.bundles.percent)} supported
                      </div>
                    </div>

                    {/* Channel name labels under diagram */}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0 8px", marginTop: 8, fontSize: 10, fontWeight: 700, fontFamily: "Nunito, sans-serif" }}>
                      <span style={{ color: "#c4784a" }}>Registers · {pctLabel(d.registers.helped, d.totalMothersInNeed, d.registers.percent)}</span>
                      <span style={{ color: "#9b87d4" }}>Bundles · {pctLabel(d.bundles.helped, d.totalMothersInNeed, d.bundles.percent)}</span>
                      <span style={{ color: "#4e8a42" }}>Discover · {pctLabel(d.discover.helped, d.totalMothersInNeed, d.discover.percent)}</span>
                    </div>
                  </div>

                  {/* Highlight bar */}
                  <div className="highlight-bar">
                    Because of you, <b>{d.overallPercent}%</b> of the moms in need received support this month.
                  </div>

                  {/* Tagline */}
                  <div style={{ textAlign: "center", marginTop: 14, marginBottom: 4 }}>
                    <div style={{ fontFamily: "Lora, serif", fontStyle: "italic", fontSize: 14, color: "#3d3d3d", lineHeight: 1.6 }}>
                      &ldquo;{d.tagline}&rdquo;
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1a7a5e", marginTop: 6, fontFamily: "Nunito, sans-serif" }}>
                      #CareMovesEverything
                    </div>
                  </div>
                </div>

                {/* ── RIGHT: Info + Share ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                  {/* How it works */}
                  <div className="ip-card">
                    <div className="ip-card-label">How it works</div>
                    <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 2, background: "#e8e4de", flexShrink: 0, marginTop: 2 }} />
                      <div style={{ fontSize: 12, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>
                        <b style={{ color: "#2a2a2a" }}>Grey squares</b> = a mom who needed support this month
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 2, background: "#7bc4a4", flexShrink: 0, marginTop: 2 }} />
                      <div style={{ fontSize: 12, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>
                        <b style={{ color: "#2a2a2a" }}>Green squares</b> = a mom who received support through that channel
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 2, background: "rgba(26,122,94,0.2)", border: "1px solid #1a7a5e", flexShrink: 0, marginTop: 2 }} />
                      <div style={{ fontSize: 12, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>
                        <b style={{ color: "#2a2a2a" }}>The overlapping centre</b> = moms supported through all 3 channels
                      </div>
                    </div>
                  </div>

                  {/* Why it matters */}
                  <div className="ip-card">
                    <div className="ip-card-label">This is why it matters</div>
                    {[
                      { icon: "🧡", text: "Every square is a real mom — a name, a story, a need met." },
                      { icon: "🌿", text: "Your support helps remove barriers that keep moms from thriving." },
                      { icon: "🤝", text: "When we work together across channels, no one falls through the gaps." },
                      { icon: "💫", text: "Small acts. Big ripple. You might never know whose life you changed." },
                    ].map(({ icon, text }) => (
                      <div key={text} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 15, lineHeight: 1, marginTop: 1 }}>{icon}</span>
                        <div style={{ fontSize: 12, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>{text}</div>
                      </div>
                    ))}
                  </div>

                  {/* Share */}
                  <div className="ip-card">
                    <div className="ip-card-label">Share your impact</div>
                    {[
                      { icon: "📸", label: "Instagram Story" },
                      { icon: "💬", label: "WhatsApp Status" },
                      { icon: "📘", label: "Facebook Story" },
                    ].map(({ icon, label }) => (
                      <button key={label} className="share-btn" onClick={() => {}}>
                        <span style={{ fontSize: 16 }}>{icon}</span>
                        <span>{label}</span>
                      </button>
                    ))}
                    <button className="share-btn" onClick={handleCopy}>
                      <span style={{ fontSize: 16 }}>🔗</span>
                      <span>{copied ? "Copied ✓" : "Copy Link"}</span>
                    </button>
                  </div>

                </div>
              </div>

              {/* ── Channel cards ── */}
              <div className="ip-channels">

                {/* Bundles */}
                <div style={{ background: "#f5f2ff", borderRadius: 20, padding: "20px 18px", border: "1px solid #d4cdf0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#ede9ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🎁</div>
                    <div>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 13, fontWeight: 700, color: "#2a2a2a" }}>Bundles</div>
                      <div style={{ fontSize: 11, color: "#9b87d4", fontWeight: 700 }}>{pctLabel(d.bundles.helped, d.totalMothersInNeed, d.bundles.percent)} of moms supported</div>
                    </div>
                  </div>
                  <ChannelGrid percent={d.bundles.percent} filledColor="#c4b8e8" />
                  <div style={{ fontSize: 12, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5, marginTop: 6 }}>
                    Because of you, moms are healing, recovering and feeling supported.
                  </div>
                </div>

                {/* Registers */}
                <div style={{ background: "#fff6f0", borderRadius: 20, padding: "20px 18px", border: "1px solid #f0c8a8" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#fff0e6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📦</div>
                    <div>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 13, fontWeight: 700, color: "#2a2a2a" }}>Registers</div>
                      <div style={{ fontSize: 11, color: "#c4784a", fontWeight: 700 }}>{pctLabel(d.registers.helped, d.totalMothersInNeed, d.registers.percent)} of moms supported</div>
                    </div>
                  </div>
                  <ChannelGrid percent={d.registers.percent} filledColor="#e8a87c" />
                  <div style={{ fontSize: 12, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5, marginTop: 6 }}>
                    Because of you, everyday needs are met with dignity and care.
                  </div>
                </div>

                {/* Discover */}
                <div style={{ background: "#f0faf5", borderRadius: 20, padding: "20px 18px", border: "1px solid #a8d4bf" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#e0f4ec", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛍️</div>
                    <div>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 13, fontWeight: 700, color: "#2a2a2a" }}>Discover</div>
                      <div style={{ fontSize: 11, color: "#3d7a32", fontWeight: 700 }}>{pctLabel(d.discover.helped, d.totalMothersInNeed, d.discover.percent)} of moms supported</div>
                    </div>
                  </div>
                  <ChannelGrid percent={d.discover.percent} filledColor="#8db580" />
                  <div style={{ fontSize: 12, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5, marginTop: 6 }}>
                    Because of you, items are shared, reused and loved by another mom.
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="ip-footer">
                <div style={{ marginBottom: 4 }}>🛡️ We protect every mom&rsquo;s privacy. No personal details are ever shared.</div>
                <div style={{ fontWeight: 700, color: "#2a2a2a" }}>Kradel · Care moves everything. 💚</div>
              </div>

            </>
          )}
        </div>
      </div>
      <BottomNav />
    </>
  );
}
