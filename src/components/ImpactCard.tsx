"use client";

import { forwardRef } from "react";

export type ImpactVariant = "discover" | "register" | "combined" | "none";

export interface ImpactStats {
  mothersSupported:    number;
  itemsShared:         number;
  requestsFulfilled:   number;
  familiesSupported:   number;
  essentialsDelivered: number;
}

interface Props {
  variant: ImpactVariant;
  stats:   ImpactStats;
  name:    string;
  city:    string | null;
  month:   string;
}

// ── Per-variant config ───────────────────────────────────────────────────────

const VARIANTS = {
  discover: {
    bg1: "#0d3d2e",
    bg2: "#1a5c45",
    accent: "#7ec8a4",
    icon: "📦",
    headline: "Sharing essentials\nwith moms who need them",
    stats: (s: ImpactStats) => [
      { value: s.mothersSupported,  label: "moms supported"    },
      { value: s.itemsShared,       label: "essentials shared"  },
    ],
  },
  register: {
    bg1: "#2d1b69",
    bg2: "#4c2f9e",
    accent: "#c4b5fd",
    icon: "💜",
    headline: "Fulfilling real\ncare requests",
    stats: (s: ImpactStats) => [
      { value: s.requestsFulfilled,  label: "requests fulfilled" },
      { value: s.familiesSupported,  label: "families supported" },
    ],
  },
  combined: {
    bg1: "#0d3d2e",
    bg2: "#2d1b69",
    accent: "#a5f3d5",
    icon: "🌿",
    headline: "Caring across\nevery channel",
    stats: (s: ImpactStats) => [
      { value: s.mothersSupported,    label: "moms supported"       },
      { value: s.itemsShared,         label: "essentials shared"     },
      { value: s.essentialsDelivered, label: "register deliveries"   },
    ],
  },
  none: {
    bg1: "#1a1a1a",
    bg2: "#333333",
    accent: "#999",
    icon: "🌱",
    headline: "Starting my\ncare journey",
    stats: () => [],
  },
};

const ImpactCard = forwardRef<HTMLDivElement, Props>(function ImpactCard(
  { variant, stats, name, city, month },
  ref,
) {
  const cfg   = VARIANTS[variant];
  const tiles = cfg.stats(stats);
  const first = name.split(" ")[0];

  return (
    <div
      ref={ref}
      style={{
        width: 340, height: 340, flexShrink: 0,
        background: `linear-gradient(145deg, ${cfg.bg1} 0%, ${cfg.bg2} 100%)`,
        borderRadius: 24, position: "relative", overflow: "hidden",
        fontFamily: "Nunito, sans-serif",
        display: "flex", flexDirection: "column",
        padding: "22px 22px 18px",
      }}
    >
      {/* decorative circle */}
      <div style={{
        position: "absolute", top: -40, right: -40,
        width: 200, height: 200, borderRadius: "50%",
        background: "rgba(255,255,255,0.05)", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: -30, left: -30,
        width: 140, height: 140, borderRadius: "50%",
        background: "rgba(255,255,255,0.04)", pointerEvents: "none",
      }} />

      {/* ── top row: icon + branding ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: "rgba(255,255,255,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22,
        }}>
          {cfg.icon}
        </div>
        <div style={{
          background: "rgba(255,255,255,0.1)",
          borderRadius: 20, padding: "4px 10px",
          fontSize: 11, fontWeight: 800, color: cfg.accent, letterSpacing: "0.5px",
        }}>
          Kradel Care
        </div>
      </div>

      {/* ── headline ── */}
      <div style={{
        fontFamily: "Lora, serif",
        fontSize: 20, fontWeight: 700, color: "white",
        lineHeight: 1.35, marginBottom: 18,
        whiteSpace: "pre-line",
      }}>
        {cfg.headline}
      </div>

      {/* ── stat tiles ── */}
      {tiles.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: "auto" }}>
          {tiles.map(({ value, label }) => (
            <div key={label} style={{
              flex: 1, background: "rgba(255,255,255,0.1)",
              borderRadius: 14, padding: "10px 8px", textAlign: "center",
            }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "white", lineHeight: 1, fontFamily: "Nunito, sans-serif" }}>
                {value}
              </div>
              <div style={{ fontSize: 10, color: cfg.accent, fontWeight: 700, marginTop: 4, lineHeight: 1.3 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      )}
      {tiles.length === 0 && <div style={{ flex: 1 }} />}

      {/* ── footer ── */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.12)",
        paddingTop: 12, marginTop: 14,
        display: "flex", justifyContent: "space-between", alignItems: "flex-end",
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "white" }}>{first}</div>
          <div style={{ fontSize: 10, color: cfg.accent, marginTop: 1 }}>
            {city ? `${city} · ` : ""}{month}
          </div>
        </div>
        <div style={{
          fontSize: 11, fontStyle: "italic",
          fontFamily: "Lora, serif", color: "rgba(255,255,255,0.5)",
        }}>
          Care moves everything.
        </div>
      </div>
    </div>
  );
});

export default ImpactCard;
