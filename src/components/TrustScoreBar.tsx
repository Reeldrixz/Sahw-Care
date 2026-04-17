"use client";

import { useEffect, useState } from "react";

interface TrustEvent {
  id: string;
  eventType: string;
  pointsDelta: number;
  reason: string;
  createdAt: string;
}

interface TrustData {
  trustScore: number;
  trustFrozen: boolean;
  trustFrozenUntil: string | null;
  recentEvents: TrustEvent[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function TrustScoreBar({ currentScore }: { currentScore: number }) {
  const [data, setData] = useState<TrustData | null>(null);

  useEffect(() => {
    fetch("/api/user/trust")
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {});
  }, [currentScore]);

  const score = data?.trustScore ?? currentScore;

  // Milestone logic
  const nextMilestone = score < 60 ? 60 : score < 85 ? 85 : null;
  const nextMilestoneLabel = nextMilestone === 60 ? "Marketplace" : nextMilestone === 85 ? "Care Bundles" : null;
  const pointsToNext = nextMilestone ? nextMilestone - score : 0;

  return (
    <div style={{ background: "var(--white)", borderRadius: 16, padding: "18px 16px", marginBottom: 16, boxShadow: "var(--shadow)", border: "1px solid var(--border)" }}>
      {/* Score number + label */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
        <span style={{ fontFamily: "Lora, serif", fontSize: 36, fontWeight: 700, color: "#1a7a5e", lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 13, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>/ 100 trust score</span>
      </div>

      {/* Freeze warning */}
      {data?.trustFrozen && data.trustFrozenUntil && (
        <div style={{ background: "#fff8e6", border: "1.5px solid #f0b429", borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: 12, color: "#7a5500", fontFamily: "Nunito, sans-serif" }}>
          Point earning paused until {new Date(data.trustFrozenUntil).toLocaleString()} due to unusual activity.
        </div>
      )}

      {/* Progress bar with milestones */}
      <div style={{ position: "relative", marginBottom: 6 }}>
        {/* Track */}
        <div style={{ background: "#e8f5f1", borderRadius: 8, height: 10, position: "relative", overflow: "visible" }}>
          {/* Fill */}
          <div style={{ width: `${score}%`, height: "100%", background: "#1a7a5e", borderRadius: 8, transition: "width 0.6s ease" }} />
          {/* Milestone markers */}
          {[60, 85].map(m => (
            <div key={m} style={{
              position: "absolute", top: -4, left: `${m}%`,
              transform: "translateX(-50%)",
              width: 3, height: 18, background: score >= m ? "#1a7a5e" : "#b0c8be",
              borderRadius: 2,
            }} />
          ))}
        </div>
        {/* Milestone labels */}
        <div style={{ position: "relative", height: 18, marginTop: 4 }}>
          {[{ v: 60, label: "Marketplace" }, { v: 85, label: "Bundles" }].map(({ v, label }) => (
            <div key={v} style={{
              position: "absolute", left: `${v}%`, transform: "translateX(-50%)",
              fontSize: 9, fontWeight: 800, fontFamily: "Nunito, sans-serif",
              color: score >= v ? "#1a7a5e" : "var(--mid)",
              whiteSpace: "nowrap",
            }}>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Unlocks */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { threshold: 0,  label: "Browse",      unlocked: true },
          { threshold: 60, label: "Marketplace", unlocked: score >= 60 },
          { threshold: 85, label: "Bundles",      unlocked: score >= 85 },
        ].map(({ label, unlocked }) => (
          <span key={label} style={{
            fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
            fontFamily: "Nunito, sans-serif",
            background: unlocked ? "#e8f5f1" : "var(--bg)",
            color: unlocked ? "#1a7a5e" : "var(--mid)",
            border: `1.5px solid ${unlocked ? "#1a7a5e" : "var(--border)"}`,
          }}>
            {unlocked ? "✓" : "○"} {label}
          </span>
        ))}
      </div>

      {/* Next unlock message */}
      {nextMilestoneLabel && (
        <div style={{ fontSize: 12, color: "var(--mid)", marginBottom: 14, fontFamily: "Nunito, sans-serif" }}>
          <strong style={{ color: "var(--ink)" }}>{pointsToNext} more points</strong> to unlock {nextMilestoneLabel}
        </div>
      )}

      {/* Recent events feed */}
      {data?.recentEvents && data.recentEvents.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "var(--mid)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "Nunito, sans-serif" }}>
            Recent activity
          </div>
          {data.recentEvents.slice(0, 5).map(ev => (
            <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12, fontFamily: "Nunito, sans-serif" }}>
              <span style={{
                fontWeight: 800, minWidth: 36, textAlign: "right",
                color: ev.pointsDelta > 0 ? "#1a7a5e" : "var(--terra)",
              }}>
                {ev.pointsDelta > 0 ? `+${ev.pointsDelta}` : ev.pointsDelta}
              </span>
              <span style={{ flex: 1, color: "var(--ink)" }}>{ev.reason}</span>
              <span style={{ color: "var(--light)", flexShrink: 0 }}>{timeAgo(ev.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      {(!data?.recentEvents || data.recentEvents.length === 0) && (
        <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
          Start verifying your account and participating in Circles to earn trust points.
        </div>
      )}
    </div>
  );
}
