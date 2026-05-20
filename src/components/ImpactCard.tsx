"use client";

import { forwardRef } from "react";
import { Leaf } from "lucide-react";

export type ImpactVariant = "discover" | "register" | "combined" | "none";

export interface ImpactStats {
  mothersSupported: number; // COUNT DISTINCT listing_completed recipients
  needsMet:         number; // SUM itemCount register_fulfilled
  discoverItems:    number; // SUM itemCount listing_completed
  essentialsShared: number; // discoverItems + needsMet
}

interface StatTile {
  icon:         string;
  value:        number;
  label:        string;
  subtext:      string;
  subtextColor: string;
}

interface VariantConfig {
  channelPill:  string;
  channelIcon:  string;
  hero:         string;
  narrative1:   string;
  narrative2:   string;
  stats:        (s: ImpactStats) => StatTile[];
}

// ── Colours ───────────────────────────────────────────────────────────────────
const GREEN       = "#1a4a3a";
const CREAM       = "#faf7f0";
const GREEN_LIGHT = "#e0f2e8";
const GREEN_MID   = "#b8d4c4";
const GREEN_TEXT  = "#3d5c4e";
const GREEN_MUTED = "#6b8c7a";
const DISC_COLOR  = "#7ec8a4";
const REG_COLOR   = "#c4b5fd";
const NEUTRAL_SUB = "rgba(250,247,240,0.55)";

const VARIANTS: Record<ImpactVariant, VariantConfig> = {
  discover: {
    channelPill: "Through Discover",
    channelIcon: "🛍️",
    hero:        "You shared care,\nhand to hand 💛",
    narrative1:  "You shared baby & maternity essentials directly with mothers who needed them.",
    narrative2:  "Your care helps mothers feel supported and seen.",
    stats: (s) => [
      { icon: "👥", value: s.mothersSupported, label: "Mothers supported", subtext: "via peer-to-peer donation",       subtextColor: DISC_COLOR   },
      { icon: "🎁", value: s.discoverItems,    label: "Essentials shared",  subtext: "in total",                        subtextColor: NEUTRAL_SUB  },
    ],
  },

  register: {
    channelPill: "Through Register",
    channelIcon: "📋",
    hero:        "You answered what\nmothers needed 💛",
    narrative1:  "You helped deliver the specific essentials mothers asked for.",
    narrative2:  "Your care helps mothers prepare with dignity.",
    stats: (s) => [
      { icon: "🤝", value: s.needsMet,          label: "Needs met",         subtext: "for mothers and their newborns", subtextColor: REG_COLOR    },
      { icon: "🎁", value: s.essentialsShared,  label: "Essentials shared",  subtext: "in total",                       subtextColor: NEUTRAL_SUB  },
    ],
  },

  combined: {
    channelPill: "Through Discover & Register",
    channelIcon: "✨",
    hero:        "You've made a bigger\nimpact together 💛",
    narrative1:  "You shared baby & maternity essentials and helped deliver care to mothers who need support.",
    narrative2:  "Your care helps mothers prepare, feel supported, and thrive.",
    stats: (s) => [
      { icon: "👥", value: s.mothersSupported, label: "Mothers supported", subtext: "via peer-to-peer donation",       subtextColor: DISC_COLOR   },
      { icon: "🎁", value: s.essentialsShared, label: "Essentials shared",  subtext: "in total",                        subtextColor: NEUTRAL_SUB  },
      { icon: "🤝", value: s.needsMet,          label: "Needs met",          subtext: "for mothers and their newborns", subtextColor: REG_COLOR    },
    ],
  },

  none: {
    channelPill: "Kradəl Care",
    channelIcon: "🌱",
    hero:        "Starting your\ncare journey 💛",
    narrative1:  "Complete your first Discover listing or Register commitment to build your impact story.",
    narrative2:  "Every action makes a difference.",
    stats: () => [],
  },
};

interface Props {
  variant:  ImpactVariant;
  stats:    ImpactStats;
  name:     string;
  location: string | null;
  month:    string;
}

const ImpactCard = forwardRef<HTMLDivElement, Props>(function ImpactCard(
  { variant, stats, name, location, month },
  ref,
) {
  const cfg   = VARIANTS[variant];
  const tiles = cfg.stats(stats);
  const first = name.split(" ")[0];

  return (
    <div
      ref={ref}
      style={{
        width: 360, height: 450,
        border: `2px solid ${GREEN}`, borderRadius: 20,
        overflow: "hidden", background: CREAM,
        display: "flex", flexDirection: "column",
        fontFamily: "Nunito, sans-serif",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {/* ══ CREAM TOP ZONE ══════════════════════════════════════════════════ */}
      <div style={{ flex: 1, padding: "16px 18px 10px", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* Heart motif — large pale bg accent */}
        <div style={{
          position: "absolute", right: -8, top: "38%", transform: "translateY(-50%)",
          fontSize: 140, color: GREEN, opacity: 0.05,
          pointerEvents: "none", userSelect: "none", lineHeight: 1,
        }}>♥</div>

        {/* Leaf sprigs */}
        <div style={{ position: "absolute", top: 10, right: 12, opacity: 0.18, transform: "rotate(25deg)", pointerEvents: "none" }}>
          <Leaf size={15} color={GREEN} />
        </div>
        <div style={{ position: "absolute", bottom: 18, right: 22, opacity: 0.13, transform: "rotate(-18deg)", pointerEvents: "none" }}>
          <Leaf size={11} color={GREEN} />
        </div>
        <div style={{ position: "absolute", bottom: 24, left: 14, opacity: 0.1, transform: "rotate(10deg)", pointerEvents: "none" }}>
          <Leaf size={10} color={GREEN} />
        </div>

        {/* Header row: wordmark + "every act" pill */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, position: "relative", zIndex: 1 }}>
          <div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, color: GREEN, lineHeight: 1 }}>Kradəl</div>
            <div style={{ fontSize: 9, color: GREEN_MUTED, fontWeight: 600, marginTop: 2 }}>Impact Story</div>
          </div>
          <div style={{
            border: `1.5px solid ${GREEN_MID}`, borderRadius: 20,
            padding: "3px 9px", fontSize: 9, fontWeight: 700,
            color: GREEN, background: GREEN_LIGHT,
            flexShrink: 0, maxWidth: 170, textAlign: "right",
          }}>
            ♡ Every act of care matters
          </div>
        </div>

        {/* Channel pill */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          background: GREEN_LIGHT, border: `1px solid ${GREEN_MID}`,
          borderRadius: 20, padding: "4px 11px",
          fontSize: 10, fontWeight: 800, color: GREEN,
          marginBottom: 10, alignSelf: "flex-start", position: "relative", zIndex: 1,
        }}>
          <span style={{ fontSize: 11 }}>{cfg.channelIcon}</span>
          {cfg.channelPill}
        </div>

        {/* Hero line */}
        <div style={{
          fontFamily: "Lora, serif", fontSize: 19, fontWeight: 700, color: GREEN,
          lineHeight: 1.3, marginBottom: 11, whiteSpace: "pre-line",
          position: "relative", zIndex: 1,
        }}>
          {cfg.hero}
        </div>

        {/* Narrative lines with rule */}
        <div style={{ position: "relative", zIndex: 1, marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 5 }}>
            <Leaf size={10} color={GREEN} style={{ marginTop: 3, flexShrink: 0, opacity: 0.7 }} />
            <div style={{ fontSize: 11, color: GREEN_TEXT, lineHeight: 1.5 }}>{cfg.narrative1}</div>
          </div>
          <div style={{ borderTop: `1px solid ${GREEN_MID}`, margin: "5px 0 5px 16px" }} />
          <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <Leaf size={10} color={GREEN} style={{ marginTop: 3, flexShrink: 0, opacity: 0.7 }} />
            <div style={{ fontSize: 11, color: GREEN_TEXT, lineHeight: 1.5 }}>{cfg.narrative2}</div>
          </div>
        </div>

        {/* Location / Date */}
        <div style={{ marginTop: "auto", fontSize: 10, color: GREEN_MUTED, position: "relative", zIndex: 1 }}>
          {location ? `📍 ${location} · ` : ""}📅 {month}
        </div>
      </div>

      {/* ══ WAVY DIVIDER ════════════════════════════════════════════════════ */}
      <svg
        viewBox="0 0 360 18"
        preserveAspectRatio="none"
        style={{ display: "block", width: "100%", flexShrink: 0, marginBottom: -1 }}
      >
        <path d="M0,18 C80,3 180,14 280,6 C320,2 360,10 360,5 L360,18 Z" fill={GREEN} />
      </svg>

      {/* ══ DARK STATS BAND ═════════════════════════════════════════════════ */}
      <div style={{ background: GREEN, padding: "6px 18px 14px", flexShrink: 0 }}>

        {/* Band header */}
        <div style={{
          textAlign: "center", fontSize: 10, fontWeight: 700,
          color: DISC_COLOR, marginBottom: 10, letterSpacing: "0.4px",
        }}>
          🌿 Your impact so far 🌿
        </div>

        {/* Stat tiles */}
        {tiles.length > 0 && (
          <div style={{ display: "flex", gap: tiles.length === 3 ? 8 : 20, justifyContent: "center", marginBottom: 10 }}>
            {tiles.map(({ icon, value, label, subtext, subtextColor }) => (
              <div key={label} style={{ textAlign: "center", flex: tiles.length === 3 ? 1 : undefined, minWidth: tiles.length === 3 ? 0 : 90 }}>
                {/* Circular icon tile */}
                <div style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: "rgba(250,247,240,0.13)",
                  border: "1px solid rgba(250,247,240,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, margin: "0 auto 5px",
                }}>
                  {icon}
                </div>
                {/* Serif number */}
                <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: "white", lineHeight: 1 }}>
                  {value}
                </div>
                {/* Label */}
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.8)", fontWeight: 700, marginTop: 3, lineHeight: 1.3 }}>
                  {label}
                </div>
                {/* Subtext */}
                <div style={{ fontSize: 7, color: subtextColor, fontWeight: 700, marginTop: 2, lineHeight: 1.3 }}>
                  {subtext}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Band footer */}
        <div style={{
          textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.14)",
          paddingTop: 8, fontSize: 9, color: "rgba(255,255,255,0.65)", fontWeight: 600,
        }}>
          💛 Thank you for being part of the circle of care.
        </div>
      </div>
    </div>
  );
});

export default ImpactCard;
