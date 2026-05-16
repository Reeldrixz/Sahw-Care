// TODO: Remove debug panel before production launch
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";

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
    completedBlocks: number; activityBlocks: number; signupBlocks: number; clickBlocks: number;
    listingBlocks: number; donationBlocks: number; // legacy aliases
    members: MissionMember[]; recentActions: RecentAction[];
  };
}

// ── Colour constants ───────────────────────────────────────────────────────────
const C = {
  purple:      "#6d5acd",
  purpleDark:  "#5a47b8",
  purpleLight: "#8b73e0",
  purplePale:  "#ede9ff",
  purplePaler: "#f5f3ff",
  purpleSoft:  "#d4cdf0",
  purpleTinted:"#c4b8e8",
  blockEmpty:  "#e8e4de",
  blockClick:  "#d4cfc8",
  blockListing:"#a8d4bf",
  blockDonation:"#1a7a5e",
  green:       "#1a7a5e",
  greenLight:  "#e8f5f0",
  cream:       "#faf8f3",
  white:       "#ffffff",
  text:        "#2a2a2a",
  textLight:   "#5a5a5a",
  muted:       "#8a8a8a",
  border:      "#ede8df",
};

// ── CSS ────────────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Nunito:wght@400;500;600;700&display=swap');

  .mission-page *, .mission-page *::before, .mission-page *::after { box-sizing: border-box; }

  .mission-page {
    font-family: 'Nunito', sans-serif;
    background: ${C.cream};
    min-height: 100vh;
    color: ${C.text};
    padding: 20px 16px 80px;
  }

  .mp-container { max-width: 1200px; margin: 0 auto; }

  .mp-back { background: none; border: none; cursor: pointer; color: ${C.purple};
    font-family: inherit; font-size: 13px; font-weight: 700; padding: 0;
    display: flex; align-items: center; gap: 5px; margin-bottom: 16px; }

  .page-header { margin-bottom: 24px; }
  .h-title { font-family: 'Lora', serif; font-size: 22px; font-weight: 700;
    letter-spacing: 1px; color: ${C.text}; text-transform: uppercase;
    display: flex; align-items: center; gap: 10px; }
  .h-title svg { width: 22px; height: 22px; stroke: ${C.purple}; stroke-width: 2; fill: none; }
  .h-sub { font-size: 14px; color: ${C.textLight}; margin-top: 6px; }
  .h-sub b { font-weight: 700; color: ${C.text}; }

  .main-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
  @media (min-width: 900px) {
    .main-grid { grid-template-columns: 1.1fr 0.85fr 0.95fr; align-items: start; }
  }

  /* ── Mission card ── */
  .mission-card { background: ${C.purple}; border-radius: 24px; padding: 24px 22px;
    color: white; position: relative; overflow: hidden; }
  .mc-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; }
  .mc-top-left { display: flex; align-items: center; gap: 12px; }
  .mc-avatar { width: 52px; height: 52px; border-radius: 50%; background: white;
    color: ${C.purple}; font-weight: 700; font-size: 20px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; border: 2px solid rgba(255,255,255,0.3); }
  .mc-progress-label { font-size: 16px; font-weight: 600; line-height: 1.2; }
  .mc-progress-date { font-size: 13px; opacity: 0.85; margin-top: 3px; }
  .mc-badge-stack { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .mc-gift { font-size: 22px; line-height: 1; }
  .mc-badge { background: rgba(255,255,255,0.18); border-radius: 6px; padding: 4px 10px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.8px; text-align: center; line-height: 1.3; }
  .mc-goal-label { font-size: 13px; opacity: 0.9; margin: 20px 0 4px; }
  .mc-goal-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 6px; }
  .mc-goal-text { flex: 1; }
  .mc-goal-bignum { font-family: 'Lora', serif; font-size: 56px; font-weight: 600;
    line-height: 1; display: inline-block; }
  .mc-goal-suffix { font-size: 14px; margin-left: 6px; display: inline-block;
    line-height: 1.3; max-width: 90px; vertical-align: bottom; }
  .mc-gift-illo { font-size: 64px; line-height: 1; margin-right: -8px; margin-bottom: 4px; transform: rotate(-6deg); }
  .mc-help-text { font-size: 13px; opacity: 0.92; margin-bottom: 14px; }

  .mc-mosaic { display: grid; grid-template-columns: repeat(14, 1fr); gap: 4px; margin-bottom: 22px; }
  .mc-mosaic .block { height: 14px; border-radius: 3px; }

  .mc-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0;
    margin-bottom: 18px; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 18px; }
  .mc-stat { text-align: center; position: relative; }
  .mc-stat + .mc-stat::before { content: ""; position: absolute; left: 0; top: 8px; bottom: 8px;
    width: 1px; background: rgba(255,255,255,0.15); }
  .mc-stat-num { font-family: 'Lora', serif; font-size: 32px; font-weight: 600; line-height: 1; }
  .mc-stat-label { font-size: 11px; opacity: 0.85; margin-top: 4px; margin-bottom: 8px; }
  .mc-stat-icon { width: 16px; height: 16px; stroke: white; stroke-width: 2; fill: none;
    opacity: 0.7; margin: 0 auto; display: block; }

  .mc-aff { background: rgba(255,255,255,0.14); border-radius: 14px; padding: 12px 14px;
    display: flex; align-items: center; gap: 10px; margin-bottom: 16px; font-size: 13px; line-height: 1.4; }
  .mc-aff-heart { width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.2);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 14px; }

  .mc-share { font-size: 12px; opacity: 0.9; margin-bottom: 8px; }
  .mc-share-row { display: flex; gap: 8px; background: rgba(255,255,255,0.14); border-radius: 12px;
    padding: 4px 4px 4px 14px; align-items: center; }
  .mc-share-input { flex: 1; background: transparent; border: none; color: white;
    font-family: inherit; font-size: 12px; outline: none; min-width: 0; }
  .mc-share-input::placeholder { color: rgba(255,255,255,0.6); }
  .mc-share-btn { background: white; color: ${C.purple}; border: none; padding: 8px 14px;
    border-radius: 9px; font-family: inherit; font-size: 12px; font-weight: 700; cursor: pointer;
    display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

  /* ── Info cards ── */
  .info-card { background: white; border-radius: 20px; padding: 22px 20px; border: 1px solid ${C.border}; }
  .ic-title { font-family: 'Lora', serif; font-size: 11px; font-weight: 700; letter-spacing: 1.2px;
    color: ${C.purple}; text-transform: uppercase; margin-bottom: 18px; }

  .hbf-row { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0;
    border-bottom: 1px solid ${C.border}; }
  .hbf-row:last-of-type { border-bottom: none; }
  .hbf-swatch { width: 22px; height: 22px; border-radius: 5px; flex-shrink: 0; margin-top: 2px; }
  .hbf-content { flex: 1; }
  .hbf-title { font-size: 14px; font-weight: 700; color: ${C.text}; line-height: 1.3; margin-bottom: 3px; }
  .hbf-desc { font-size: 12px; color: ${C.textLight}; line-height: 1.4; margin-bottom: 4px; }
  .hbf-blocks { font-size: 12px; color: ${C.green}; font-weight: 700; }

  .total-impact { margin-top: 20px; padding-top: 22px; border-top: 1px solid ${C.border}; text-align: center; }
  .ti-icon { width: 38px; height: 38px; border-radius: 50%; background: ${C.purplePaler};
    display: inline-flex; align-items: center; justify-content: center; margin-bottom: 10px; font-size: 18px; }
  .ti-label { font-size: 11px; font-weight: 700; letter-spacing: 1px; color: ${C.text};
    text-transform: uppercase; margin-bottom: 14px; }
  .ti-stats { display: grid; grid-template-columns: repeat(3, 1fr); margin: 10px 0 14px; }
  .ti-stat { text-align: center; }
  .ti-stat-num { font-family: 'Lora', serif; font-size: 26px; font-weight: 600; color: ${C.purple}; line-height: 1; }
  .ti-stat-label { font-size: 10px; color: ${C.textLight}; margin-top: 4px; line-height: 1.3; }
  .ti-tagline { font-family: 'Lora', serif; font-style: italic; font-size: 14px; color: ${C.text}; margin-top: 6px; }
  .ti-tagline-heart { color: ${C.purple}; }

  /* ── Partners ── */
  .partners-card .ic-subtitle { font-size: 12px; color: ${C.textLight}; margin-top: -12px; margin-bottom: 18px; line-height: 1.4; }
  .partner { padding: 14px 0; border-bottom: 1px solid ${C.border}; }
  .partner:last-of-type { border-bottom: none; }
  .partner-top { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .partner-avatar { width: 36px; height: 36px; border-radius: 50%; background: ${C.purplePale};
    color: ${C.purple}; font-weight: 700; font-size: 13px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .partner-info { flex: 1; }
  .partner-name { font-size: 13px; font-weight: 700; color: ${C.text}; line-height: 1.2; }
  .partner-goal { font-size: 11px; color: ${C.muted}; margin-top: 2px; }
  .partner-count { font-size: 12px; font-weight: 700; color: ${C.text}; }
  .partner-grid { display: grid; grid-template-columns: repeat(13, 1fr); gap: 3px; margin-bottom: 10px; }
  .partner-grid .pblock { height: 8px; border-radius: 2px; }
  .partner-stats { display: flex; gap: 12px; font-size: 11px; color: ${C.textLight}; align-items: center; }
  .pstat { display: flex; align-items: center; gap: 4px; }
  .pstat svg { width: 11px; height: 11px; stroke: ${C.muted}; stroke-width: 2; fill: none; }
  .pstat + .pstat::before { content: "|"; color: ${C.border}; margin-right: 8px; }
  .friends-line { display: flex; align-items: center; gap: 10px; margin-top: 16px; padding: 12px 14px;
    background: ${C.purplePaler}; border-radius: 12px; font-size: 12px; color: ${C.text}; line-height: 1.4; }
  .friends-icon { width: 26px; height: 26px; border-radius: 50%; background: white;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: ${C.purple}; }

  /* ── How it works ── */
  .how-it-works { margin-top: 32px; }
  .hiw-title { font-family: 'Lora', serif; font-size: 15px; font-weight: 700; letter-spacing: 2.5px;
    color: ${C.text}; text-transform: uppercase; text-align: center; margin-bottom: 24px; }
  .hiw-steps { display: grid; grid-template-columns: 1fr; gap: 14px; align-items: stretch; }
  @media (min-width: 768px) {
    .hiw-steps { grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr; }
  }
  .hiw-step { background: white; border: 1px solid ${C.border}; border-radius: 18px;
    padding: 18px 16px; display: flex; flex-direction: column; }
  .hiw-step-head { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
  .hiw-num { width: 26px; height: 26px; border-radius: 50%; background: ${C.purple}; color: white;
    font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .hiw-num-green { background: ${C.green}; }
  .hiw-step-name { font-size: 14px; font-weight: 700; color: ${C.text}; line-height: 1.3; flex: 1; }
  .hiw-icon-wrap { width: 100%; height: 80px; border-radius: 14px; background: ${C.purplePaler};
    display: flex; align-items: center; justify-content: center; margin-bottom: 14px; font-size: 32px; }
  .hiw-icon-green { background: ${C.greenLight}; }
  .hiw-desc { font-size: 12px; color: ${C.textLight}; line-height: 1.45; margin-bottom: 14px; flex: 1; }
  .hiw-mini-grid { display: grid; grid-template-columns: repeat(13, 1fr); gap: 2px; margin-bottom: 10px; }
  .hiw-mini-grid .miniblock { height: 10px; border-radius: 2px; }
  .hiw-blocks-label { font-size: 12px; font-weight: 700; color: ${C.purple}; text-align: left; }
  .hiw-blocks-label-green { color: ${C.green}; }
  .hiw-arrow { display: none; align-items: center; justify-content: center; color: ${C.muted}; font-size: 18px; }
  @media (min-width: 768px) { .hiw-arrow { display: flex; } }

  /* ── Bottom tagline ── */
  .bottom-tag { margin-top: 28px; background: white; border: 1px solid ${C.border}; border-radius: 16px;
    padding: 16px 20px; display: flex; align-items: center; justify-content: space-between;
    gap: 16px; flex-wrap: wrap; }
  .bt-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 280px; }
  .bt-avatar { width: 36px; height: 36px; border-radius: 50%; background: ${C.purplePale};
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 18px; }
  .bt-text { font-size: 13px; color: ${C.textLight}; line-height: 1.5; }
  .bt-text b { color: ${C.text}; font-weight: 700; }
  .bt-pill { background: ${C.purplePale}; color: ${C.purple}; padding: 10px 18px; border-radius: 24px;
    font-size: 13px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }

  /* ── Leave button ── */
  .leave-btn { background: none; border: none; font-family: inherit; font-size: 12px;
    color: #9ca3af; cursor: pointer; text-decoration: underline; display: block;
    margin: 12px auto 0; }
  .leave-btn:disabled { color: #d1d5db; cursor: default; text-decoration: none; }
  .leave-err { background: #fff5f5; border: 1px solid #fecaca; border-radius: 12px;
    padding: 10px 14px; margin-top: 10px; font-size: 13px; color: #dc2626; }

  /* ── Debug panel ── */
  .debug-panel { background: #fffbeb; border: 1px solid #fbbf24; border-radius: 14px;
    padding: 12px 16px; margin-bottom: 20px; font-family: 'Nunito', sans-serif; }
  .debug-summary { cursor: pointer; font-size: 13px; font-weight: 700; color: #92400e;
    user-select: none; display: flex; align-items: center; gap: 8px; list-style: none; }
  .debug-summary::-webkit-details-marker { display: none; }
  .debug-group-label { font-size: 10px; font-weight: 800; letter-spacing: 1px;
    text-transform: uppercase; margin-bottom: 6px; }
  .debug-btn { padding: 7px 13px; border-radius: 8px; border: 1px solid;
    font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 700;
    cursor: pointer; transition: opacity 0.15s; }
  .debug-btn:disabled { opacity: 0.45; cursor: default; }
`;

const BLOCK_SIGNUP = "#c8d8c8";

// Never renders in production even if accidentally left in
const SHOW_DEBUG_PANEL = process.env.NODE_ENV !== "production";

// Nominal blocks per action type (used for toast display)
const ACTION_BLOCKS: Record<string, number> = {
  click: 1, signup: 2, listing_posted: 2, register_committed: 2,
  listing_completed: 4, register_fulfilled: 4, bundle_delivered: 4,
};
// Net delta for upgrade-in-place types (prior intent was +2, upgrade adds +2 more)
const UPGRADE_DELTA: Record<string, number> = {
  listing_completed: 2,
  register_fulfilled: 2,
};

// ── Helper components ──────────────────────────────────────────────────────────
function MissionMosaic({ completed = 0, activity = 0, signups = 0, clicks = 0, total = 40 }: {
  completed: number; activity: number; signups: number; clicks: number; total: number;
}) {
  const blocks = [];
  for (let i = 0; i < total; i++) {
    let bg: string;
    if      (i < completed)                               bg = C.blockDonation;
    else if (i < completed + activity)                    bg = C.blockListing;
    else if (i < completed + activity + signups)          bg = BLOCK_SIGNUP;
    else if (i < completed + activity + signups + clicks) bg = C.blockClick;
    else                                                  bg = C.purpleTinted;
    blocks.push(<div key={i} className="block" style={{ background: bg }} />);
  }
  return <div className="mc-mosaic">{blocks}</div>;
}

function PartnerGrid({ completed = 0, activity = 0, clicks = 0 }: { completed: number; activity: number; clicks: number }) {
  const total = 26, ratio = 26 / 40;
  const d = Math.round(completed * ratio);
  const l = Math.round(activity  * ratio);
  const c = Math.round(clicks    * ratio);
  const blocks = [];
  for (let i = 0; i < total; i++) {
    let bg: string;
    if      (i < d)         bg = C.blockDonation;
    else if (i < d + l)     bg = C.blockListing;
    else if (i < d + l + c) bg = C.blockClick;
    else                    bg = C.blockEmpty;
    blocks.push(<div key={i} className="pblock" style={{ background: bg }} />);
  }
  return <div className="partner-grid">{blocks}</div>;
}

function StepMiniGrid({ completed = 0, activity = 0, clicks = 0 }: { completed: number; activity: number; clicks: number }) {
  const total = 26;
  const blocks = [];
  for (let i = 0; i < total; i++) {
    let bg: string;
    if      (i < completed)                    bg = C.blockDonation;
    else if (i < completed + activity)         bg = C.blockListing;
    else if (i < completed + activity + clicks) bg = C.blockClick;
    else                                       bg = C.blockEmpty;
    blocks.push(<div key={i} className="miniblock" style={{ background: bg }} />);
  }
  return <div className="hiw-mini-grid">{blocks}</div>;
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function MyMissionPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [data,     setData]     = useState<MissionData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [leaving,  setLeaving]  = useState(false);
  const [leaveErr, setLeaveErr] = useState<string | null>(null);
  const [copied,   setCopied]   = useState(false);

  // ── Debug panel state ──────────────────────────────────────────────────────
  const [lastListingRefId,  setLastListingRefId]  = useState<string | null>(null);
  const [lastRegisterRefId, setLastRegisterRefId] = useState<string | null>(null);
  const [debugCooldown,     setDebugCooldown]     = useState(false);
  const [debugToast, setDebugToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/missions/my");
    if (r.ok) { const d = await r.json(); setData(d.membership ?? null); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) { router.push("/auth"); return; }
    load();
  }, [user, load, router]);

  // ── Debug action trigger ───────────────────────────────────────────────────
  const fireDebugAction = useCallback(async (actionType: string) => {
    if (!data || debugCooldown) return;
    setDebugCooldown(true);
    setDebugToast(null);

    // Compute referenceId — upgrade types reuse the prior intent's id
    let refId: string;
    const ts = Date.now();
    if (actionType === "listing_posted") {
      refId = `debug-listing-${ts}`;
      setLastListingRefId(refId);
    } else if (actionType === "register_committed") {
      refId = `debug-register-${ts}`;
      setLastRegisterRefId(refId);
    } else if (actionType === "listing_completed") {
      refId = lastListingRefId ?? `debug-listing-${ts}`;
    } else if (actionType === "register_fulfilled") {
      refId = lastRegisterRefId ?? `debug-register-${ts}`;
    } else if (actionType === "bundle_delivered") {
      refId = `debug-bundle-${ts}`;
    } else {
      refId = `debug-${actionType.replace(/_/g, "-")}-${ts}`;
    }

    try {
      const res = await fetch("/api/missions/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: data.teamId,
          actionType,
          meta: { referenceId: refId },
        }),
      });

      if (res.ok) {
        const isUpgrade = actionType in UPGRADE_DELTA;
        const delta = isUpgrade ? UPGRADE_DELTA[actionType] : ACTION_BLOCKS[actionType] ?? "?";
        const suffix = isUpgrade ? " (upgraded prior)" : "";
        setDebugToast({ msg: `Action recorded: ${actionType} (+${delta} blocks${suffix})`, ok: true });
        await load();
      } else {
        const body = await res.json().catch(() => ({}));
        setDebugToast({ msg: body.error ?? "Request failed", ok: false });
      }
    } catch {
      setDebugToast({ msg: "Network error", ok: false });
    }

    setTimeout(() => setDebugCooldown(false), 500);
    setTimeout(() => setDebugToast(null), 4000);
  }, [data, debugCooldown, lastListingRefId, lastRegisterRefId, load]);

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

  const canLeave = new Date() < new Date(new Date().getFullYear(), new Date().getMonth(), 2);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ background: C.cream, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="spinner" />
    </div>
  );

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!data) return (
    <div style={{ background: C.cream, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: C.purple, marginBottom: 8 }}>No active mission</div>
        <div style={{ fontSize: 14, color: C.textLight, fontFamily: "Nunito, sans-serif", marginBottom: 24 }}>
          Join a collective challenge and help fund maternal essentials.
        </div>
        <button onClick={() => router.push("/missions")}
          style={{ background: C.purple, color: "white", border: "none", borderRadius: 14, padding: "14px 28px", fontFamily: "Nunito, sans-serif", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
          Browse missions
        </button>
      </div>
      <BottomNav />
    </div>
  );

  // ── Data mapping ─────────────────────────────────────────────────────────
  const { mission, team } = data;
  const goal = mission.goalBlocks;

  const [yearStr, monthStr] = mission.month.split("-");
  const monthNum  = parseInt(monthStr, 10);
  const yearNum   = parseInt(yearStr,  10);
  const monthDate = new Date(yearNum, monthNum - 1, 1);
  const monthLabel = monthDate.toLocaleString("en", { month: "long" });
  const lastDay    = new Date(yearNum, monthNum, 0).getDate();
  const dateRange  = `${monthLabel} 1 – ${monthLabel} ${lastDay}`;

  const categoryLabel = mission.category === "registers"  ? "Register Support"
    : mission.category === "postpartum" ? "Postpartum Support"
    : "Bundle Support";

  const me        = team.members.find(m => m.isMe);
  const meInitial = me ? me.name.trim().charAt(0).toUpperCase() : "?";

  const myActions = team.recentActions.filter(a => a.isMe);
  const myStats = {
    clicks:   myActions.filter(a => a.actionType === "click").length,
    activity: myActions.filter(a => ["listing_posted", "register_committed"].includes(a.actionType)).length,
    outcomes: myActions.filter(a => ["listing_completed", "register_fulfilled", "bundle_delivered"].includes(a.actionType)).length,
  };

  const mosaicCompleted = team.completedBlocks;
  const mosaicActivity  = team.activityBlocks;
  const mosaicSignups   = team.signupBlocks;
  const mosaicClicks    = team.clickBlocks;

  const partners = team.members
    .filter(m => !m.isMe)
    .map(partner => {
      const pa = team.recentActions.filter(a => a.userName === partner.name);
      const pCompleted = pa.filter(a => ["listing_completed","register_fulfilled","bundle_delivered"].includes(a.actionType)).reduce((s, a) => s + a.blocks, 0);
      const pActivity  = pa.filter(a => ["listing_posted","register_committed"].includes(a.actionType)).reduce((s, a) => s + a.blocks, 0);
      const pClkBlocks = pa.filter(a => a.actionType === "click").reduce((s, a) => s + a.blocks, 0);
      const pBlocks    = pa.reduce((s, a) => s + a.blocks, 0);
      return {
        initial: partner.name.trim().charAt(0).toUpperCase(),
        name: partner.name.split(" ")[0],
        goal, blocks: pBlocks, completed: pCompleted, activity: pActivity, clicks: pClkBlocks,
      };
    });

  const donationCount = Math.floor(team.completedBlocks / 4);
  const impact = {
    moms:   Math.max(donationCount, team.totalBlocks > 0 ? 1 : 0),
    items:  team.totalBlocks,
    cities: 12,
  };

  const shareUrl     = `kradel.com/missions?ref=${team.id}`;
  const fullShareUrl = `${typeof window !== "undefined" ? window.location.origin : "https://kradel.com"}/missions?ref=${team.id}`;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{styles}</style>
      <div className="mission-page">
        <div className="mp-container">

          {/* ── Admin debug panel — top of page, above everything ── */}
          {SHOW_DEBUG_PANEL && user?.role === "ADMIN" && (
            <details className="debug-panel">
              <summary className="debug-summary">
                🔧 Debug — Trigger mission actions
                <span style={{ fontWeight: 400, color: "#b45309", fontSize: 11, marginLeft: "auto" }}>
                  Admin only · Remove before launch
                </span>
              </summary>

              {/* Toast */}
              {debugToast && (
                <div style={{
                  margin: "10px 0 4px", padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: debugToast.ok ? "#f0fdf4" : "#fef2f2",
                  color:      debugToast.ok ? "#166534" : "#dc2626",
                  border:     `1px solid ${debugToast.ok ? "#bbf7d0" : "#fecaca"}`,
                }}>
                  {debugToast.msg}
                </div>
              )}

              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>

                {/* ── AWARENESS group ── */}
                <div>
                  <div className="debug-group-label" style={{ color: "#6b7280" }}>
                    Awareness
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="debug-btn"
                      onClick={() => fireDebugAction("click")}
                      disabled={debugCooldown}
                      style={{ background: "#f9fafb", borderColor: "#d1d5db", color: "#374151" }}
                    >
                      +1 Click
                    </button>
                    <button
                      className="debug-btn"
                      onClick={() => fireDebugAction("signup")}
                      disabled={debugCooldown}
                      style={{ background: "#f9fafb", borderColor: "#d1d5db", color: "#374151" }}
                    >
                      +2 Signup
                    </button>
                  </div>
                </div>

                {/* ── ACTIVITY group ── */}
                <div>
                  <div className="debug-group-label" style={{ color: "#166534" }}>
                    Activity — intent actions
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="debug-btn"
                      onClick={() => fireDebugAction("listing_posted")}
                      disabled={debugCooldown}
                      style={{ background: "#f0fdf4", borderColor: "#86efac", color: "#166534" }}
                      title="Stores refId for upgrade-in-place test"
                    >
                      +2 Listing Posted (Discover)
                    </button>
                    <button
                      className="debug-btn"
                      onClick={() => fireDebugAction("register_committed")}
                      disabled={debugCooldown}
                      style={{ background: "#f0fdf4", borderColor: "#86efac", color: "#166534" }}
                      title="Stores refId for upgrade-in-place test"
                    >
                      +2 Register Committed
                    </button>
                  </div>
                  {(lastListingRefId || lastRegisterRefId) && (
                    <div style={{ marginTop: 5, fontSize: 10, color: "#6b7280" }}>
                      {lastListingRefId  && <span>listing ref: <code style={{ fontSize: 10 }}>{lastListingRefId}</code></span>}
                      {lastListingRefId && lastRegisterRefId && " · "}
                      {lastRegisterRefId && <span>register ref: <code style={{ fontSize: 10 }}>{lastRegisterRefId}</code></span>}
                    </div>
                  )}
                </div>

                {/* ── OUTCOME group ── */}
                <div>
                  <div className="debug-group-label" style={{ color: C.green }}>
                    Outcome — completion / upgrade-in-place
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="debug-btn"
                      onClick={() => fireDebugAction("listing_completed")}
                      disabled={debugCooldown}
                      style={{ background: "#dcfce7", borderColor: "#4ade80", color: "#14532d" }}
                      title={lastListingRefId ? `Will upgrade row: ${lastListingRefId}` : "No prior listing_posted — fires as fresh"}
                    >
                      +2 Listing Completed {lastListingRefId ? "↑ upgrades prior" : "(no prior)"}
                    </button>
                    <button
                      className="debug-btn"
                      onClick={() => fireDebugAction("register_fulfilled")}
                      disabled={debugCooldown}
                      style={{ background: "#dcfce7", borderColor: "#4ade80", color: "#14532d" }}
                      title={lastRegisterRefId ? `Will upgrade row: ${lastRegisterRefId}` : "No prior register_committed — fires as fresh"}
                    >
                      +2 Register Fulfilled {lastRegisterRefId ? "↑ upgrades prior" : "(no prior)"}
                    </button>
                    <button
                      className="debug-btn"
                      onClick={() => fireDebugAction("bundle_delivered")}
                      disabled={debugCooldown}
                      style={{ background: "#bbf7d0", borderColor: "#22c55e", color: "#14532d", fontWeight: 800 }}
                    >
                      +4 Bundle Delivered (fresh)
                    </button>
                  </div>
                </div>

              </div>
            </details>
          )}

          {/* Back */}
          <button className="mp-back" onClick={() => router.back()}>← Back</button>

          {/* Header */}
          <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h1 className="h-title">
                YOUR MISSION
                <svg viewBox="0 0 24 24">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </h1>
              <div className="h-sub">You chose to support: <b>{categoryLabel}</b></div>
            </div>
            <button
              onClick={() => router.push(`/missions/${mission.id}/how-it-works`)}
              style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${C.purplePale}`, borderRadius: 20, padding: "6px 12px", cursor: "pointer", color: C.purple, fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, marginTop: 4, whiteSpace: "nowrap" }}
            >
              <span style={{ fontSize: 13 }}>ℹ️</span> How it works
            </button>
          </div>

          {/* 3-column grid */}
          <div className="main-grid">

            {/* === Col 1: Mission Card === */}
            <div className="mission-card">
              <div className="mc-top">
                <div className="mc-top-left">
                  <div className="mc-avatar">{meInitial}</div>
                  <div>
                    <div className="mc-progress-label">Your Mission Progress</div>
                    <div className="mc-progress-date">{dateRange}</div>
                  </div>
                </div>
                <div className="mc-badge-stack">
                  <div className="mc-gift">🎁</div>
                  <div className="mc-badge">{categoryLabel.toUpperCase()}</div>
                </div>
              </div>

              <div className="mc-goal-label">Monthly Goal</div>
              <div className="mc-goal-row">
                <div className="mc-goal-text">
                  <span className="mc-goal-bignum">{goal}</span>
                  <span className="mc-goal-suffix">maternity<br/>essentials</span>
                </div>
                <div className="mc-gift-illo">🎁</div>
              </div>

              <div className="mc-help-text">40 maternal essentials. Real items. Real mothers. This month.</div>

              <MissionMosaic completed={mosaicCompleted} activity={mosaicActivity} signups={mosaicSignups} clicks={mosaicClicks} total={goal} />

              <div className="mc-stats">
                <div className="mc-stat">
                  <div className="mc-stat-num">{myStats.clicks}</div>
                  <div className="mc-stat-label">Clicks</div>
                  <svg className="mc-stat-icon" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                  </svg>
                </div>
                <div className="mc-stat">
                  <div className="mc-stat-num">{myStats.activity}</div>
                  <div className="mc-stat-label">Activities</div>
                  <svg className="mc-stat-icon" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="8" y="4" width="8" height="4" rx="1"/>
                    <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
                  </svg>
                </div>
                <div className="mc-stat">
                  <div className="mc-stat-num">{myStats.outcomes}</div>
                  <div className="mc-stat-label">Fulfilled</div>
                  <svg className="mc-stat-icon" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M8 12l3 3 5-6"/>
                  </svg>
                </div>
              </div>

              <div className="mc-aff">
                <div className="mc-aff-heart">💜</div>
                <div>Every action brings us closer to supporting more moms.</div>
              </div>

              <div className="mc-share">Share your link. Every new member helps Kradel reach one more mother.</div>
              <div className="mc-share-row">
                <span style={{ color: "rgba(255,255,255,0.7)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                  </svg>
                </span>
                <input className="mc-share-input" readOnly value={shareUrl} />
                <button className="mc-share-btn" onClick={() => handleCopy(fullShareUrl)}>
                  {copied ? "Copied ✓" : <>Share <span style={{ fontSize: 14 }}>↑</span></>}
                </button>
              </div>
            </div>

            {/* === Col 2: How Bar Fills + Total Impact === */}
            <div className="info-card">
              <div className="ic-title">HOW YOUR BAR FILLS</div>

              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>AWARENESS</div>
              <div className="hbf-row">
                <div className="hbf-swatch" style={{ background: C.blockClick }} />
                <div className="hbf-content">
                  <div className="hbf-title">Link clicked</div>
                  <div className="hbf-desc">Someone clicks your shared Kradel link.</div>
                  <div className="hbf-blocks">+1 block</div>
                </div>
              </div>
              <div className="hbf-row">
                <div className="hbf-swatch" style={{ background: BLOCK_SIGNUP }} />
                <div className="hbf-content">
                  <div className="hbf-title">Account created</div>
                  <div className="hbf-desc">They sign up through your link.</div>
                  <div className="hbf-blocks">+2 blocks</div>
                </div>
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", color: C.muted, textTransform: "uppercase", marginBottom: 6, marginTop: 14 }}>ACTIVITY</div>
              <div className="hbf-row">
                <div className="hbf-swatch" style={{ background: C.blockListing }} />
                <div className="hbf-content">
                  <div className="hbf-title">Item listed or register committed</div>
                  <div className="hbf-desc">They list an item to donate or commit to a register.</div>
                  <div className="hbf-blocks">+2 blocks</div>
                </div>
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", color: C.muted, textTransform: "uppercase", marginBottom: 6, marginTop: 14 }}>OUTCOME</div>
              <div className="hbf-row" style={{ borderBottom: "none" }}>
                <div className="hbf-swatch" style={{ background: C.blockDonation }} />
                <div className="hbf-content">
                  <div className="hbf-title">Mom received essentials</div>
                  <div className="hbf-desc">A request is fulfilled, listing completed, or bundle delivered.</div>
                  <div className="hbf-blocks">+4 blocks</div>
                </div>
              </div>

              <div className="total-impact">
                <div className="ti-icon">👥</div>
                <div className="ti-label">TOTAL IMPACT THIS MONTH</div>
                <div className="ti-stats">
                  <div className="ti-stat">
                    <div className="ti-stat-num">{impact.moms}</div>
                    <div className="ti-stat-label">Moms<br/>Supported</div>
                  </div>
                  <div className="ti-stat">
                    <div className="ti-stat-num">{impact.items}</div>
                    <div className="ti-stat-label">Essentials<br/>Delivered</div>
                  </div>
                  <div className="ti-stat">
                    <div className="ti-stat-num">{impact.cities}</div>
                    <div className="ti-stat-label">Cities<br/>Reached</div>
                  </div>
                </div>
                <div className="ti-tagline">Together, we care. <span className="ti-tagline-heart">💜</span></div>
              </div>
            </div>

            {/* === Col 3: Mission Partners === */}
            <div className="info-card partners-card">
              <div className="ic-title">OTHER MISSION PARTNERS</div>
              <div className="ic-subtitle">People supporting the same mission this month.</div>

              {partners.length === 0 ? (
                <div style={{ fontSize: 13, color: C.muted, padding: "12px 0" }}>
                  No other members yet. Share your link to grow the team!
                </div>
              ) : partners.map((p, i) => (
                <div key={i} className="partner">
                  <div className="partner-top">
                    <div className="partner-avatar">{p.initial}</div>
                    <div className="partner-info">
                      <div className="partner-name">{p.name}</div>
                      <div className="partner-goal">Goal: {p.goal} essentials</div>
                    </div>
                    <div className="partner-count">{p.blocks} / {p.goal}</div>
                  </div>
                  <PartnerGrid completed={p.completed} activity={p.activity} clicks={p.clicks} />
                  <div className="partner-stats">
                    <div className="pstat">
                      <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                      </svg>
                      {p.clicks}
                    </div>
                    <div className="pstat">
                      <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="8" y="4" width="8" height="4" rx="1"/>
                        <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/>
                      </svg>
                      {p.activity}
                    </div>
                    <div className="pstat">
                      <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9"/>
                        <path d="M8 12l3 3 5-6"/>
                      </svg>
                      {p.completed}
                    </div>
                  </div>
                </div>
              ))}

              <div className="friends-line">
                <div className="friends-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                    <path d="M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                </div>
                <div>{partners.length} friends. 1 mission.<br/>More love. More impact.</div>
              </div>
            </div>

          </div>

          {/* How It Works */}
          <div className="how-it-works">
            <h2 className="hiw-title">HOW IT WORKS</h2>
            <div className="hiw-steps">
              <div className="hiw-step">
                <div className="hiw-step-head">
                  <div className="hiw-num">1</div>
                  <div className="hiw-step-name">Someone clicks your link</div>
                </div>
                <div className="hiw-icon-wrap">✈️</div>
                <div className="hiw-desc">You share on social media. They click.</div>
                <StepMiniGrid completed={0} activity={0} clicks={1} />
                <div className="hiw-blocks-label">+1 block</div>
              </div>

              <div className="hiw-arrow">→</div>

              <div className="hiw-step">
                <div className="hiw-step-head">
                  <div className="hiw-num">2</div>
                  <div className="hiw-step-name">They create a listing</div>
                </div>
                <div className="hiw-icon-wrap hiw-icon-green">📋</div>
                <div className="hiw-desc">They sign up and create a listing (register or discover).</div>
                <StepMiniGrid completed={0} activity={2} clicks={1} />
                <div className="hiw-blocks-label hiw-blocks-label-green">+2 blocks</div>
              </div>

              <div className="hiw-arrow">→</div>

              <div className="hiw-step">
                <div className="hiw-step-head">
                  <div className="hiw-num hiw-num-green">3</div>
                  <div className="hiw-step-name">They fulfill a request or donate</div>
                </div>
                <div className="hiw-icon-wrap hiw-icon-green">💚</div>
                <div className="hiw-desc">They fulfill a request or complete a donation on Kradel.</div>
                <StepMiniGrid completed={4} activity={2} clicks={1} />
                <div className="hiw-blocks-label hiw-blocks-label-green">+4 blocks</div>
              </div>

              <div className="hiw-arrow">→</div>

              <div className="hiw-step">
                <div className="hiw-step-head">
                  <div className="hiw-num">4</div>
                  <div className="hiw-step-name">Mission complete!</div>
                </div>
                <div className="hiw-icon-wrap">🎉</div>
                <div className="hiw-desc">Together, you reached your monthly goal.</div>
                <StepMiniGrid completed={13} activity={8} clicks={5} />
                <div className="hiw-blocks-label">Goal Achieved 💜</div>
              </div>
            </div>
          </div>

          {/* Bottom tagline */}
          <div className="bottom-tag">
            <div className="bt-left">
              <div className="bt-avatar">🤱🏽</div>
              <div className="bt-text">
                Every click. Every listing. Every act of care. <b>It all adds up to change a mom&rsquo;s life.</b>
              </div>
            </div>
            <div className="bt-pill">Thank you for being part of the change 💜</div>
          </div>

          {/* Leave mission */}
          {leaveErr && <div className="leave-err">{leaveErr}</div>}
          <button className="leave-btn" onClick={handleLeave} disabled={!canLeave || leaving}>
            {leaving ? "Leaving…" : canLeave ? "Leave this mission" : "Leaving closes after the 1st of the month"}
          </button>

        </div>
      </div>
      <BottomNav />
    </>
  );
}
