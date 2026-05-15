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

  .ip-header {
    background: white;
    border-bottom: 1px solid #ede8df;
    padding: 14px 16px 16px;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .ip-header-title {
    font-family: 'Lora', serif;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #2a2a2a;
    display: flex;
    align-items: center;
    gap: 8px;
    line-height: 1.2;
  }
  .ip-header-sub {
    font-size: 12px;
    color: #8a8a8a;
    font-family: 'Nunito', sans-serif;
    margin-top: 3px;
  }

  .ip-inner { max-width: 1200px; margin: 0 auto; padding: 20px 16px; }
  @media (min-width: 860px) { .ip-inner { padding: 28px 32px; } }

  .ip-top { display: grid; grid-template-columns: 1fr; gap: 20px; }
  @media (min-width: 860px) { .ip-top { grid-template-columns: 1.35fr 1fr; align-items: start; } }

  .ip-channels { display: grid; grid-template-columns: 1fr; gap: 14px; margin-top: 20px; }
  @media (min-width: 600px) { .ip-channels { grid-template-columns: repeat(3, 1fr); } }

  .ip-card {
    background: white;
    border-radius: 24px;
    padding: 32px 24px;
    border: 1px solid #ede8df;
    box-shadow: 0 2px 14px rgba(0,0,0,0.04);
    position: relative;
    overflow: hidden;
  }

  .ip-info-card {
    background: white;
    border-radius: 20px;
    padding: 20px;
    border: 1px solid #ede8df;
    box-shadow: 0 1px 8px rgba(0,0,0,0.03);
  }

  .ip-card-label {
    font-family: 'Nunito', sans-serif;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    margin-bottom: 14px;
    color: #1a7a5e;
  }

  .ch-grid-wide { display: grid; grid-template-columns: repeat(25, 1fr); gap: 2px; margin: 10px 0; }
  .ch-sq { height: 7px; border-radius: 2px; }

  .ip-footer {
    margin-top: 28px;
    padding: 20px;
    text-align: center;
    border-top: 1px solid #ede8df;
    font-family: 'Lora', serif;
    font-style: italic;
    font-size: 13px;
    color: #8a8a8a;
    line-height: 1.9;
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

// ── Full SVG Venn diagram — soft Kradel palette ───────────────────────────────
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
      {/* ── Decorative sparkles ── */}
      <text x={530} y={38}  fontSize={17} opacity={0.20} textAnchor="middle">✨</text>
      <text x={566} y={72}  fontSize={11} opacity={0.14} textAnchor="middle">🌿</text>
      <text x={500} y={95}  fontSize={13} opacity={0.17} textAnchor="middle">✨</text>
      <text x={30}  y={54}  fontSize={11} opacity={0.13} textAnchor="middle">🌿</text>
      <text x={58}  y={468} fontSize={10} opacity={0.11} textAnchor="middle">✨</text>
      <text x={546} y={458} fontSize={11} opacity={0.12} textAnchor="middle">🌿</text>

      {/* ── Three overlapping circles — softened palette ── */}
      <circle cx={300} cy={180} r={170} fill="rgba(168,155,217,0.08)" stroke="#a89bd9" strokeWidth={1.8} />
      <circle cx={200} cy={340} r={170} fill="rgba(212,165,116,0.08)" stroke="#d4a574" strokeWidth={1.8} />
      <circle cx={400} cy={340} r={170} fill="rgba(141,181,128,0.10)" stroke="#8db580" strokeWidth={1.8} />

      {/* ── Channel labels ── */}
      <text x={300} y={70}  textAnchor="middle" fill="#7c5fc2" fontWeight={700} fontSize={13} letterSpacing={1.4}>🎁 BUNDLES</text>
      <text x={140} y={492} textAnchor="middle" fill="#b07840" fontWeight={700} fontSize={12}>📦 REGISTERS</text>
      <text x={460} y={492} textAnchor="middle" fill="#4a7a3a" fontWeight={700} fontSize={12}>🛍️ DISCOVER</text>

      {/* ── Bundles circle content ── */}
      <text x={300} y={115} textAnchor="middle" fill="#7c5fc2" fontWeight={700} fontSize={24} fontFamily="Lora, serif">
        {pLabel(d.bundles.percent, d.bundles.helped)}
      </text>
      <GridRects x={230} y={124} filled={bFilled} filledColor="#c4b8e8" />
      <text x={300} y={208} textAnchor="middle" fill="#8a8a8a" fontSize={10}>
        {d.bundles.percent}% of moms supported
      </text>

      {/* ── Registers circle content ── */}
      <text x={200} y={282} textAnchor="middle" fill="#b07840" fontWeight={700} fontSize={24} fontFamily="Lora, serif">
        {pLabel(d.registers.percent, d.registers.helped)}
      </text>
      <GridRects x={130} y={290} filled={rFilled} filledColor="#e8b87c" />
      <text x={200} y={374} textAnchor="middle" fill="#8a8a8a" fontSize={10}>
        {d.registers.percent}% of moms supported
      </text>

      {/* ── Discover circle content ── */}
      <text x={400} y={282} textAnchor="middle" fill="#4a7a3a" fontWeight={700} fontSize={24} fontFamily="Lora, serif">
        {pLabel(d.discover.percent, d.discover.helped)}
      </text>
      <GridRects x={330} y={290} filled={dFilled} filledColor="#8db580" />
      <text x={400} y={374} textAnchor="middle" fill="#8a8a8a" fontSize={10}>
        {d.discover.percent}% of moms supported
      </text>

      {/* ── Centre overlap — All 3 Areas ── */}
      <text x={300} y={255} textAnchor="middle" fill="#1a7a5e" fontWeight={700} fontSize={9} letterSpacing={1.5}>
        ALL 3 AREAS
      </text>
      <text x={300} y={274} textAnchor="middle" fontSize={16}>💚</text>
      <text x={300} y={300} textAnchor="middle" fill="#1a7a5e" fontWeight={700} fontSize={28} fontFamily="Lora, serif">
        {pLabel(d.allThreeAreas.percent, d.allThreeAreas.helped)}
      </text>
      <text x={300} y={318} textAnchor="middle" fill="#6b7280" fontSize={10}>
        of moms
      </text>
    </svg>
  );
}

// ── Channel grid: 25 cols × 2 rows = 50 thin blocks ──────────────────────────
function ChannelGrid({ percent, filledColor }: { percent: number; filledColor: string }) {
  const filled = Math.round((percent / 100) * 50);
  return (
    <div className="ch-grid-wide">
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

// ── Share button definitions ──────────────────────────────────────────────────
interface ShareBtn {
  key: string; label: string; circleBg: string;
  emoji?: string; textIcon?: string; textColor?: string;
}
const SHARE_BTNS: ShareBtn[] = [
  { key: "instagram", label: "Instagram\nStory",  circleBg: "linear-gradient(135deg,#ffd6c0,#f9b8c8)", emoji: "📷" },
  { key: "whatsapp",  label: "WhatsApp\nStatus",  circleBg: "#dcf0e3", emoji: "💬" },
  { key: "facebook",  label: "Facebook\nStory",   circleBg: "#e6f0fa", textIcon: "f", textColor: "#1877f2" },
  { key: "copy",      label: "Copy\nLink",         circleBg: "#f3f0ea", emoji: "🔗" },
  { key: "download",  label: "Download\nImage",   circleBg: "#f3f0ea", emoji: "⬇️" },
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

  const handleShare = (key: string) => {
    if (key === "copy") {
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

        {/* ── Header ── */}
        <div className="ip-header">
          <button
            onClick={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: "50%", background: "#faf8f3", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >←</button>
          <div style={{ flex: 1 }}>
            <div className="ip-header-title">
              YOUR MONTHLY IMPACT
              <span style={{ color: "#6d5acd", fontSize: 17, lineHeight: 1 }}>♡</span>
            </div>
            <div className="ip-header-sub">Here&rsquo;s what care looked like this month.</div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 20, background: "#e8f5f1", color: "#1a7a5e", letterSpacing: "0.8px", whiteSpace: "nowrap", fontFamily: "Nunito, sans-serif" }}>
            {monthLabel}
          </span>
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
              {/* ── Top heading ── */}
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 24, fontWeight: 600, color: "#2a2a2a", lineHeight: 1.3, marginBottom: 6 }}>
                  Together, we turned need into support.
                </div>
                <div style={{ fontSize: 13, color: "#5a5a5a", fontFamily: "Nunito, sans-serif" }}>
                  {monthLabel} &mdash; here&rsquo;s how Kradel showed up for moms.
                </div>
              </div>

              <div className="ip-top">

                {/* ── LEFT: Venn card ── */}
                <div>
                  <div className="ip-card">
                    {/* Decorative leaf — top-right of card */}
                    <svg
                      style={{ position: "absolute", top: 14, right: 14, opacity: 0.28, pointerEvents: "none" }}
                      width="52" height="40" viewBox="0 0 52 40"
                    >
                      <path d="M26,3 Q46,3 48,20 Q46,37 26,37 Q14,31 10,20 Q14,9 26,3Z" fill="#1a7a5e" />
                      <path d="M26,3 L26,37" stroke="white" strokeWidth="1.2" opacity="0.55" />
                      <path d="M14,14 Q26,11 38,16" stroke="white" strokeWidth="0.9" fill="none" opacity="0.45" />
                      <path d="M12,22 Q26,19 40,24" stroke="white" strokeWidth="0.9" fill="none" opacity="0.45" />
                    </svg>

                    <VennDiagram d={d} />

                    {/* "Because of you" mint callout — inside the card */}
                    <div style={{ background: "#e8f5f0", borderRadius: 16, padding: "14px 18px", marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#1a7a5e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 17 }}>
                        💚
                      </div>
                      <div style={{ flex: 1, fontFamily: "Nunito, sans-serif", fontSize: 14, color: "#2a2a2a", lineHeight: 1.5 }}>
                        Because of you, <span style={{ fontWeight: 800, color: "#1a7a5e" }}>{d.overallPercent}%</span> of the moms in need received support this month.
                      </div>
                    </div>

                    {/* Tagline */}
                    <div style={{ textAlign: "center", marginTop: 18, paddingTop: 16, borderTop: "1px solid #ede8df" }}>
                      <div style={{ fontFamily: "Lora, serif", fontStyle: "italic", fontSize: 16, color: "#3d3d3d", lineHeight: 1.65, marginBottom: 12 }}>
                        &ldquo;{d.tagline}&rdquo;
                      </div>
                      <span style={{ display: "inline-block", background: "#e8f5f0", color: "#1a7a5e", fontSize: 12, fontWeight: 800, padding: "5px 16px", borderRadius: 20, fontFamily: "Nunito, sans-serif", letterSpacing: "0.3px" }}>
                        #CareMovesEverything
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT: Info cards + Share ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                  {/* HOW IT WORKS */}
                  <div className="ip-info-card">
                    <div className="ip-card-label">How it works</div>
                    {[
                      { color: "#e8e4de", border: "none",                          text: <><b style={{ color: "#2a2a2a" }}>Grey squares</b> = a mom who needed support this month</> },
                      { color: "#7bc4a4", border: "none",                          text: <><b style={{ color: "#2a2a2a" }}>Coloured squares</b> = a mom who received support through that channel</> },
                      { color: "rgba(26,122,94,0.18)", border: "1px solid #1a7a5e", text: <><b style={{ color: "#2a2a2a" }}>The centre overlap</b> = moms supported through all 3 channels</> },
                    ].map(({ color, border, text }, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < 2 ? 12 : 0, alignItems: "flex-start" }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, background: color, border, flexShrink: 0, marginTop: 2 }} />
                        <div style={{ fontSize: 12, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>{text}</div>
                      </div>
                    ))}
                  </div>

                  {/* WHY IT MATTERS */}
                  <div className="ip-info-card">
                    <div className="ip-card-label">Why it matters</div>
                    {[
                      { icon: "🧡", text: "Every square is a real mom — a name, a story, a need met." },
                      { icon: "🌿", text: "Your support removes barriers that keep moms from thriving." },
                      { icon: "🤝", text: "When we work across channels, no one falls through the gaps." },
                      { icon: "💫", text: "Small acts. Big ripple. You might never know whose life you changed." },
                    ].map(({ icon, text }) => (
                      <div key={text} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e8f5f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                          {icon}
                        </div>
                        <div style={{ fontSize: 12, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5, paddingTop: 8 }}>{text}</div>
                      </div>
                    ))}
                  </div>

                  {/* SHARE */}
                  <div className="ip-info-card">
                    <div className="ip-card-label">Share your impact</div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "space-between" }}>
                      {SHARE_BTNS.map(btn => (
                        <button
                          key={btn.key}
                          onClick={() => handleShare(btn.key)}
                          style={{ flex: 1, maxWidth: 64, background: "transparent", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", padding: 0 }}
                        >
                          <div style={{ width: 56, height: 56, borderRadius: "50%", background: btn.circleBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                            {btn.textIcon
                              ? <span style={{ color: btn.textColor, fontWeight: 900, fontSize: 22, fontFamily: "Nunito, sans-serif" }}>{btn.textIcon}</span>
                              : btn.key === "copy" && copied
                              ? "✓"
                              : btn.emoji}
                          </div>
                          <span style={{ fontSize: 10, textAlign: "center", lineHeight: 1.3, fontFamily: "Nunito, sans-serif", color: "#5a5a5a", whiteSpace: "pre-line" }}>
                            {btn.key === "copy" && copied ? "Copied!" : btn.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* ── Channel cards ── */}
              <div className="ip-channels">

                <div style={{ background: "#f5f2ff", borderRadius: 20, padding: "20px", border: "1px solid #d4cdf0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#ede9ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🎁</div>
                    <div>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "#2a2a2a" }}>Bundles</div>
                      <div style={{ fontSize: 11, color: "#7c5fc2", fontWeight: 800, fontFamily: "Nunito, sans-serif" }}>{pctLabel(d.bundles.helped, d.totalMothersInNeed, d.bundles.percent)} of moms supported</div>
                    </div>
                  </div>
                  <ChannelGrid percent={d.bundles.percent} filledColor="#c4b8e8" />
                  <div style={{ fontSize: 12, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5, marginTop: 8 }}>Because of you, moms are healing, recovering and feeling supported.</div>
                </div>

                <div style={{ background: "#fff6f0", borderRadius: 20, padding: "20px", border: "1px solid #f0c8a8" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fff0e6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📦</div>
                    <div>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "#2a2a2a" }}>Registers</div>
                      <div style={{ fontSize: 11, color: "#c4784a", fontWeight: 800, fontFamily: "Nunito, sans-serif" }}>{pctLabel(d.registers.helped, d.totalMothersInNeed, d.registers.percent)} of moms supported</div>
                    </div>
                  </div>
                  <ChannelGrid percent={d.registers.percent} filledColor="#e8a87c" />
                  <div style={{ fontSize: 12, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5, marginTop: 8 }}>Because of you, everyday needs are met with dignity and care.</div>
                </div>

                <div style={{ background: "#f0faf5", borderRadius: 20, padding: "20px", border: "1px solid #a8d4bf" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#e0f4ec", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🛍️</div>
                    <div>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "#2a2a2a" }}>Discover</div>
                      <div style={{ fontSize: 11, color: "#3d7a32", fontWeight: 800, fontFamily: "Nunito, sans-serif" }}>{pctLabel(d.discover.helped, d.totalMothersInNeed, d.discover.percent)} of moms supported</div>
                    </div>
                  </div>
                  <ChannelGrid percent={d.discover.percent} filledColor="#8db580" />
                  <div style={{ fontSize: 12, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5, marginTop: 8 }}>Because of you, items are shared, reused and loved by another mom.</div>
                </div>

              </div>

              {/* ── Privacy footer ── */}
              <div className="ip-footer">
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="1.75" style={{ flexShrink: 0 }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                  <span>We protect every mom&rsquo;s privacy. No personal details are ever shared.</span>
                </div>
                <div>Kradel &middot; Care moves everything. 💚</div>
              </div>

            </>
          )}
        </div>
      </div>
      <BottomNav />
    </>
  );
}
