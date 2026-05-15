"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";

interface ActiveMission {
  name: string; teamId: string; totalBlocks: number; goalBlocks: number; isComplete: boolean;
}

interface ContributorData {
  hasActions: boolean;
  hasMembership: boolean;
  activeMission: ActiveMission | null;
  stats?: {
    clicks: number; signups: number; activity: number; outcomes: number; totalBlocks: number;
  };
  missionHistory?: Array<{
    id: string; missionName: string; month: string;
    teamBlocks: number; goalBlocks: number; myBlocks: number; isComplete: boolean; joinedAt: string;
  }>;
  recentActions?: Array<{
    id: string; actionType: string; blocks: number; humanLabel: string; createdAt: string;
  }>;
  highlightMoments?: Array<{
    id: string; actionType: string; blocks: number; humanLabel: string; createdAt: string;
  }>;
}

const C = {
  green:      "#1a7a5e",
  greenLight: "#e8f5f0",
  purple:     "#6d5acd",
  purplePale: "#f5f3ff",
  cream:      "#faf8f3",
  white:      "#ffffff",
  text:       "#2a2a2a",
  mid:        "#5a5a5a",
  muted:      "#8a8a8a",
  border:     "#ede8df",
  completed:  "#1a7a5e",
  activity:   "#a8d4bf",
  signup:     "#c8d8c8",
  click:      "#d4cfc8",
};

const COMPLETED_TYPES = ["donation","listing_completed","register_fulfilled","bundle_delivered"];

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Nunito:wght@400;600;700;800&display=swap');
  .cp-page *, .cp-page *::before, .cp-page *::after { box-sizing: border-box; }
  .cp-page {
    font-family: 'Nunito', sans-serif;
    background: #faf8f3;
    min-height: 100vh;
    color: #2a2a2a;
    padding: 0 0 100px;
  }
  .cp-inner { max-width: 860px; margin: 0 auto; padding: 20px 16px; }
  @media (min-width: 640px) { .cp-inner { padding: 24px 24px; } }

  .cp-card {
    background: white; border-radius: 24px; border: 1px solid #ede8df;
    padding: 24px; margin-bottom: 20px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.04);
  }
  .cp-section-label {
    font-family: 'Nunito', sans-serif; font-size: 11px; font-weight: 800;
    letter-spacing: 1.4px; text-transform: uppercase; color: #6d5acd; margin-bottom: 16px;
  }
  .cp-section-label-green { color: #1a7a5e; }

  .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  @media (min-width: 500px) { .stat-grid { grid-template-columns: repeat(4, 1fr); } }
  .stat-box {
    background: #faf8f3; border-radius: 16px; padding: 14px 12px; text-align: center;
    border: 1px solid #ede8df;
  }
  .stat-num { font-family: 'Lora', serif; font-size: 32px; font-weight: 700; color: #1a7a5e; line-height: 1; }
  .stat-label { font-size: 11px; color: #5a5a5a; margin-top: 5px; line-height: 1.4; }

  .mission-row {
    display: flex; align-items: center; gap: 12px; padding: 14px 0;
    border-bottom: 1px solid #ede8df;
  }
  .mission-row:last-child { border-bottom: none; }
  .mission-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

  .action-row {
    display: flex; align-items: flex-start; gap: 10px; padding: 10px 0;
    border-bottom: 1px solid #f5f0ea;
  }
  .action-row:last-child { border-bottom: none; }
  .action-swatch { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; margin-top: 4px; }

  .week-divider {
    font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;
    color: #8a8a8a; padding: 14px 0 6px; border-bottom: 1px solid #ede8df; margin-bottom: 4px;
  }

  .moment-card {
    background: #e8f5f0; border-radius: 18px; padding: 18px; margin-bottom: 12px;
    border: 1px solid #b7dfd1; display: flex; gap: 12px; align-items: flex-start;
  }
  .moment-icon {
    width: 40px; height: 40px; border-radius: 50%; background: #1a7a5e; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; font-size: 18px;
  }
`;

function actionSwatch(actionType: string): string {
  if (COMPLETED_TYPES.includes(actionType)) return C.completed;
  if (["listing","listing_posted","register_committed"].includes(actionType)) return C.activity;
  if (actionType === "signup") return C.signup;
  return C.click;
}

function relativeTime(date: string): string {
  const now  = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7)   return `${days} days ago`;
  if (days < 14)  return "Last week";
  return new Date(date).toLocaleDateString("en", { month: "short", day: "numeric" });
}

function weekLabel(date: string): string {
  const now  = Date.now();
  const diff = now - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1)   return "Today";
  if (days < 2)   return "Yesterday";
  if (days < 7)   return "This week";
  if (days < 14)  return "Last week";
  if (days < 30)  return "Earlier this month";
  return new Date(date).toLocaleDateString("en", { month: "long", year: "numeric" });
}

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString("en", { month: "long", year: "numeric" });
}

function MiniBar({ myBlocks, goalBlocks }: { myBlocks: number; goalBlocks: number }) {
  const pct = Math.min(100, Math.round((myBlocks / goalBlocks) * 100));
  return (
    <div style={{ height: 4, background: "#ede8df", borderRadius: 4, overflow: "hidden", marginTop: 4, width: "100%" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: C.green, borderRadius: 4 }} />
    </div>
  );
}

type ActionItem = NonNullable<ContributorData["recentActions"]>[number];

// Group actions by week for display — collapses <48h entries into a digest
function groupActions(actions: ActionItem[]) {
  const groups: Array<{ label: string; isDigest: boolean; actions: ActionItem[] }> = [];
  let currentLabel = "";
  let currentGroup: typeof actions = [];
  const now = Date.now();

  for (const action of actions) {
    const diff = now - new Date(action.createdAt).getTime();
    const label = weekLabel(action.createdAt);

    if (label !== currentLabel) {
      if (currentGroup.length) groups.push({ label: currentLabel, isDigest: false, actions: currentGroup });
      currentLabel = label;
      currentGroup = [];
    }

    // Collapse recent <48h into a digest row
    if (diff < 48 * 3600000 && label !== "Earlier this month") {
      currentGroup.push(action);
    } else {
      currentGroup.push(action);
    }
  }
  if (currentGroup.length) groups.push({ label: currentLabel, isDigest: false, actions: currentGroup });
  return groups;
}

export default function ContributorPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const [data,    setData]    = useState<ContributorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!user) { router.push("/auth"); return; }
    fetch("/api/profile/contributor")
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, router]);

  if (!user) return null;

  if (loading) return (
    <div className="cp-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div className="spinner" />
    </div>
  );

  // Never joined any mission — hard gate
  if (!data || !data.hasMembership) return (
    <>
      <style>{styles}</style>
      <div className="cp-page">
        <div style={{ background: "white", borderBottom: "1px solid #ede8df", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "#faf8f3", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
          <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700 }}>Care Contributor</div>
        </div>
        <div className="cp-inner" style={{ textAlign: "center", paddingTop: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌱</div>
          <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: C.purple, marginBottom: 8 }}>Your contributor profile is waiting</div>
          <div style={{ fontSize: 14, color: C.mid, fontFamily: "Nunito, sans-serif", lineHeight: 1.6, marginBottom: 28 }}>
            Join a mission and take your first action — every click, listing, and outcome you create will be recorded here.
          </div>
          <button onClick={() => router.push("/missions")}
            style={{ background: C.purple, color: "white", border: "none", borderRadius: 14, padding: "14px 28px", fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
            Browse missions
          </button>
        </div>
        <BottomNav />
      </div>
    </>
  );

  // Joined a mission but no actions yet — zero-data state
  if (!data.hasActions) {
    const am = data.activeMission;
    const amPct = am ? Math.min(100, Math.round((am.totalBlocks / am.goalBlocks) * 100)) : 0;
    const shareUrl = am
      ? `${typeof window !== "undefined" ? window.location.origin : "https://kradel.com"}/missions?ref=${am.teamId}`
      : "";
    const copyLink = () => {
      if (!shareUrl) return;
      navigator.clipboard.writeText(shareUrl).catch(() => {});
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    };

    return (
      <>
        <style>{styles}</style>
        <div className="cp-page">
          {/* Header */}
          <div style={{ background: "white", borderBottom: "1px solid #ede8df", padding: "14px 16px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
            <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "#faf8f3", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>←</button>
            <div style={{ flex: 1 }}>
              <div style={{ display: "inline-block", background: "#f5f3ff", color: C.purple, fontSize: 10, fontWeight: 800, letterSpacing: "1.2px", padding: "3px 10px", borderRadius: 20, fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>
                CARE CONTRIBUTOR
              </div>
              <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>
                {user.name}&rsquo;s contribution
              </div>
              <div style={{ fontSize: 12, color: C.muted, fontFamily: "Nunito, sans-serif", marginTop: 3 }}>
                Every action you&rsquo;ve taken to reach a mother.
              </div>
            </div>
          </div>

          <div className="cp-inner">
            {/* Lifetime stats — all 0s, honest */}
            <div className="cp-card">
              <div className="cp-section-label">Your lifetime impact</div>
              <div className="stat-grid">
                {[
                  { num: 0, label: "Link\nClicks" },
                  { num: 0, label: "New Members\nBrought In" },
                  { num: 0, label: "Activity\nSparked" },
                  { num: 0, label: "Mothers\nReached" },
                ].map(({ num, label }) => (
                  <div key={label} className="stat-box">
                    <div className="stat-num" style={{ color: C.muted }}>{num}</div>
                    <div className="stat-label">{label.split("\n").map((l, i) => <span key={i}>{l}{i === 0 ? <br /> : ""}</span>)}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: "12px 16px", background: "#f5f3ff", borderRadius: 12, textAlign: "center", fontFamily: "Nunito, sans-serif" }}>
                <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>0 blocks contributed so far — your first action fills this</span>
              </div>
            </div>

            {/* Current mission */}
            {am && (
              <div className="cp-card">
                <div className="cp-section-label">Missions you&rsquo;ve been part of</div>
                <div className="mission-row" style={{ borderBottom: "none" }}>
                  <div className="mission-dot" style={{ background: C.purple }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>{am.name}</div>
                    <div style={{ fontSize: 11, color: C.muted, fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>Active mission</div>
                    <MiniBar myBlocks={am.totalBlocks} goalBlocks={am.goalBlocks} />
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 3, fontFamily: "Nunito, sans-serif" }}>
                      Team: {am.totalBlocks}/{am.goalBlocks} blocks ({amPct}%)
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: C.muted }}>0</div>
                    <div style={{ fontSize: 10, color: C.muted, fontFamily: "Nunito, sans-serif" }}>your blocks</div>
                  </div>
                </div>
              </div>
            )}

            {/* Action history — empty with CTA */}
            <div className="cp-card">
              <div className="cp-section-label">Your mission history</div>
              <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>✨</div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>Your actions will appear here.</div>
                <div style={{ fontSize: 13, color: C.mid, fontFamily: "Nunito, sans-serif", lineHeight: 1.6, marginBottom: 18 }}>
                  Share your link to start. Every click, sign-up, and listing you spark gets recorded.
                </div>
                {shareUrl && (
                  <button
                    onClick={copyLink}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, border: `1.5px solid ${C.purple}`, background: linkCopied ? C.purple : "#f5f3ff", color: linkCopied ? "white" : C.purple, fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                  >
                    {linkCopied ? "Copied ✓" : "🔗 Copy your referral link"}
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ textAlign: "center", padding: "8px 20px 20px", fontFamily: "Lora, serif", fontStyle: "italic", fontSize: 14, color: C.muted, lineHeight: 1.8 }}>
              <span style={{ marginRight: 6 }}>💜</span>
              Care moves everything. Thank you for showing up.
            </div>
          </div>
        </div>
        <BottomNav />
      </>
    );
  }

  const stats          = data.stats!;
  const missionHistory = data.missionHistory!;
  const recentActions  = data.recentActions!;
  const highlightMoments = data.highlightMoments!;
  const groups = groupActions(recentActions);

  const now = Date.now();
  const recentGroups = groups.filter(g => {
    if (!g.actions.length) return false;
    const oldest = new Date(g.actions[g.actions.length - 1].createdAt).getTime();
    return now - oldest < 48 * 3600000;
  });
  const olderGroups = groups.filter(g => {
    if (!g.actions.length) return false;
    const oldest = new Date(g.actions[g.actions.length - 1].createdAt).getTime();
    return now - oldest >= 48 * 3600000;
  });

  return (
    <>
      <style>{styles}</style>
      <div className="cp-page">

        {/* ── Header ── */}
        <div style={{ background: "white", borderBottom: "1px solid #ede8df", padding: "14px 16px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "#faf8f3", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ display: "inline-block", background: "#f5f3ff", color: C.purple, fontSize: 10, fontWeight: 800, letterSpacing: "1.2px", padding: "3px 10px", borderRadius: 20, fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>
              CARE CONTRIBUTOR
            </div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>
              {user.name}&rsquo;s contribution
            </div>
            <div style={{ fontSize: 12, color: C.muted, fontFamily: "Nunito, sans-serif", marginTop: 3 }}>
              Every action you&rsquo;ve taken to reach a mother.
            </div>
          </div>
        </div>

        <div className="cp-inner">

          {/* ── Lifetime stats ── */}
          <div className="cp-card">
            <div className="cp-section-label">Your lifetime impact</div>
            <div className="stat-grid">
              <div className="stat-box">
                <div className="stat-num">{stats.clicks}</div>
                <div className="stat-label">Link<br/>Clicks</div>
              </div>
              <div className="stat-box">
                <div className="stat-num">{stats.signups}</div>
                <div className="stat-label">New Members<br/>Brought In</div>
              </div>
              <div className="stat-box">
                <div className="stat-num">{stats.activity}</div>
                <div className="stat-label">Activity<br/>Sparked</div>
              </div>
              <div className="stat-box">
                <div className="stat-num" style={{ color: C.green }}>{stats.outcomes}</div>
                <div className="stat-label">Mothers<br/>Reached</div>
              </div>
            </div>
            <div style={{ marginTop: 14, padding: "12px 16px", background: "#f5f3ff", borderRadius: 12, textAlign: "center", fontFamily: "Nunito, sans-serif" }}>
              <span style={{ fontSize: 13, color: C.purple, fontWeight: 700 }}>{stats.totalBlocks} blocks</span>
              <span style={{ fontSize: 12, color: C.mid }}> contributed across all missions</span>
            </div>
          </div>

          {/* ── Mission history ── */}
          {missionHistory.length > 0 && (
            <div className="cp-card">
              <div className="cp-section-label">Missions you&rsquo;ve been part of</div>
              {missionHistory.map(m => {
                const pct = Math.min(100, Math.round((m.teamBlocks / m.goalBlocks) * 100));
                return (
                  <div key={m.id} className="mission-row">
                    <div className="mission-dot" style={{ background: m.isComplete ? C.green : C.purple }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>
                        {m.missionName}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>
                        {formatMonth(m.month)}
                        {m.isComplete && <span style={{ marginLeft: 6, color: C.green, fontWeight: 700 }}>✓ Complete</span>}
                      </div>
                      <MiniBar myBlocks={m.teamBlocks} goalBlocks={m.goalBlocks} />
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 3, fontFamily: "Nunito, sans-serif" }}>
                        Team: {m.teamBlocks}/{m.goalBlocks} blocks ({pct}%)
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: C.purple }}>{m.myBlocks}</div>
                      <div style={{ fontSize: 10, color: C.muted, fontFamily: "Nunito, sans-serif" }}>your blocks</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Impact highlights ── */}
          {highlightMoments.length > 0 && (
            <div className="cp-card">
              <div className="cp-section-label cp-section-label-green">Moments that mattered</div>
              <div style={{ fontSize: 12, color: C.mid, fontFamily: "Nunito, sans-serif", marginBottom: 14, lineHeight: 1.5 }}>
                The moments below are when a mom received something real because of your effort.
              </div>
              {highlightMoments.map(m => (
                <div key={m.id} className="moment-card">
                  <div className="moment-icon">💚</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 600, color: C.text, lineHeight: 1.4, marginBottom: 4 }}>
                      {m.humanLabel}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, fontFamily: "Nunito, sans-serif" }}>
                      {relativeTime(m.createdAt)} · +{m.blocks} blocks
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Action history feed ── */}
          {recentActions.length > 0 && (
            <div className="cp-card">
              <div className="cp-section-label">Your mission history</div>
              <div style={{ fontSize: 12, color: C.mid, fontFamily: "Nunito, sans-serif", marginBottom: 14, lineHeight: 1.5 }}>
                Each action below is something you helped happen.
              </div>

              {/* Recent <48h — daily digest */}
              {recentGroups.length > 0 && recentGroups.flatMap(g => g.actions).length > 0 && (() => {
                const recent = recentGroups.flatMap(g => g.actions);
                const clicks  = recent.filter(a => a.actionType === "click").length;
                const signups = recent.filter(a => a.actionType === "signup").length;
                const acts    = recent.filter(a => ["listing","listing_posted","register_committed"].includes(a.actionType)).length;
                const outs    = recent.filter(a => COMPLETED_TYPES.includes(a.actionType)).length;
                const parts: string[] = [];
                if (clicks)  parts.push(`${clicks} click${clicks > 1 ? "s" : ""}`);
                if (signups) parts.push(`${signups} new member${signups > 1 ? "s" : ""}`);
                if (acts)    parts.push(`${acts} listing${acts > 1 ? "s" : ""}`);
                if (outs)    parts.push(`${outs} mom${outs > 1 ? "s" : ""} reached`);
                return (
                  <div style={{ background: "#f5f3ff", borderRadius: 14, padding: "12px 14px", marginBottom: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.purple, flexShrink: 0, marginTop: 5 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: C.purple, marginBottom: 2 }}>Recent activity (last 48h)</div>
                      <div style={{ fontSize: 12, color: C.mid, fontFamily: "Nunito, sans-serif" }}>{parts.join(" · ")}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Older actions broken out individually */}
              {olderGroups.map((group, gi) => (
                <div key={gi}>
                  <div className="week-divider">{group.label}</div>
                  {group.actions.map(action => (
                    <div key={action.id} className="action-row">
                      <div className="action-swatch" style={{ background: actionSwatch(action.actionType) }} />
                      <div style={{ flex: 1, fontSize: 12, color: C.text, fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>
                        {action.humanLabel}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: "Nunito, sans-serif", flexShrink: 0, marginLeft: 8, textAlign: "right" }}>
                        <div>{relativeTime(action.createdAt)}</div>
                        <div style={{ fontWeight: 700, color: C.green }}>+{action.blocks}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {recentActions.length === 0 && (
                <div style={{ textAlign: "center", padding: "24px 0", color: C.muted, fontSize: 13 }}>
                  No actions recorded yet.
                </div>
              )}
            </div>
          )}

          {/* ── Footer ── */}
          <div style={{ textAlign: "center", padding: "8px 20px 20px", fontFamily: "Lora, serif", fontStyle: "italic", fontSize: 14, color: C.muted, lineHeight: 1.8 }}>
            <span style={{ marginRight: 6 }}>💜</span>
            Care moves everything. Thank you for showing up.
          </div>

        </div>
      </div>
      <BottomNav />
    </>
  );
}
