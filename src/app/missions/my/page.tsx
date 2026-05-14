"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";

const BLOCK_COLORS = {
  donation: "#1a7a5e",
  listing:  "#7bc4a4",
  click:    "#d4cfc8",
  empty:    "#e8e4de",
};

const ACTION_ICON: Record<string, string> = {
  donation: "💛",
  listing:  "📦",
  click:    "🔗",
};

interface MissionMember {
  id: string;
  userId: string;
  name: string;
  avatar: string | null;
  isMe: boolean;
}

interface RecentAction {
  id: string;
  actionType: string;
  blocks: number;
  humanLabel: string;
  userName: string;
  isMe: boolean;
  createdAt: string;
}

interface MissionData {
  id: string;
  teamId: string;
  mission: {
    id: string;
    name: string;
    description: string;
    month: string;
    goalBlocks: number;
  };
  team: {
    id: string;
    totalBlocks: number;
    isComplete: boolean;
    clickBlocks: number;
    listingBlocks: number;
    donationBlocks: number;
    members: MissionMember[];
    recentActions: RecentAction[];
  };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

function buildBlockGrid(
  goalBlocks: number,
  donationBlocks: number,
  listingBlocks: number,
  clickBlocks: number,
): string[] {
  const grid: string[] = [];
  const filled = Math.min(goalBlocks, donationBlocks + listingBlocks + clickBlocks);
  // Fill in order: donations → listings → clicks
  let d = Math.min(donationBlocks, goalBlocks);
  let l = Math.min(listingBlocks, goalBlocks - d);
  let c = Math.min(clickBlocks,   goalBlocks - d - l);
  for (let i = 0; i < d; i++) grid.push("donation");
  for (let i = 0; i < l; i++) grid.push("listing");
  for (let i = 0; i < c; i++) grid.push("click");
  while (grid.length < goalBlocks) grid.push("empty");
  return grid;
}

export default function MyMissionPage() {
  const { user }  = useAuth();
  const router    = useRouter();

  const [data,    setData]    = useState<MissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [leaveErr, setLeaveErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/missions/my");
    if (r.ok) {
      const d = await r.json();
      setData(d.membership ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) { router.push("/auth"); return; }
    load();
  }, [user, load, router]);

  const canLeave = (() => {
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth(), 2);
    return now < cutoff;
  })();

  const handleLeave = async () => {
    if (!data || !canLeave) return;
    if (!confirm("Are you sure you want to leave this mission? You can only leave once per month.")) return;
    setLeaving(true);
    setLeaveErr(null);
    const res = await fetch(`/api/missions/${data.mission.id}/leave`, { method: "POST" });
    const d   = await res.json();
    if (res.ok) {
      router.push("/missions");
    } else {
      setLeaveErr(d.error ?? "Could not leave mission");
      setLeaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
        <div className="discover-desktop">
          <div style={{ background: "var(--white)", padding: "16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)" }}>
            <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg)", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700 }}>My Mission</div>
          </div>
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>🤝</div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No active mission</div>
            <div style={{ fontSize: 14, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 24, lineHeight: 1.6 }}>
              Join a collective challenge and help fund maternal essentials through your team's actions.
            </div>
            <button
              onClick={() => router.push("/missions")}
              style={{ background: "#1a7a5e", color: "white", border: "none", borderRadius: 14, padding: "14px 28px", fontFamily: "Nunito, sans-serif", fontSize: 15, fontWeight: 800, cursor: "pointer" }}
            >
              Browse missions
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const { mission, team } = data;
  const goal    = mission.goalBlocks;
  const filled  = Math.min(goal, team.totalBlocks);
  const pct     = Math.round((filled / goal) * 100);
  const dPct    = Math.round((team.donationBlocks / goal) * 100);
  const lPct    = Math.round((team.listingBlocks  / goal) * 100);
  const cPct    = Math.round((team.clickBlocks    / goal) * 100);
  const blocks  = buildBlockGrid(goal, team.donationBlocks, team.listingBlocks, team.clickBlocks);

  // Pad members to 5 for display
  const displayMembers: Array<MissionMember | null> = [...team.members];
  while (displayMembers.length < 5) displayMembers.push(null);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">
        {/* Header */}
        <div style={{ background: "var(--white)", padding: "16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)" }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg)", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
          <div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700 }}>My Mission</div>
            <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>{mission.month}</div>
          </div>
        </div>

        <div style={{ padding: "20px 16px 120px" }}>

          {/* Mission completed banner */}
          {team.isComplete && (
            <div style={{ background: "linear-gradient(135deg, #1a7a5e 0%, #22a37c 100%)", borderRadius: 18, padding: "20px 18px", marginBottom: 16, color: "white", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
              <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Mission Complete!</div>
              <div style={{ fontSize: 13, fontFamily: "Nunito, sans-serif", opacity: 0.9, lineHeight: 1.6 }}>
                Your team filled all {goal} blocks. See what your collective effort made possible below.
              </div>
            </div>
          )}

          {/* Mission name */}
          {!team.isComplete && (
            <div style={{ background: "#1a7a5e", borderRadius: 18, padding: "20px 18px", marginBottom: 16, color: "white" }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>🤝</div>
              <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{mission.name}</div>
              <div style={{ fontSize: 13, fontFamily: "Nunito, sans-serif", opacity: 0.9, lineHeight: 1.6 }}>{mission.description}</div>
            </div>
          )}

          {/* Team avatars */}
          <div style={{ background: "var(--white)", borderRadius: 16, padding: "18px 16px", marginBottom: 14, border: "1px solid var(--border)" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Your team</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {displayMembers.map((m, i) => (
                <div key={i} style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: m === null ? "#e8e4de" : m.isMe ? "#1a7a5e" : "#7bc4a4",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 14,
                  color: m === null ? "#a0a0a0" : "white",
                  border: m?.isMe ? "2.5px solid #1a7a5e" : "2.5px solid transparent",
                  flexShrink: 0,
                }}>
                  {m === null ? "?" : getInitial(m.name)}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
              {team.members.length} of 5 donors active this month
            </div>
          </div>

          {/* 40-block grid */}
          <div style={{ background: "var(--white)", borderRadius: 16, padding: "18px 16px", marginBottom: 14, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700 }}>Team progress</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#1a7a5e", fontFamily: "Nunito, sans-serif" }}>{filled}/{goal} blocks</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 14 }}>
              {pct}% complete
            </div>

            {/* Block grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 5, marginBottom: 16 }}>
              {blocks.map((type, i) => (
                <div
                  key={i}
                  style={{
                    height: 28, borderRadius: 5,
                    background: BLOCK_COLORS[type as keyof typeof BLOCK_COLORS],
                    transition: "background 0.3s",
                  }}
                />
              ))}
            </div>

            {/* Stacked progress bar */}
            <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", background: BLOCK_COLORS.empty, marginBottom: 10 }}>
              <div style={{ width: `${dPct}%`, background: BLOCK_COLORS.donation, transition: "width 0.6s ease", borderRadius: dPct === 100 ? 6 : "6px 0 0 6px" }} />
              <div style={{ width: `${lPct}%`, background: BLOCK_COLORS.listing,  transition: "width 0.6s ease" }} />
              <div style={{ width: `${cPct}%`, background: BLOCK_COLORS.click,    transition: "width 0.6s ease" }} />
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {([
                { color: BLOCK_COLORS.donation, label: `Donations (${team.donationBlocks})`  },
                { color: BLOCK_COLORS.listing,  label: `Listings (${team.listingBlocks})`    },
                { color: BLOCK_COLORS.click,    label: `Link visits (${team.clickBlocks})`   },
              ] as const).map(({ color, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
                  <span style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mission complete — impact translation */}
          {team.isComplete && (
            <div style={{ background: "linear-gradient(135deg, #1a7a5e 0%, #22a37c 100%)", borderRadius: 16, padding: "18px 16px", marginBottom: 14 }}>
              <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: "white", marginBottom: 8 }}>What your team funded</div>
              <div style={{ fontSize: 13, fontFamily: "Nunito, sans-serif", color: "rgba(255,255,255,0.9)", lineHeight: 1.7, marginBottom: 14 }}>
                Your {goal} blocks translated into real support for mothers in your community.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { val: "8",  label: "Mothers reached"  },
                  { val: "24", label: "Items fulfilled"  },
                  { val: "3",  label: "Kits delivered"   },
                ].map(({ val, label }) => (
                  <div key={label} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
                    <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: "white" }}>{val}</div>
                    <div style={{ fontSize: 10, fontFamily: "Nunito, sans-serif", color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent actions */}
          {team.recentActions.length > 0 && (
            <div style={{ background: "var(--white)", borderRadius: 16, padding: "18px 16px", marginBottom: 14, border: "1px solid var(--border)" }}>
              <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Recent activity</div>
              {team.recentActions.map((action, i) => (
                <div key={action.id} style={{ display: "flex", gap: 12, paddingBottom: i < team.recentActions.length - 1 ? 12 : 0, marginBottom: i < team.recentActions.length - 1 ? 12 : 0, borderBottom: i < team.recentActions.length - 1 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                    {ACTION_ICON[action.actionType] ?? "✨"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "Nunito, sans-serif", color: "var(--ink)", marginBottom: 2 }}>
                      {action.isMe ? "You" : action.userName.split(" ")[0]} · <span style={{ color: "#1a7a5e" }}>+{action.blocks} {action.blocks === 1 ? "block" : "blocks"}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>
                      {action.humanLabel}
                    </div>
                    <div style={{ fontSize: 10, color: "#b0b0b0", fontFamily: "Nunito, sans-serif", marginTop: 3 }}>
                      {timeAgo(action.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Share your link */}
          <div style={{ background: "var(--white)", borderRadius: 16, padding: "18px 16px", marginBottom: 14, border: "1px solid var(--border)" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Grow your team's impact</div>
            <div style={{ fontSize: 13, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, marginBottom: 12 }}>
              Every logged-in person who visits your link earns your team +1 block.
            </div>
            <button
              onClick={() => {
                const url = `${window.location.origin}/missions?ref=${team.id}`;
                navigator.clipboard.writeText(url).then(() => {}).catch(() => {});
              }}
              style={{ width: "100%", padding: "12px", background: "#e8f5f1", color: "#1a7a5e", border: "none", borderRadius: 12, fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
            >
              🔗 Copy referral link
            </button>
          </div>

          {/* Leave mission */}
          {leaveErr && (
            <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#dc2626", fontFamily: "Nunito, sans-serif" }}>
              {leaveErr}
            </div>
          )}
          <div style={{ textAlign: "center", paddingTop: 4 }}>
            <button
              onClick={handleLeave}
              disabled={!canLeave || leaving}
              style={{ background: "none", border: "none", fontSize: 12, color: canLeave ? "#9ca3af" : "#d1d5db", cursor: canLeave ? "pointer" : "default", fontFamily: "Nunito, sans-serif", textDecoration: canLeave ? "underline" : "none" }}
            >
              {leaving ? "Leaving…" : canLeave ? "Leave this mission" : "Leaving closes after the 1st of the month"}
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
