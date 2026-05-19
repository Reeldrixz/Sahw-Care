"use client";

import { X, Calendar, ArrowRight } from "lucide-react";
import { STAGE_META, STAGE_BULLETS, StageKey } from "@/lib/stage";

interface TransitionStatus {
  currentStageKey:  string;
  currentStageName: string;
  currentStageDesc: string;
  nextStageKey:     string;
  nextStageName:    string;
  nextStageDesc:    string;
  daysUntil:        number;
  transitionDate:   string;
}

interface Props {
  status:    TransitionStatus;
  circleId:  string;
  onDismiss: () => void;
}

const STAGE_ICONS: Record<string, string> = {
  "pregnancy-0-3":    "🌱",
  "pregnancy-4-6":    "🌿",
  "pregnancy-7-9":    "🌸",
  "postpartum-0-3":   "💛",
  "postpartum-4-6":   "🌙",
  "postpartum-7-12":  "🌍",
  "postpartum-13-24": "👣",
};

export default function StageTransitionModal({ status, circleId, onDismiss }: Props) {
  const {
    currentStageKey, currentStageName, currentStageDesc,
    nextStageKey, nextStageName, nextStageDesc,
    daysUntil, transitionDate,
  } = status;

  const bullets = STAGE_BULLETS[nextStageKey as StageKey] ?? [
    "A new chapter begins",
    "New topics and support",
    "Mothers at the same stage",
  ];

  const dateLabel = new Date(transitionDate).toLocaleDateString("en", {
    month: "long", day: "numeric", year: "numeric",
  });

  const handleDismiss = async () => {
    try {
      await fetch("/api/user/transition-status", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ circleId }),
      });
    } catch { /* ignore */ }
    onDismiss();
  };

  return (
    <div
      onClick={handleDismiss}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: "24px 24px 0 0",
          width: "100%", maxWidth: 520,
          maxHeight: "92vh", overflowY: "auto",
          padding: "24px 20px 48px",
        }}
      >
        {/* Dismiss X */}
        <button
          onClick={handleDismiss}
          style={{
            position: "absolute", top: 16, right: 16,
            background: "var(--bg)", border: "none", borderRadius: "50%",
            width: 32, height: 32, display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer",
          }}
        >
          <X size={16} color="var(--mid)" />
        </button>

        {/* Header icon */}
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: "#e8f5f1",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 14px",
          }}>
            <Calendar size={26} strokeWidth={1.75} color="#1a7a5e" />
          </div>
          <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: "#1a7a5e", lineHeight: 1.3, marginBottom: 6 }}>
            A new stage is coming soon!
          </div>
          <div style={{ fontSize: 14, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
            In <strong>{daysUntil} {daysUntil === 1 ? "day" : "days"}</strong>, you&apos;ll be transitioning to a new Circle stage.
          </div>
        </div>

        {/* Stage transition cards */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          {/* Current stage */}
          <div style={{
            flex: 1, background: "#f5f5f0", borderRadius: 14,
            padding: "14px 12px", textAlign: "center",
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{STAGE_ICONS[currentStageKey] ?? "🌱"}</div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 800, color: "#555", marginBottom: 4 }}>
              {currentStageName}
            </div>
            <div style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.4 }}>{currentStageDesc}</div>
          </div>

          <ArrowRight size={20} color="#9ca3af" style={{ flexShrink: 0 }} />

          {/* Next stage */}
          <div style={{
            flex: 1, background: "#e8f5f1", borderRadius: 14,
            padding: "14px 12px", textAlign: "center",
            border: "1.5px solid #b7dfd1",
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{STAGE_ICONS[nextStageKey] ?? "✨"}</div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 800, color: "#1a7a5e", marginBottom: 4 }}>
              {nextStageName}
            </div>
            <div style={{ fontSize: 10, color: "#1a7a5e", opacity: 0.7, lineHeight: 1.4 }}>{nextStageDesc}</div>
          </div>
        </div>

        {/* Day pill */}
        <div style={{
          background: "#e8f5f1", borderRadius: 20, padding: "7px 14px",
          textAlign: "center", marginBottom: 20, display: "inline-block", width: "100%",
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1a7a5e", fontFamily: "Nunito, sans-serif" }}>
            📅 {daysUntil} {daysUntil === 1 ? "day" : "days"} until the transition
          </span>
          <span style={{ fontSize: 11, color: "#1a7a5e", opacity: 0.7, marginLeft: 6 }}>({dateLabel})</span>
        </div>

        {/* What this stage means */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", color: "var(--ink)", marginBottom: 10 }}>
            ✨ What this stage means
          </div>
          {bullets.map((b) => (
            <div key={b} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
              <span style={{ color: "#1a7a5e", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>→</span>
              <span style={{ fontSize: 13, color: "var(--ink)", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>{b}</span>
            </div>
          ))}
        </div>

        {/* Soft callout */}
        <div style={{
          background: "#faf8f3", borderRadius: 12, padding: "14px 16px",
          fontSize: 13, fontFamily: "Lora, serif", fontStyle: "italic",
          color: "#555", lineHeight: 1.7, marginBottom: 24, textAlign: "center",
        }}>
          You&apos;ll be able to introduce yourself to your new Circle on the day of your transition. You&apos;re never alone in this journey. ♡
        </div>

        {/* Got it button */}
        <button
          onClick={handleDismiss}
          style={{
            width: "100%", padding: "15px", background: "#1a7a5e", color: "white",
            border: "none", borderRadius: 16, fontSize: 15, fontWeight: 800,
            fontFamily: "Nunito, sans-serif", cursor: "pointer", letterSpacing: "0.01em",
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
