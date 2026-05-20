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

interface StatTile {
  value:        number;
  label:        string;
  channel:      string;
  channelColor: string;
}

interface NarrativeLine {
  text:    string;
  channel: "discover" | "register";
}

interface VariantConfig {
  bg1:              string;
  bg2:              string;
  accent:           string;
  channelPill:      string;
  channelPillBg:    string;
  channelPillColor: string;
  narrative:        string | null;
  narrativeLines:   NarrativeLine[] | null;
  stats:            (s: ImpactStats) => StatTile[];
  channelExplainer: string | null;
}

const DISC_COLOR = "#7ec8a4";
const REG_COLOR  = "#c4b5fd";

const VARIANTS: Record<ImpactVariant, VariantConfig> = {
  discover: {
    bg1: "#0d3d2e", bg2: "#1a5c45",
    accent: DISC_COLOR,
    channelPill:      "Through Discover",
    channelPillBg:    "rgba(126,200,164,0.18)",
    channelPillColor: DISC_COLOR,
    narrative:        "Shared baby & maternity essentials directly\nwith mothers through Discover.",
    narrativeLines:   null,
    stats: (s) => [
      { value: s.mothersSupported, label: "Mothers supported", channel: "Discover", channelColor: DISC_COLOR },
      { value: s.itemsShared,      label: "Essentials shared", channel: "Discover", channelColor: DISC_COLOR },
    ],
    channelExplainer: "Discover · neighbours pass on gently-used essentials",
  },

  register: {
    bg1: "#2d1b69", bg2: "#4c2f9e",
    accent: REG_COLOR,
    channelPill:      "Through Register",
    channelPillBg:    "rgba(196,181,253,0.18)",
    channelPillColor: REG_COLOR,
    narrative:        "Helped fulfill mothers' care requests\nthrough Register.",
    narrativeLines:   null,
    stats: (s) => [
      { value: s.requestsFulfilled, label: "Requests fulfilled", channel: "Register", channelColor: REG_COLOR },
      { value: s.familiesSupported, label: "Families supported", channel: "Register", channelColor: REG_COLOR },
    ],
    channelExplainer: "Register · mothers list what they need; donors commit to fulfill it",
  },

  combined: {
    bg1: "#0d3d2e", bg2: "#2d1b69",
    accent: "#a5f3d5",
    channelPill:      "Through Discover & Register",
    channelPillBg:    "rgba(165,243,213,0.13)",
    channelPillColor: "#a5f3d5",
    narrative:        null,
    narrativeLines: [
      { text: "Shared essentials through Discover",          channel: "discover" },
      { text: "Helped fulfill care requests through Register", channel: "register" },
    ],
    stats: (s) => [
      { value: s.mothersSupported,  label: "Mothers supported", channel: "Discover", channelColor: DISC_COLOR },
      { value: s.itemsShared,       label: "Essentials shared", channel: "Discover", channelColor: DISC_COLOR },
      { value: s.requestsFulfilled, label: "Requests fulfilled", channel: "Register", channelColor: REG_COLOR  },
    ],
    channelExplainer: null,
  },

  none: {
    bg1: "#1a1a1a", bg2: "#2e2e2e",
    accent: "#888",
    channelPill:      "Kradäl Care",
    channelPillBg:    "rgba(136,136,136,0.18)",
    channelPillColor: "#888",
    narrative:        "Starting my care journey.",
    narrativeLines:   null,
    stats:            () => [],
    channelExplainer: null,
  },
};

interface Props {
  variant: ImpactVariant;
  stats:   ImpactStats;
  name:    string;
  city:    string | null;
  month:   string;
}

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
        padding: "20px 20px 16px",
        boxSizing: "border-box",
      }}
    >
      {/* subtle bg circles */}
      <div style={{ position: "absolute", top: -50, right: -50, width: 210, height: 210, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -35, left: -35, width: 150, height: 150, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />

      {/* ── top row: wordmark + channel pill ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, position: "relative", zIndex: 1 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "white", fontFamily: "Lora, serif", letterSpacing: "-0.2px", lineHeight: 1 }}>
            Kradäl
          </div>
          <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginTop: 2, fontStyle: "italic", fontFamily: "Lora, serif" }}>
            Impact Story
          </div>
        </div>
        <div style={{
          background: cfg.channelPillBg,
          border: `1px solid ${cfg.channelPillColor}55`,
          borderRadius: 20, padding: "4px 10px",
          fontSize: 9, fontWeight: 800, color: cfg.channelPillColor,
          letterSpacing: "0.3px", whiteSpace: "nowrap",
        }}>
          {cfg.channelPill}
        </div>
      </div>

      {/* ── narrative ── */}
      <div style={{ position: "relative", zIndex: 1, marginBottom: 14 }}>
        {cfg.narrativeLines ? (
          // Combined: two attributed lines
          cfg.narrativeLines.map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 7 }}>
              <div style={{
                width: 3, height: 3, borderRadius: "50%",
                background: line.channel === "discover" ? DISC_COLOR : REG_COLOR,
                flexShrink: 0, marginTop: 6,
              }} />
              <div style={{ fontSize: 12, fontFamily: "Lora, serif", fontWeight: 600, color: "white", lineHeight: 1.45 }}>
                {line.text}
              </div>
            </div>
          ))
        ) : (
          // Single block narrative
          <div style={{ fontSize: 13, fontFamily: "Lora, serif", fontWeight: 600, color: "white", lineHeight: 1.5, whiteSpace: "pre-line" }}>
            {cfg.narrative}
          </div>
        )}
      </div>

      {/* ── metrics ── */}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
        {tiles.length > 0 && (
          <>
            <div style={{ fontSize: 8, fontWeight: 800, color: "rgba(255,255,255,0.4)", letterSpacing: "1.3px", textTransform: "uppercase", marginBottom: 7 }}>
              Your impact so far
            </div>
            <div style={{ display: "flex", gap: 7 }}>
              {tiles.map(({ value, label, channel, channelColor }) => (
                <div key={label} style={{
                  flex: 1, background: "rgba(255,255,255,0.1)",
                  borderRadius: 12, padding: "9px 6px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "white", lineHeight: 1, fontFamily: "Nunito, sans-serif" }}>
                    {value}
                  </div>
                  <div style={{ fontSize: 8, color: "rgba(255,255,255,0.8)", fontWeight: 700, marginTop: 4, lineHeight: 1.3 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 7, color: channelColor, fontWeight: 800, marginTop: 2, opacity: 0.85 }}>
                    · {channel}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── footer ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 10, marginTop: 12, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "white" }}>{first}</div>
          <div style={{ fontSize: 9, color: cfg.accent, fontWeight: 600 }}>
            {city ? `${city} · ` : ""}{month}
          </div>
        </div>
        {cfg.channelExplainer && (
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", lineHeight: 1.5, marginTop: 4 }}>
            {cfg.channelExplainer}
          </div>
        )}
      </div>
    </div>
  );
});

export default ImpactCard;
