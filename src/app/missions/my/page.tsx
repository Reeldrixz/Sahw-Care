"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";

// ── Colour tokens ──────────────────────────────────────────────────────────────
const MP  = "#6d5acd"; // mission purple
const MPL = "#ede9ff"; // mission lavender
const MPT = "#8b73e0"; // purple tint (lighter)

const BLOCK: Record<string, string> = {
  donation: "#1a7a5e",
  listing:  "#7bc4a4",
  click:    "#d4cfc8",
  empty:    "#e8e4de",
};

// ── Interfaces ─────────────────────────────────────────────────────────────────
interface MissionMember {
  id: string; userId: string; name: string;
  avatar: string | null; isMe: boolean;
}
interface RecentAction {
  id: string; actionType: string; blocks: number;
  humanLabel: string; userName: string; isMe: boolean; createdAt: string;
}
interface MissionData {
  id: string; teamId: string;
  mission: { id: string; name: string; description: string; month: string; goalBlocks: number; category: string; };
  team: {
    id: string; totalBlocks: number; isComplete: boolean;
    clickBlocks: number; listingBlocks: number; donationBlocks: number;
    members: MissionMember[]; recentActions: RecentAction[];
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function initial(name: string) { return name.trim().charAt(0).toUpperCase(); }

function buildGrid(goal: number, d: number, l: number, c: number): string[] {
  const grid: string[] = [];
  const dd = Math.min(d, goal);
  const ll = Math.min(l, goal - dd);
  const cc = Math.min(c, goal - dd - ll);
  for (let i = 0; i < dd; i++) grid.push("donation");
  for (let i = 0; i < ll; i++) grid.push("listing");
  for (let i = 0; i < cc; i++) grid.push("click");
  while (grid.length < goal) grid.push("empty");
  return grid;
}

function MiniGrid({ types, cols = 10, h = 8 }: { types: string[]; cols?: number; h?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 3 }}>
      {types.map((t, i) => (
        <div key={i} style={{ height: h, borderRadius: 2, background: BLOCK[t] ?? BLOCK.empty }} />
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function MyMissionPage() {
  const { user }  = useAuth();
  const router    = useRouter();

  const [data,     setData]     = useState<MissionData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [leaving,  setLeaving]  = useState(false);
  const [leaveErr, setLeaveErr] = useState<string | null>(null);
  const [copied,   setCopied]   = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/missions/my");
    if (r.ok) { const d = await r.json(); setData(d.membership ?? null); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) { router.push("/auth"); return; }
    load();
  }, [user, load, router]);

  const canLeave = new Date() < new Date(new Date().getFullYear(), new Date().getMonth(), 2);

  const handleLeave = async () => {
    if (!data || !canLeave) return;
    if (!confirm("Are you sure you want to leave this mission? You can only leave once per month.")) return;
    setLeaving(true); setLeaveErr(null);
    const res = await fetch(`/api/missions/${data.mission.id}/leave`, { method: "POST" });
    const d   = await res.json();
    if (res.ok) { router.push("/missions"); } else { setLeaveErr(d.error ?? "Could not leave"); setLeaving(false); }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Loading / empty states ────────────────────────────────────────────────
  if (loading) return (
    <div style={{ background: "#f5f3ff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="spinner" />
    </div>
  );

  if (!data) return (
    <div style={{ background: "#f5f3ff", minHeight: "100vh" }}>
      <div className="discover-desktop">
        <div style={{ padding: "32px 20px", textAlign: "center" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: MP, marginBottom: 8 }}>No active mission</div>
          <div style={{ fontSize: 14, color: "#666", fontFamily: "Nunito, sans-serif", marginBottom: 24 }}>
            Join a collective challenge and help fund maternal essentials.
          </div>
          <button onClick={() => router.push("/missions")}
            style={{ background: MP, color: "white", border: "none", borderRadius: 14, padding: "14px 28px", fontFamily: "Nunito, sans-serif", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
            Browse missions
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  );

  // ── Derived values ────────────────────────────────────────────────────────
  const { mission, team } = data;
  const goal     = mission.goalBlocks;
  const filled   = Math.min(goal, team.totalBlocks);

  const clickCount    = team.clickBlocks;
  const listingCount  = Math.floor(team.listingBlocks  / 2);
  const donationCount = Math.floor(team.donationBlocks / 4);

  const momsSupported       = Math.max(donationCount * 2 + listingCount, team.totalBlocks > 0 ? 1 : 0);
  const essentialsDelivered = team.totalBlocks;
  const citiesReached       = Math.max(1, Math.min(3, team.members.length));

  const partners = team.members.filter(m => !m.isMe);
  const me       = team.members.find(m => m.isMe);

  const blocks = buildGrid(goal, team.donationBlocks, team.listingBlocks, team.clickBlocks);

  const monthDate  = new Date(mission.month + "-01");
  const monthLabel = monthDate.toLocaleString("en", { month: "long" });
  const lastDay    = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const dateRange  = `${monthLabel} 1 – ${monthLabel} ${lastDay}`;

  const categoryLabel = mission.category === "bundles" ? "Bundle Support"
    : mission.category === "registers" ? "Register Support"
    : mission.category === "postpartum" ? "Postpartum Support"
    : "Bundle Support";

  const shareUrl = `kradel.com/missions?ref=${team.id}`;
  const fullShareUrl = `${typeof window !== "undefined" ? window.location.origin : "https://kradel.com"}/missions?ref=${team.id}`;

  // Step demo grids
  const step1Blocks = [...Array(40)].map((_, i) => i === 0 ? "click" : "empty");
  const step2Blocks = [...Array(40)].map((_, i) => i === 0 ? "click" : i < 3 ? "listing" : "empty");
  const step3Blocks = [...Array(40)].map((_, i) => i === 0 ? "click" : i < 3 ? "listing" : i < 7 ? "donation" : "empty");
  const step4Blocks = Array(40).fill("donation");

  return (
    <div style={{ background: "#f5f3ff", minHeight: "100vh", fontFamily: "Nunito, sans-serif" }}>
      <div className="discover-desktop">

        {/* ── 1. PAGE HEADER ────────────────────────────────────────────────── */}
        <div style={{ background: "white", padding: "20px 20px 16px", borderBottom: "1px solid #e5e0f8" }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: MP, padding: 0, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16 }}>←</span>
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700 }}>Back</span>
          </button>
          <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: "#1a1a1a", letterSpacing: 0.5 }}>
            YOUR MONTHLY MISSION <span style={{ color: MP }}>♡</span>
          </div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
            You chose to support: <strong style={{ color: MP }}>{categoryLabel}</strong>
          </div>
        </div>

        <div style={{ padding: "16px 16px 100px" }}>

          {/* ── 2. MISSION PROGRESS CARD ──────────────────────────────────────── */}
          <div style={{ background: MP, borderRadius: 20, padding: "20px 18px", marginBottom: 16, color: "white" }}>

            {/* Top row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              {/* Avatar */}
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                {me ? initial(me.name) : "?"}
              </div>
              {/* Centre text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Your Mission Progress</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{dateRange}</div>
              </div>
              {/* Badge */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 18 }}>🎁</span>
                <span style={{ fontSize: 9, fontWeight: 800, background: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: 20, letterSpacing: 0.5 }}>
                  {categoryLabel.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Monthly goal */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>Monthly Goal</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontFamily: "Lora, serif", fontSize: 48, fontWeight: 700, lineHeight: 1 }}>{goal}</span>
                  <span style={{ fontSize: 13, opacity: 0.85 }}>maternity essentials</span>
                </div>
              </div>
              <div style={{ fontSize: 40, opacity: 0.6 }}>🎁</div>
            </div>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 16 }}>Help us reach more moms this month.</div>

            {/* Block grid 10 × 4 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4, marginBottom: 16 }}>
              {blocks.map((t, i) => (
                <div key={i} style={{ height: 24, borderRadius: 4, background: BLOCK[t], opacity: t === "empty" ? 0.45 : 1 }} />
              ))}
            </div>

            {/* 3 stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 16 }}>
              {[
                { icon: "🔗", value: clickCount,    label: "Clicks"    },
                { icon: "📋", value: listingCount,  label: "Listings"  },
                { icon: "✓",  value: donationCount, label: "Donations" },
              ].map(({ icon, value, label }) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "10px 6px", textAlign: "center" }}>
                  <div style={{ fontSize: 16, marginBottom: 2 }}>{icon}</div>
                  <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700 }}>{value}</div>
                  <div style={{ fontSize: 10, opacity: 0.8 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Lavender affirmation */}
            <div style={{ background: MPL, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>💜</span>
              <span style={{ fontSize: 12, color: MP, fontWeight: 600, lineHeight: 1.5 }}>
                Every action brings us closer to supporting more moms.
              </span>
            </div>

            {/* Share link */}
            <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 14, padding: "14px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Share your link.</div>
              <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 10 }}>Invite others to join your mission!</div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 10px", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.9 }}>
                  {shareUrl}
                </div>
                <button
                  onClick={() => handleCopy(fullShareUrl)}
                  style={{ background: MPL, color: MP, border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  {copied ? "Copied ✓" : "Share ↑"}
                </button>
              </div>
            </div>
          </div>

          {/* ── 3. HOW YOUR BAR FILLS ─────────────────────────────────────────── */}
          <div style={{ background: "white", borderRadius: 16, padding: "18px 16px", marginBottom: 16, border: "1px solid #e5e0f8" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: MP, letterSpacing: 1, marginBottom: 14 }}>HOW YOUR BAR FILLS</div>

            {[
              {
                color: BLOCK.click,    border: "#ccc",
                title: "Social Clicks",
                desc:  "When someone clicks your link.",
                value: "+1 block",
              },
              {
                color: BLOCK.listing,  border: BLOCK.listing,
                title: "Listing Created",
                desc:  "When someone creates a listing (register or discover).",
                value: "+2 blocks",
              },
              {
                color: BLOCK.donation, border: BLOCK.donation,
                title: "Request Fulfilled / Donation Completed",
                desc:  "When someone fulfills a request or completes a donation.",
                value: "+4 blocks",
              },
            ].map(({ color, border, title, desc, value }) => (
              <div key={title} style={{ display: "flex", alignItems: "flex-start", gap: 12, paddingBottom: 12, marginBottom: 12, borderBottom: "1px solid #f0ecfa" }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, background: color, border: `1.5px solid ${border}`, flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>{title}</div>
                  <div style={{ fontSize: 11, color: "#777", lineHeight: 1.5 }}>{desc}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: MP, flexShrink: 0 }}>{value}</div>
              </div>
            ))}

            {/* Total impact */}
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#1a1a1a", letterSpacing: 0.5, marginBottom: 12 }}>Total Impact This Month</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                {[
                  { val: momsSupported,       label: "Moms Supported"       },
                  { val: essentialsDelivered, label: "Essentials Delivered" },
                  { val: citiesReached,       label: "Cities Reached"       },
                ].map(({ val, label }) => (
                  <div key={label} style={{ background: MPL, borderRadius: 12, padding: "12px 6px", textAlign: "center" }}>
                    <div style={{ fontFamily: "Lora, serif", fontSize: 24, fontWeight: 700, color: MP }}>{val}</div>
                    <div style={{ fontSize: 9, color: MPT, marginTop: 2, lineHeight: 1.4 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: "center", fontSize: 13, color: "#888", fontStyle: "italic" }}>Together, we care. 💜</div>
            </div>
          </div>

          {/* ── 4. OTHER MISSION PARTNERS ─────────────────────────────────────── */}
          {partners.length > 0 && (
            <div style={{ background: "white", borderRadius: 16, padding: "18px 16px", marginBottom: 16, border: "1px solid #e5e0f8" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: MP, letterSpacing: 1, marginBottom: 4 }}>OTHER MISSION PARTNERS</div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 14 }}>People supporting the same mission this month.</div>

              {partners.map((partner) => {
                // Estimate partner stats from recentActions (sum their contributions)
                const pActions = team.recentActions.filter(a => a.userName === partner.name);
                const pClicks    = pActions.filter(a => a.actionType === "click").reduce((s, a) => s + a.blocks, 0);
                const pListings  = Math.floor(pActions.filter(a => a.actionType === "listing").reduce((s, a) => s + a.blocks, 0) / 2);
                const pDonations = Math.floor(pActions.filter(a => a.actionType === "donation").reduce((s, a) => s + a.blocks, 0) / 4);
                const pBlocks    = pActions.reduce((s, a) => s + a.blocks, 0);
                const pGrid      = buildGrid(goal, pDonations * 4, pListings * 2, pClicks);

                return (
                  <div key={partner.id} style={{ background: "#faf9ff", borderRadius: 12, padding: "14px", marginBottom: 10, border: "1px solid #ede9ff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: "50%", background: MPT, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, color: "white", flexShrink: 0 }}>
                        {initial(partner.name)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{partner.name.split(" ")[0]}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>Goal: {goal} essentials</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: MP }}>{pBlocks}/{goal}</div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <MiniGrid types={pGrid} cols={10} h={10} />
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                      {[
                        { icon: "🔗", val: pClicks,    lbl: "clicks"    },
                        { icon: "📋", val: pListings,  lbl: "listings"  },
                        { icon: "✓",  val: pDonations, lbl: "donations" },
                      ].map(({ icon, val, lbl }) => (
                        <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 12 }}>{icon}</span>
                          <span style={{ fontSize: 11, color: "#666" }}>{val} {lbl}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 16 }}>👥</span>
                <span style={{ fontSize: 12, color: "#888" }}>
                  <strong style={{ color: MP }}>{team.members.length}</strong> friends. 1 mission. More love. More impact.
                </span>
              </div>
            </div>
          )}

          {/* ── 5. HOW IT WORKS ───────────────────────────────────────────────── */}
          <div style={{ background: "white", borderRadius: 16, padding: "18px 16px", marginBottom: 16, border: "1px solid #e5e0f8" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#1a1a1a", letterSpacing: 1, textAlign: "center", marginBottom: 18 }}>HOW IT WORKS</div>

            {/* Steps — 2×2 grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                {
                  num: "1", numBg: MP,
                  icon: "✈️",
                  title: "Someone clicks your link",
                  desc: "You share on social media. They click.",
                  grid: step1Blocks,
                  badge: "+1 block",
                  badgeColor: MP,
                },
                {
                  num: "2", numBg: "#1a7a5e",
                  icon: "📋",
                  title: "They create a listing",
                  desc: "They sign up and create a listing.",
                  grid: step2Blocks,
                  badge: "+2 blocks",
                  badgeColor: "#1a7a5e",
                },
                {
                  num: "3", numBg: "#155e4a",
                  icon: "💛",
                  title: "They fulfill a request or donate",
                  desc: "A real item reaches a mom in need.",
                  grid: step3Blocks,
                  badge: "+4 blocks",
                  badgeColor: "#155e4a",
                },
                {
                  num: "4", numBg: MP,
                  icon: "🎉",
                  title: "Mission complete!",
                  desc: "Together, you reached your monthly goal.",
                  grid: step4Blocks,
                  badge: "Goal Achieved ♥",
                  badgeColor: MP,
                },
              ].map(({ num, numBg, icon, title, desc, grid, badge, badgeColor }) => (
                <div key={num} style={{ background: "#faf9ff", borderRadius: 12, padding: "12px 10px", border: "1px solid #ede9ff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: numBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "white", flexShrink: 0 }}>
                      {num}
                    </div>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "white", border: "1.5px solid #e5e0f8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                      {icon}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#1a1a1a", marginBottom: 3, lineHeight: 1.3 }}>{title}</div>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 8, lineHeight: 1.4 }}>{desc}</div>
                  <MiniGrid types={grid} cols={10} h={7} />
                  <div style={{ fontSize: 11, fontWeight: 800, color: badgeColor, marginTop: 6 }}>{badge}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 6. BOTTOM TAGLINE ─────────────────────────────────────────────── */}
          <div style={{ background: "white", borderRadius: 16, padding: "16px", marginBottom: 16, border: "1px solid #e5e0f8" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 13, color: "#1a1a1a", lineHeight: 1.6 }}>
                Every click. Every listing. Every act of care.{" "}
                <strong>It all adds up to change a mom&rsquo;s life.</strong>
              </div>
              <div style={{ background: MPL, borderRadius: 20, padding: "8px 14px", alignSelf: "flex-start", fontSize: 12, color: MP, fontWeight: 700 }}>
                Thank you for being part of the change 💜
              </div>
            </div>
          </div>

          {/* ── Leave mission ────────────────────────────────────────────────── */}
          {leaveErr && (
            <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#dc2626" }}>
              {leaveErr}
            </div>
          )}
          <div style={{ textAlign: "center", paddingTop: 4 }}>
            <button
              onClick={handleLeave}
              disabled={!canLeave || leaving}
              style={{ background: "none", border: "none", fontSize: 12, color: canLeave ? "#9ca3af" : "#d1d5db", cursor: canLeave ? "pointer" : "default", textDecoration: canLeave ? "underline" : "none" }}
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
