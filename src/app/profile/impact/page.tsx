"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";

interface ImpactData {
  month: string;
  totalMothersInNeed: number;
  bundles:       { helped: number; percent: number };
  registers:     { helped: number; percent: number };
  discover:      { helped: number; percent: number };
  allThreeAreas: { helped: number; percent: number };
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

  .ip-top { display: grid; grid-template-columns: 1fr; gap: 20px; }
  @media (min-width: 860px) {
    .ip-top { grid-template-columns: 1.35fr 1fr; align-items: start; }
  }

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

  .ch-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; margin: 10px 0; }
  .ch-sq { width: 8px; height: 8px; border-radius: 2px; }

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

// ── SVG grid of 10×5 coloured rects ──────────────────────────────────────────
function GridRects({ x, y, filled, filledColor }: {
  x: number; y: number; filled: number; filledColor: string;
}) {
  const rects = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 10; col++) {
      const idx = row * 10 + col;
      rects.push(
        <rect
          key={idx}
          x={x + col * 14}
          y={y + row * 14}
          width={12}
          height={12}
          rx={2}
          fill={idx < filled ? filledColor : "#d4cfc8"}
        />,
      );
    }
  }
  return <>{rects}</>;
}

// ── Full SVG Venn diagram ─────────────────────────────────────────────────────
function VennDiagram({ d }: { d: ImpactData }) {
  const total   = Math.max(d.totalMothersInNeed, 1);
  const bFilled = Math.round((d.bundles.helped   / total) * 50);
  const rFilled = Math.round((d.registers.helped / total) * 50);
  const dFilled = Math.round((d.discover.helped  / total) * 50);

  const pLabel = (pct: number, helped: number) =>
    d.totalMothersInNeed < 5 && helped > 0
      ? `${helped} of ${d.totalMothersInNeed}`
      : `${pct}%`;

  return (
    <svg
      viewBox="0 0 600 540"
      width="100%"
      style={{ display: "block" }}
      aria-label="Venn diagram showing platform impact across three channels"
    >
      {/* ── Decorative sparkles ──────────────────────────────────────── */}
      <text x={530} y={38}  fontSize={20} opacity={0.22} textAnchor="middle">✨</text>
      <text x={568} y={74}  fontSize={13} opacity={0.18} textAnchor="middle">🌿</text>
      <text x={498} y={96}  fontSize={15} opacity={0.20} textAnchor="middle">✨</text>
      <text x={28}  y={52}  fontSize={14} opacity={0.16} textAnchor="middle">🌿</text>
      <text x={56}  y={470} fontSize={12} opacity={0.14} textAnchor="middle">✨</text>
      <text x={548} y={460} fontSize={13} opacity={0.15} textAnchor="middle">🌿</text>

      {/* ── Three overlapping circles ────────────────────────────────── */}
      <circle cx={300} cy={180} r={170} fill="rgba(155,135,212,0.15)" stroke="#9b87d4" strokeWidth={2} />
      <circle cx={200} cy={340} r={170} fill="rgba(232,168,124,0.15)" stroke="#e8a87c" strokeWidth={2} />
      <circle cx={400} cy={340} r={170} fill="rgba(141,181,128,0.15)" stroke="#8db580" strokeWidth={2} />

      {/* ── Channel labels ───────────────────────────────────────────── */}
      <text x={300} y={70}  textAnchor="middle" fill="#7c5fc2" fontWeight={700} fontSize={14} letterSpacing={2}>🎁 BUNDLES</text>
      <text x={140} y={490} textAnchor="middle" fill="#c87a44" fontWeight={700} fontSize={13}>📦 REGISTERS</text>
      <text x={460} y={490} textAnchor="middle" fill="#5a8b4a" fontWeight={700} fontSize={13}>🛍️ DISCOVER</text>

      {/* ── Bundles circle content ───────────────────────────────────── */}
      <text x={300} y={115} textAnchor="middle" fill="#7c5fc2" fontWeight={700} fontSize={24} fontFamily="Lora, serif">
        {pLabel(d.bundles.percent, d.bundles.helped)}
      </text>
      <GridRects x={230} y={124} filled={bFilled} filledColor="#c4b8e8" />
      <text x={300} y={208} textAnchor="middle" fill="#8a8a8a" fontSize={11}>
        {d.bundles.percent}% of moms supported
      </text>

      {/* ── Registers circle content ─────────────────────────────────── */}
      <text x={200} y={282} textAnchor="middle" fill="#c87a44" fontWeight={700} fontSize={24} fontFamily="Lora, serif">
        {pLabel(d.registers.percent, d.registers.helped)}
      </text>
      <GridRects x={130} y={290} filled={rFilled} filledColor="#e8a87c" />
      <text x={200} y={374} textAnchor="middle" fill="#8a8a8a" fontSize={11}>
        {d.registers.percent}% of moms supported
      </text>

      {/* ── Discover circle content ──────────────────────────────────── */}
      <text x={400} y={282} textAnchor="middle" fill="#5a8b4a" fontWeight={700} fontSize={24} fontFamily="Lora, serif">
        {pLabel(d.discover.percent, d.discover.helped)}
      </text>
      <GridRects x={330} y={290} filled={dFilled} filledColor="#8db580" />
      <text x={400} y={374} textAnchor="middle" fill="#8a8a8a" fontSize={11}>
        {d.discover.percent}% of moms supported
      </text>

      {/* ── Centre overlap — All 3 Areas ─────────────────────────────── */}
      <text x={300} y={255} textAnchor="middle" fill="#1a7a5e" fontWeight={700} fontSize={10} letterSpacing={1.5}>
        ALL 3 AREAS
      </text>
      <text x={300} y={274} textAnchor="middle" fontSize={18}>💚</text>
      <text x={300} y={300} textAnchor="middle" fill="#1a7a5e" fontWeight={700} fontSize={28} fontFamily="Lora, serif">
        {pLabel(d.allThreeAreas.percent, d.allThreeAreas.helped)}
      </text>
      <text x={300} y={318} textAnchor="middle" fill="#6b7280" fontSize={10}>
        of moms
      </text>
    </svg>
  );
}

// ── Channel square grid (HTML, for channel cards) ─────────────────────────────
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

// ── Share buttons ─────────────────────────────────────────────────────────────
const SHARE_BTNS = [
  { icon: "📷", label: "Instagram\nStory",   bg: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)" },
  { icon: "💬", label: "WhatsApp\nStatus",   bg: "#25d366" },
  { icon: "📘", label: "Facebook\nStory",    bg: "#1877f2" },
  { icon: "🔗", label: "Copy\nLink",         bg: "#f3f0ea" },
  { icon: "⬇️", label: "Download\nImage",   bg: "#f3f0ea" },
];

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

  const handleShare = (label: string) => {
    if (label.startsWith("Copy")) {
      const url = typeof window !== "undefined" ? window.location.origin : "https://kradel.com";
      navigator.clipboard.writeText(`${url}/profile/impact`).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const d: ImpactData = data ?? {
    month: new Date().toISOString().slice(0, 7),
    totalMothersInNeed: 0,
    bundles:       { helped: 0, percent: 0 },
    registers:     { helped: 0, percent: 0 },
    discover:      { helped: 0, percent: 0 },
    allThreeAreas: { helped: 0, percent: 0 },
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

                {/* ── LEFT: SVG Venn + highlight ── */}
                <div>
                  <div className="ip-card" style={{ padding: "24px 16px", position: "relative", overflow: "hidden" }}>
                    <VennDiagram d={d} />
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
                    {[
                      { color: "#e8e4de", border: "none",             text: <><b style={{ color: "#2a2a2a" }}>Grey squares</b> = a mom who needed support this month</> },
                      { color: "#7bc4a4", border: "none",             text: <><b style={{ color: "#2a2a2a" }}>Green squares</b> = a mom who received support through that channel</> },
                      { color: "rgba(26,122,94,0.2)", border: "1px solid #1a7a5e", text: <><b style={{ color: "#2a2a2a" }}>The overlapping centre</b> = moms supported through all 3 channels</> },
                    ].map(({ color, border, text }, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < 2 ? 10 : 0 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 2, background: color, border, flexShrink: 0, marginTop: 2 }} />
                        <div style={{ fontSize: 12, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>{text}</div>
                      </div>
                    ))}
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

                  {/* Share — horizontal circle buttons */}
                  <div className="ip-card">
                    <div className="ip-card-label">Share your impact</div>
                    <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
                      {SHARE_BTNS.map(btn => (
                        <button
                          key={btn.label}
                          onClick={() => handleShare(btn.label)}
                          style={{ flex: 1, maxWidth: 64, background: "transparent", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer", padding: 0 }}
                        >
                          <div style={{ width: 52, height: 52, borderRadius: "50%", background: btn.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                            {btn.icon === "📘"
                              ? <span style={{ color: "white", fontWeight: 800, fontSize: 20 }}>f</span>
                              : btn.label.startsWith("Copy") && copied
                              ? "✓"
                              : btn.icon}
                          </div>
                          <span style={{ fontSize: 10, textAlign: "center", lineHeight: 1.3, fontFamily: "Nunito, sans-serif", color: "#5a5a5a", whiteSpace: "pre-line" }}>
                            {btn.label.startsWith("Copy") && copied ? "Copied!" : btn.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* ── Channel cards ── */}
              <div className="ip-channels">
                <div style={{ background: "#f5f2ff", borderRadius: 20, padding: "20px 18px", border: "1px solid #d4cdf0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#ede9ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🎁</div>
                    <div>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 13, fontWeight: 700, color: "#2a2a2a" }}>Bundles</div>
                      <div style={{ fontSize: 11, color: "#9b87d4", fontWeight: 700 }}>{pctLabel(d.bundles.helped, d.totalMothersInNeed, d.bundles.percent)} of moms supported</div>
                    </div>
                  </div>
                  <ChannelGrid percent={d.bundles.percent} filledColor="#c4b8e8" />
                  <div style={{ fontSize: 12, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5, marginTop: 6 }}>Because of you, moms are healing, recovering and feeling supported.</div>
                </div>

                <div style={{ background: "#fff6f0", borderRadius: 20, padding: "20px 18px", border: "1px solid #f0c8a8" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#fff0e6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📦</div>
                    <div>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 13, fontWeight: 700, color: "#2a2a2a" }}>Registers</div>
                      <div style={{ fontSize: 11, color: "#c4784a", fontWeight: 700 }}>{pctLabel(d.registers.helped, d.totalMothersInNeed, d.registers.percent)} of moms supported</div>
                    </div>
                  </div>
                  <ChannelGrid percent={d.registers.percent} filledColor="#e8a87c" />
                  <div style={{ fontSize: 12, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5, marginTop: 6 }}>Because of you, everyday needs are met with dignity and care.</div>
                </div>

                <div style={{ background: "#f0faf5", borderRadius: 20, padding: "20px 18px", border: "1px solid #a8d4bf" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#e0f4ec", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛍️</div>
                    <div>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 13, fontWeight: 700, color: "#2a2a2a" }}>Discover</div>
                      <div style={{ fontSize: 11, color: "#3d7a32", fontWeight: 700 }}>{pctLabel(d.discover.helped, d.totalMothersInNeed, d.discover.percent)} of moms supported</div>
                    </div>
                  </div>
                  <ChannelGrid percent={d.discover.percent} filledColor="#8db580" />
                  <div style={{ fontSize: 12, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5, marginTop: 6 }}>Because of you, items are shared, reused and loved by another mom.</div>
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
