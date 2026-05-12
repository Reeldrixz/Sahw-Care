"use client";

import { useEffect, useState } from "react";

interface TrustLog {
  id: string;
  eventType: string;
  pointsDelta: number;
  newScore: number;
  createdAt: string;
}

interface TrustData {
  trustScore: number;
  rbwDaysLeft: number | null;
  streakCurrentDays: number;
  dailyPointsEarned: number;
  dailyPointsCap: number;
  graceRequestsUsed: number;
  recentEvents: TrustLog[];
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

function eventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    PHONE_VERIFIED:        "Phone verified",
    EMAIL_VERIFIED:        "Email verified",
    DOC_VERIFIED:          "Document verified",
    ADDRESS_CONFIRMED:     "Address confirmed",
    IDENTITY_CONFIRMED:    "Identity confirmed",
    TRUSTED_ORG_VERIFIED:  "Organisation verified",
    PROFILE_COMPLETED:     "Profile completed",
    CIRCLE_JOIN:           "Joined a circle",
    HELPFUL_POST:          "Helpful post",
    CIRCLE_POST:           "Circle post",
    CIRCLE_REPLY:          "Replied in circle",
    WEEKLY_ACTIVE:         "Weekly active",
    RESOURCE_READ:         "Resource read",
    ADMIN_RESPONSE:        "Admin response",
    STREAK_7_DAY:          "7-day streak",
    STREAK_30_DAY:         "30-day streak",
    STREAK_MONTHLY_ACTIVE: "Monthly active",
    AGE_1_WEEK:            "1-week account milestone",
    AGE_1_MONTH:           "1-month account milestone",
    AGE_3_MONTHS:          "3-month account milestone",
    AGE_6_MONTHS:          "6-month account milestone",
    AGE_1_YEAR:            "1-year account milestone",
    SUPPORT_RECEIVED:      "Support received",
    DELIVERY_CONFIRMED:    "Delivery confirmed",
    POSITIVE_INTERACTION:  "Positive interaction",
    NO_SHOW_AVOIDED:       "No-show avoided",
    SUCCESSFUL_CYCLE:      "Successful cycle",
    TIMELY_COMMUNICATION:  "Timely communication",
    TOXIC_BEHAVIOR:        "Post flagged",
    ABUSE_CONFIRMED:       "Abuse confirmed",
    HARASSMENT_CONFIRMED:  "Harassment confirmed",
    NO_SHOW:               "No-show",
    REPEATED_CANCELLATIONS: "Repeated cancellations",
  };
  return labels[eventType] ?? eventType.replace(/_/g, " ").toLowerCase();
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

  const nextMilestone = score < 25 ? 25 : score < 85 ? 85 : null;
  const nextMilestoneLabel = nextMilestone === 25 ? "Verified access" : nextMilestone === 85 ? "Priority access" : null;
  const pointsToNext = nextMilestone ? nextMilestone - score : 0;

  const statusLabel =
    score >= 85 ? "Priority access unlocked" :
    score >= 25 ? "Verified member" :
    "New member";

  return (
    <div style={{ background: "var(--white)", borderRadius: 16, padding: "18px 16px", marginBottom: 16, boxShadow: "var(--shadow)", border: "1px solid var(--border)" }}>
      {/* Score number + label */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: "Lora, serif", fontSize: 36, fontWeight: 700, color: "#1a7a5e", lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 13, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>/ 100</span>
      </div>
      <div style={{ fontSize: 12, color: score >= 25 ? "#1a7a5e" : "var(--mid)", fontFamily: "Nunito, sans-serif", fontWeight: 700, marginBottom: 14 }}>
        {statusLabel}
      </div>

      {/* RBW restriction warning */}
      {data?.rbwDaysLeft !== null && data?.rbwDaysLeft !== undefined && data.rbwDaysLeft > 0 && (
        <div style={{ background: "#fef2f2", border: "1.5px solid #ef4444", borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: 12, color: "#7f1d1d", fontFamily: "Nunito, sans-serif" }}>
          Bundle access restricted for {data.rbwDaysLeft} more day{data.rbwDaysLeft !== 1 ? "s" : ""} due to recent activity patterns.
        </div>
      )}

      {/* Daily cap progress */}
      {data && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>
            <span>Daily points earned</span>
            <span style={{ fontWeight: 700 }}>{data.dailyPointsEarned} / {data.dailyPointsCap}</span>
          </div>
          <div style={{ background: "#e8f5f1", borderRadius: 6, height: 6 }}>
            <div style={{ width: `${Math.min(100, (data.dailyPointsEarned / data.dailyPointsCap) * 100)}%`, height: "100%", background: "#1a7a5e", borderRadius: 6, transition: "width 0.4s ease" }} />
          </div>
        </div>
      )}

      {/* Streak */}
      {data && data.streakCurrentDays > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, fontSize: 12, fontFamily: "Nunito, sans-serif", color: "var(--ink)" }}>
          <span style={{ fontSize: 16 }}>🔥</span>
          <span><strong>{data.streakCurrentDays}</strong>-day streak</span>
        </div>
      )}

      {/* Progress bar with milestones */}
      <div style={{ position: "relative", marginBottom: 6 }}>
        <div style={{ background: "#e8f5f1", borderRadius: 8, height: 10, position: "relative", overflow: "visible" }}>
          <div style={{ width: `${score}%`, height: "100%", background: "#1a7a5e", borderRadius: 8, transition: "width 0.6s ease" }} />
          {[25, 85].map(m => (
            <div key={m} style={{
              position: "absolute", top: -4, left: `${m}%`,
              transform: "translateX(-50%)",
              width: 3, height: 18, background: score >= m ? "#1a7a5e" : "#b0c8be",
              borderRadius: 2,
            }} />
          ))}
        </div>
        <div style={{ position: "relative", height: 18, marginTop: 4 }}>
          {[{ v: 25, label: "Verified" }, { v: 85, label: "Priority" }].map(({ v, label }) => (
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
          { threshold: 0,  label: "Browse",    unlocked: true },
          { threshold: 25, label: "Verified",  unlocked: score >= 25 },
          { threshold: 85, label: "Priority",  unlocked: score >= 85 },
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
              <span style={{ fontWeight: 800, minWidth: 36, textAlign: "right", color: ev.pointsDelta > 0 ? "#1a7a5e" : "var(--terra)" }}>
                {ev.pointsDelta > 0 ? `+${ev.pointsDelta}` : ev.pointsDelta}
              </span>
              <span style={{ flex: 1, color: "var(--ink)" }}>{eventLabel(ev.eventType)}</span>
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
