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

  const pLabel = (helped: number) => `${helped} of ${total}`;

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
        {pLabel(d.bundles.helped)}
      </text>
      <GridRects x={230} y={124} filled={bFilled} filledColor="#c4b8e8" />
      <text x={300} y={208} textAnchor="middle" fill="#8a8a8a" fontSize={10}>
        of moms supported
      </text>

      {/* ── Registers circle content ── */}
      <text x={200} y={282} textAnchor="middle" fill="#b07840" fontWeight={700} fontSize={24} fontFamily="Lora, serif">
        {pLabel(d.registers.helped)}
      </text>
      <GridRects x={130} y={290} filled={rFilled} filledColor="#e8b87c" />
      <text x={200} y={374} textAnchor="middle" fill="#8a8a8a" fontSize={10}>
        of moms supported
      </text>

      {/* ── Discover circle content ── */}
      <text x={400} y={282} textAnchor="middle" fill="#4a7a3a" fontWeight={700} fontSize={24} fontFamily="Lora, serif">
        {pLabel(d.discover.helped)}
      </text>
      <GridRects x={330} y={290} filled={dFilled} filledColor="#8db580" />
      <text x={400} y={374} textAnchor="middle" fill="#8a8a8a" fontSize={10}>
        of moms supported
      </text>

      {/* ── Centre overlap — All 3 Areas ── */}
      <text x={300} y={255} textAnchor="middle" fill="#1a7a5e" fontWeight={700} fontSize={9} letterSpacing={1.5}>
        ALL 3 AREAS
      </text>
      <text x={300} y={274} textAnchor="middle" fontSize={16}>💚</text>
      <text x={300} y={300} textAnchor="middle" fill="#1a7a5e" fontWeight={700} fontSize={28} fontFamily="Lora, serif">
        {pLabel(d.allThreeAreas.helped)}
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

// ── Social platform SVG paths (simple-icons) ─────────────────────────────────
const SVG_PATHS = {
  instagram: "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077",
  tiktok:    "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  x:         "M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z",
  threads:   "M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z",
  facebook:  "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z",
  whatsapp:  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z",
};

interface Platform {
  key: string; label: string; bg: string;
  getUrl?: (shareUrl: string, msg: string) => string;
}
const PLATFORMS: Platform[] = [
  {
    key: "instagram", label: "Instagram",
    bg: "linear-gradient(45deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)",
  },
  {
    key: "tiktok", label: "TikTok",
    bg: "#000000",
    getUrl: (u, m) => {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(`${m} ${u}`).catch(() => {});
      }
      return "";
    },
  },
  {
    key: "x", label: "X",
    bg: "#000000",
    getUrl: (u, m) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(m)}&url=${encodeURIComponent(u)}`,
  },
  {
    key: "threads", label: "Threads",
    bg: "#000000",
    getUrl: (u, m) => `https://threads.net/intent/post?text=${encodeURIComponent(`${m} ${u}`)}`,
  },
  {
    key: "facebook", label: "Facebook",
    bg: "#1877F2",
    getUrl: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}`,
  },
  {
    key: "whatsapp", label: "WhatsApp",
    bg: "#25D366",
    getUrl: (u, m) => `https://api.whatsapp.com/send?text=${encodeURIComponent(`${m} ${u}`)}`,
  },
];

export default function ImpactPage() {
  const router = useRouter();
  const [data,      setData]      = useState<ImpactData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [copied,    setCopied]    = useState(false);
  const [ttkCopied, setTtkCopied] = useState(false);

  useEffect(() => {
    fetch("/api/impact/monthly")
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/profile/impact` : "https://sahw-care.vercel.app/profile/impact";
  const shareMsg = (pct: number) => `Kradel helped ${pct}% of moms in need this month. Every square is a real story. 💚`;

  const handlePlatform = (platform: Platform, pct: number) => {
    const url = shareUrl;
    const msg = shareMsg(pct);
    if (platform.key === "instagram") {
      navigator.clipboard.writeText(`${msg} ${url}`).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      return;
    }
    if (platform.key === "tiktok") {
      navigator.clipboard.writeText(`${msg} ${url}`).catch(() => {});
      setTtkCopied(true);
      setTimeout(() => setTtkCopied(false), 2500);
      return;
    }
    if (platform.getUrl) {
      const dest = platform.getUrl(url, msg);
      if (dest) window.open(dest, "_blank", "noopener,noreferrer");
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
                      { icon: "🧡", text: "Every square is a real mom: a name, a story, a need met." },
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

                    {/* 6 platform circles */}
                    <div style={{ display: "flex", gap: 6, justifyContent: "space-between", marginBottom: 14 }}>
                      {PLATFORMS.map(platform => {
                        const isTtk = platform.key === "tiktok" && ttkCopied;
                        const isIg  = platform.key === "instagram" && copied;
                        return (
                          <button
                            key={platform.key}
                            onClick={() => handlePlatform(platform, d.overallPercent)}
                            style={{ flex: 1, background: "transparent", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", padding: 0 }}
                            title={platform.label}
                          >
                            <div style={{ width: 48, height: 48, borderRadius: "50%", background: platform.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {(isTtk || isIg)
                                ? <span style={{ color: "white", fontSize: 18 }}>✓</span>
                                : (
                                  <svg viewBox="0 0 24 24" width="22" height="22" fill="white" aria-hidden="true">
                                    <path d={SVG_PATHS[platform.key as keyof typeof SVG_PATHS]} />
                                  </svg>
                                )}
                            </div>
                            <span style={{ fontSize: 9, textAlign: "center", lineHeight: 1.3, fontFamily: "Nunito, sans-serif", color: "#5a5a5a" }}>
                              {isTtk || isIg ? "Copied!" : platform.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Utility text links */}
                    <div style={{ borderTop: "1px solid #f0ebe3", paddingTop: 12, display: "flex", gap: 16, justifyContent: "center" }}>
                      <button
                        onClick={handleCopyLink}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontFamily: "Nunito, sans-serif", color: copied ? "#1a7a5e" : "#5a5a5a", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <span>{copied ? "✓" : "🔗"}</span>
                        {copied ? "Copied!" : "Copy link"}
                      </button>
                      <button
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontFamily: "Nunito, sans-serif", color: "#5a5a5a", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <span>⬇️</span> Save image
                      </button>
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
                      <div style={{ fontSize: 11, color: "#7c5fc2", fontWeight: 800, fontFamily: "Nunito, sans-serif" }}>{d.bundles.helped} of {d.totalMothersInNeed} moms supported</div>
                    </div>
                  </div>
                  <ChannelGrid percent={d.bundles.percent} filledColor="#c4b8e8" />
                  <div style={{ fontSize: 10, color: "#8a8a8a", fontFamily: "Nunito, sans-serif", marginTop: 4, marginBottom: 6 }}>Each square represents 2% of moms in need this month.</div>
                  <div style={{ fontSize: 12, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5, marginTop: 2 }}>Because of you, moms are healing, recovering and feeling supported.</div>
                </div>

                <div style={{ background: "#fff6f0", borderRadius: 20, padding: "20px", border: "1px solid #f0c8a8" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fff0e6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📦</div>
                    <div>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "#2a2a2a" }}>Registers</div>
                      <div style={{ fontSize: 11, color: "#c4784a", fontWeight: 800, fontFamily: "Nunito, sans-serif" }}>{d.registers.helped} of {d.totalMothersInNeed} moms supported</div>
                    </div>
                  </div>
                  <ChannelGrid percent={d.registers.percent} filledColor="#e8a87c" />
                  <div style={{ fontSize: 10, color: "#8a8a8a", fontFamily: "Nunito, sans-serif", marginTop: 4, marginBottom: 6 }}>Each square represents 2% of moms in need this month.</div>
                  <div style={{ fontSize: 12, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5, marginTop: 2 }}>Because of you, everyday needs are met with dignity and care.</div>
                </div>

                <div style={{ background: "#f0faf5", borderRadius: 20, padding: "20px", border: "1px solid #a8d4bf" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#e0f4ec", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🛍️</div>
                    <div>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "#2a2a2a" }}>Discover</div>
                      <div style={{ fontSize: 11, color: "#3d7a32", fontWeight: 800, fontFamily: "Nunito, sans-serif" }}>{d.discover.helped} of {d.totalMothersInNeed} moms supported</div>
                    </div>
                  </div>
                  <ChannelGrid percent={d.discover.percent} filledColor="#8db580" />
                  <div style={{ fontSize: 10, color: "#8a8a8a", fontFamily: "Nunito, sans-serif", marginTop: 4, marginBottom: 6 }}>Each square represents 2% of moms in need this month.</div>
                  <div style={{ fontSize: 12, color: "#5a5a5a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5, marginTop: 2 }}>Because of you, items are shared, reused and loved by another mom.</div>
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
