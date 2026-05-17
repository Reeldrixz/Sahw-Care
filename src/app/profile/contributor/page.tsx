"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";

// ── types ──────────────────────────────────────────────────────────────────

interface Identity {
  name: string;
  avatar: string | null;
  location: string | null;
  bio: string | null;
  careContributorSince: string | null;
  isVerified: boolean;
}

interface Stats {
  mothersSupported: number;
  essentialsDelivered: number;
  bundlesSupported: number;
  peopleReached: number;
}

interface CurrentMission {
  name: string;
  month: string;
  teamId: string;
  totalBlocks: number;
  goalBlocks: number;
  myBlocks: number;
  memberCount: number;
  isComplete: boolean;
}

interface PastMission {
  id: string;
  missionName: string;
  month: string;
  teamBlocks: number;
  goalBlocks: number;
  myBlocks: number;
  isComplete: boolean;
  joinedAt: string;
}

interface ContributorData {
  hasMembership: boolean;
  hasActions: boolean;
  identity?: Identity;
  stats?: Stats;
  currentMission?: CurrentMission | null;
  pastMissions?: PastMission[];
  essentialsDeliveredThisMonth?: number;
}

// ── design tokens ──────────────────────────────────────────────────────────

const C = {
  green:      "#1a7a5e",
  greenLight: "#e8f5f0",
  greenMid:   "#a8d4bf",
  purple:     "#6d5acd",
  purplePale: "#f5f3ff",
  cream:      "#faf8f3",
  white:      "#ffffff",
  text:       "#2a2a2a",
  mid:        "#5a5a5a",
  muted:      "#8a8a8a",
  border:     "#ede8df",
};

// ── styles ─────────────────────────────────────────────────────────────────

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Nunito:wght@400;600;700;800&display=swap');
  .cp2 *, .cp2 *::before, .cp2 *::after { box-sizing: border-box; }
  .cp2 {
    font-family: 'Nunito', sans-serif;
    background: #faf8f3;
    min-height: 100vh;
    color: #2a2a2a;
    padding: 0 0 100px;
  }

  /* outer wrapper — mobile: single column, desktop: expands for grid */
  .cp2-outer { max-width: 640px; margin: 0 auto; padding: 16px 16px; }

  /* two-column grid layout */
  .cp2-layout { display: flex; flex-direction: column; }
  .cp2-left   { display: flex; flex-direction: column; }
  .cp2-right  { display: flex; flex-direction: column; }
  .cp2-share-row { /* sits after both columns on mobile, spans both on desktop */ }

  @media (min-width: 1024px) {
    .cp2-outer { max-width: 1100px; }
    .cp2-layout {
      display: grid;
      grid-template-columns: 1fr 360px;
      grid-template-areas: "left right" "share share";
      gap: 24px;
      align-items: start;
    }
    .cp2-left      { grid-area: left; }
    .cp2-right     { grid-area: right; }
    .cp2-share-row { grid-area: share; }
  }

  /* cards */
  .cp2-card {
    background: white; border-radius: 22px; border: 1px solid #ede8df;
    padding: 18px 16px; margin-bottom: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.04);
    position: relative; overflow: hidden;
  }

  /* labels */
  .cp2-label {
    font-family: 'Nunito', sans-serif; font-size: 10px; font-weight: 800;
    letter-spacing: 1.6px; text-transform: uppercase; color: #6d5acd; margin-bottom: 12px;
  }
  .cp2-label-green { color: #1a7a5e; }

  /* scrollable rows */
  .cp2-stats-scroll {
    display: flex; gap: 8px; overflow-x: auto;
    scrollbar-width: none; -ms-overflow-style: none; padding-bottom: 2px;
  }
  .cp2-stats-scroll::-webkit-scrollbar { display: none; }
  .cp2-hist-scroll {
    display: flex; gap: 12px; overflow-x: auto;
    scrollbar-width: none; -ms-overflow-style: none; padding-bottom: 4px;
  }
  .cp2-hist-scroll::-webkit-scrollbar { display: none; }

  /* edit modal inputs */
  .cp2-textarea {
    width: 100%; border: 1.5px solid #ede8df; border-radius: 14px;
    padding: 12px 14px; font-family: 'Nunito', sans-serif; font-size: 14px;
    color: #2a2a2a; background: #faf8f3; resize: none; outline: none;
    transition: border-color 0.2s;
  }
  .cp2-textarea:focus { border-color: #6d5acd; background: white; }
  .cp2-input {
    width: 100%; border: 1.5px solid #ede8df; border-radius: 14px;
    padding: 12px 14px; font-family: 'Nunito', sans-serif; font-size: 14px;
    color: #2a2a2a; background: #faf8f3; outline: none;
    transition: border-color 0.2s;
  }
  .cp2-input:focus { border-color: #6d5acd; background: white; }
`;

// ── helpers ────────────────────────────────────────────────────────────────

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleString("en", { month: "long", year: "numeric" });
}

function formatSince(date: string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleString("en", { month: "long", year: "numeric" });
}

// ── shared sub-components ──────────────────────────────────────────────────

const CARE_GOAL = 40;

function CareGrid({ essentials }: { essentials: number }) {
  const filled   = Math.min(essentials, CARE_GOAL);
  const overflow = Math.max(0, essentials - CARE_GOAL);
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4, margin: "10px 0" }}>
        {Array.from({ length: CARE_GOAL }, (_, i) => (
          <div key={i} style={{ aspectRatio: "1", borderRadius: 4, background: i < filled ? C.green : "#f0ebe3" }} />
        ))}
      </div>
      {overflow > 0 && (
        <div style={{ fontSize: 11, color: C.green, fontFamily: "Nunito, sans-serif", fontWeight: 700, marginTop: 2 }}>
          + {overflow} more essential{overflow !== 1 ? "s" : ""} delivered this month
        </div>
      )}
    </>
  );
}

function PreviewCareRow({ essentials }: { essentials: number }) {
  const CELLS  = 13;
  const filled = Math.min(CELLS, Math.round((Math.min(essentials, CARE_GOAL) / CARE_GOAL) * CELLS));
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {Array.from({ length: CELLS }, (_, i) => (
        <div key={i} style={{ height: 6, borderRadius: 2, background: i < filled ? C.green : C.border, flex: 1 }} />
      ))}
    </div>
  );
}

function StatTile({ emoji, count, label, bg, color }: {
  emoji: string; count: number; label: string; bg: string; color: string;
}) {
  return (
    <div style={{
      flex: "0 0 auto", minWidth: 72, textAlign: "center",
      background: "white", borderRadius: 16, padding: "12px 8px",
      border: `1px solid ${C.border}`,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%", background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, margin: "0 auto 7px",
      }}>
        {emoji}
      </div>
      <div style={{ fontFamily: "Lora, serif", fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>
        {count}
      </div>
      <div style={{ fontSize: 10, color: C.mid, marginTop: 4, lineHeight: 1.3 }}>
        {label}
      </div>
    </div>
  );
}

function PastMissionCard({ m }: { m: PastMission }) {
  return (
    <div style={{
      minWidth: 144, background: "white", border: `1px solid ${C.border}`,
      borderRadius: 20, padding: "14px 12px", flexShrink: 0, textAlign: "center",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>
        {formatMonth(m.month)}
      </div>
      <div style={{ fontFamily: "Lora, serif", fontSize: 12, fontWeight: 700, color: C.text, lineHeight: 1.3, marginBottom: 10, minHeight: 32 }}>
        {m.missionName}
      </div>
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        background: m.isComplete ? C.greenLight : "#f0ebff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 24, margin: "0 auto 10px",
      }}>
        {m.isComplete ? "🌟" : "🎯"}
      </div>
      <div style={{
        display: "inline-block",
        background: m.isComplete ? C.greenLight : C.purplePale,
        color: m.isComplete ? C.green : C.purple,
        border: `1px solid ${m.isComplete ? "#b7dfd1" : "#d8d0f5"}`,
        borderRadius: 20, padding: "3px 10px",
        fontFamily: "Nunito, sans-serif", fontSize: 10, fontWeight: 800,
      }}>
        {m.isComplete ? "✓ Completed" : `${m.myBlocks} blocks`}
      </div>
    </div>
  );
}

// ── right-column components ────────────────────────────────────────────────

const VALUE_PROPS = [
  { emoji: "👤", bg: "#e8f5f0", title: "Showcase Your Impact",  desc: "Highlight the moms you've supported and the change you've helped create." },
  { emoji: "👥", bg: "#f5f3ff", title: "Inspire Others",        desc: "Your journey can motivate others to take action and get involved." },
  { emoji: "💚", bg: "#fce8e8", title: "Build Your Legacy",     desc: "A meaningful record of your contributions to the community." },
  { emoji: "🛡️", bg: "#fff3e0", title: "Verified & Trusted",   desc: "Kradel verifies your impact to keep it real and trustworthy." },
];

function WhyThisProfileMatters() {
  return (
    <div className="cp2-card">
      <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16 }}>
        Why this profile matters
      </div>
      {VALUE_PROPS.map((vp, i) => (
        <div key={i} style={{
          display: "flex", gap: 12, alignItems: "flex-start",
          paddingBottom: i < VALUE_PROPS.length - 1 ? 14 : 0,
          borderBottom: i < VALUE_PROPS.length - 1 ? `1px solid ${C.border}` : "none",
          marginBottom: i < VALUE_PROPS.length - 1 ? 14 : 0,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%", background: vp.bg, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}>
            {vp.emoji}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 2 }}>
              {vp.title}
            </div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: C.mid, lineHeight: 1.5 }}>
              {vp.desc}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ShareablePreview({ identity, stats, currentMission, essentials, onShare }: {
  identity: Identity;
  stats: Stats;
  currentMission: CurrentMission | null;
  essentials: number;
  onShare: () => void;
}) {
  const avatarInitial = identity.name?.charAt(0).toUpperCase() ?? "?";

  const PREVIEW_STATS = [
    { emoji: "👥", count: stats.mothersSupported,    bg: "#e8f5f0",    color: C.green   },
    { emoji: "🎁", count: stats.essentialsDelivered, bg: "#eaf5f2",    color: "#2a8c6e" },
    { emoji: "💝", count: stats.bundlesSupported,    bg: "#fce8e8",    color: "#c4585a" },
    { emoji: "📣", count: stats.peopleReached,       bg: C.purplePale, color: C.purple  },
  ];

  const SOCIAL = [
    { label: "W",  bg: "#dcfce7", color: "#16a34a", name: "WhatsApp"  },
    { label: "Ig", bg: "#fce7f3", color: "#be185d", name: "Instagram" },
    { label: "f",  bg: "#dbeafe", color: "#1d4ed8", name: "Facebook"  },
    { label: "𝕏",  bg: "#f3f4f6", color: "#374151", name: "X"         },
    { label: "in", bg: "#e0f2fe", color: "#0369a1", name: "LinkedIn"  },
  ];

  return (
    <div className="cp2-card">
      <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 14 }}>
        Your Profile is Shareable
      </div>

      {/* inner snapshot preview */}
      <div style={{
        border: `1.5px solid ${C.border}`, borderRadius: 18,
        padding: "14px 12px", background: C.cream, marginBottom: 14,
      }}>
        {/* avatar + name row */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
            background: identity.avatar ? "transparent" : `linear-gradient(135deg, ${C.purple}, #9b7fe8)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", border: `2px solid ${C.purplePale}`,
          }}>
            {identity.avatar
              ? <img src={identity.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: "white" }}>{avatarInitial}</span>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>
              {identity.name}
              {identity.isVerified && <span style={{ color: C.green, fontSize: 12 }}> ✓</span>}
            </div>
            <div style={{ fontSize: 10, color: C.muted, fontFamily: "Nunito, sans-serif", marginTop: 2 }}>
              Care Contributor{identity.location ? ` · ${identity.location}` : ""}
            </div>
          </div>
        </div>

        {/* 4-stat mini row */}
        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
          {PREVIEW_STATS.map((s, i) => (
            <div key={i} style={{
              flex: 1, textAlign: "center", padding: "6px 2px",
              background: "white", borderRadius: 10, border: `1px solid ${C.border}`,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", background: s.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, margin: "0 auto 3px",
              }}>
                {s.emoji}
              </div>
              <div style={{ fontFamily: "Lora, serif", fontSize: 13, fontWeight: 700, color: s.color, lineHeight: 1 }}>
                {s.count}
              </div>
            </div>
          ))}
        </div>

        {/* care delivered mini */}
        {currentMission && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: C.muted, fontFamily: "Nunito, sans-serif", marginBottom: 5 }}>
              Active in <span style={{ color: C.purple, fontWeight: 700 }}>{currentMission.name}</span>
              {essentials > 0 && <span style={{ color: C.green, fontWeight: 700, marginLeft: 6 }}>· {essentials} essential{essentials !== 1 ? "s" : ""} delivered</span>}
            </div>
            <PreviewCareRow essentials={essentials} />
          </div>
        )}

        {/* preview footer */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 16, height: 16, borderRadius: "50%", background: C.purple,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, color: "white", fontWeight: 800, fontFamily: "Nunito, sans-serif",
          }}>K</div>
          <div style={{ fontFamily: "Lora, serif", fontStyle: "italic", fontSize: 11, color: C.muted }}>
            Care moves everything.
          </div>
        </div>
      </div>

      {/* caption — NO permanent URL, NO copy button */}
      <div style={{
        fontSize: 12, color: C.mid, fontFamily: "Nunito, sans-serif",
        lineHeight: 1.65, marginBottom: 16,
      }}>
        <strong style={{ color: C.text }}>Tap Share My Profile</strong> to generate a private link to this snapshot. The link expires in 30 days and only shows what you see here.
      </div>

      {/* social platform icons — visual share intent indicators */}
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        {SOCIAL.map((p) => (
          <button
            key={p.name}
            onClick={onShare}
            title={`Share via ${p.name}`}
            style={{
              width: 40, height: 40, borderRadius: "50%",
              background: p.bg, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 12,
              color: p.color, flexShrink: 0,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ClosingCard() {
  return (
    <div className="cp2-card" style={{ background: C.purplePale, border: "1px solid #d8d0f5", overflow: "hidden" }}>
      {/* decorative leaf */}
      <div style={{
        position: "absolute", bottom: -10, left: -6, fontSize: 52,
        opacity: 0.14, transform: "rotate(-15deg)", pointerEvents: "none",
      }}>🌿</div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", position: "relative", zIndex: 1 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "Lora, serif", fontStyle: "italic",
            fontSize: 16, color: C.purple, lineHeight: 1.7,
          }}>
            You&rsquo;re not just contributing.{" "}
            <span style={{ fontWeight: 700 }}>
              You&rsquo;re building a better future for mothers and babies. Thank you.
            </span>
          </div>
        </div>
        <div style={{
          fontSize: 52, flexShrink: 0, opacity: 0.5, lineHeight: 1,
        }}>
          💜
        </div>
      </div>
    </div>
  );
}

// ── edit modal ─────────────────────────────────────────────────────────────

function EditModal({ identity, onClose, onSaved }: {
  identity: Identity;
  onClose: () => void;
  onSaved: (bio: string | null, location: string | null) => void;
}) {
  const [bio,      setBio]      = useState(identity.bio ?? "");
  const [location, setLocation] = useState(identity.location ?? "");
  const [saving,   setSaving]   = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ bio: bio || null, location: location || null }),
      });
      onSaved(bio || null, location || null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000,
      display: "flex", alignItems: "flex-end",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: "100%", background: "white", borderRadius: "24px 24px 0 0",
        padding: "24px 20px 44px", maxHeight: "85vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700 }}>Edit Profile</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.muted }}>✕</button>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: C.purple, marginBottom: 8 }}>
            Why I Support
          </div>
          <textarea
            className="cp2-textarea"
            rows={4}
            maxLength={250}
            placeholder="Share why you care about supporting mothers…"
            value={bio}
            onChange={e => setBio(e.target.value)}
          />
          <div style={{ fontSize: 11, color: C.muted, textAlign: "right", marginTop: 4 }}>
            {bio.length}/250
          </div>
        </div>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: C.purple, marginBottom: 8 }}>
            Location
          </div>
          <input
            className="cp2-input"
            type="text"
            placeholder="City, Country"
            value={location}
            onChange={e => setLocation(e.target.value)}
          />
        </div>

        <button
          onClick={save}
          disabled={saving}
          style={{
            width: "100%", background: C.purple, color: "white", border: "none",
            borderRadius: 16, padding: "15px 0", fontFamily: "Nunito, sans-serif",
            fontSize: 15, fontWeight: 800, cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────

export default function ContributorPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [data,      setData]      = useState<ContributorData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState(false);
  const [sharing,   setSharing]   = useState(false);
  const [shareDone, setShareDone] = useState(false);

  const fetchData = useCallback(() => {
    fetch("/api/profile/contributor")
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) { router.push("/auth"); return; }
    fetchData();
  }, [user, router, fetchData]);

  if (!user) return null;

  if (loading) return (
    <div className="cp2" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <style>{styles}</style>
      <div className="spinner" />
    </div>
  );

  // ── never joined any mission ───────────────────────────────────────────
  if (!data || !data.hasMembership) return (
    <>
      <style>{styles}</style>
      <div className="cp2">
        <div style={{ background: "white", borderBottom: `1px solid ${C.border}`, padding: "12px 16px 14px", position: "relative" }}>
          <button onClick={() => router.back()} style={{
            position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
            width: 36, height: 36, borderRadius: "50%", background: C.cream,
            border: "none", fontSize: 18, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>←</button>
          <div style={{ textAlign: "center", paddingLeft: 44, paddingRight: 44 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: C.text }}>
              Care Contributor Profile
            </div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: C.muted, marginTop: 2 }}>
              Your actions. Real change. 💜
            </div>
          </div>
        </div>
        <div className="cp2-outer" style={{ textAlign: "center", paddingTop: 64 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌱</div>
          <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: C.purple, marginBottom: 8 }}>
            Your contributor profile is waiting
          </div>
          <div style={{ fontSize: 14, color: C.mid, lineHeight: 1.7, marginBottom: 28 }}>
            Join a mission to unlock your Care Contributor profile and start tracking your real-world impact.
          </div>
          <button onClick={() => router.push("/missions")} style={{
            background: C.purple, color: "white", border: "none", borderRadius: 14,
            padding: "14px 28px", fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 800, cursor: "pointer",
          }}>
            Browse missions
          </button>
        </div>
        <BottomNav />
      </div>
    </>
  );

  // ── full profile ───────────────────────────────────────────────────────

  const identity       = data.identity!;
  const stats          = data.stats ?? { mothersSupported: 0, essentialsDelivered: 0, bundlesSupported: 0, peopleReached: 0 };
  const currentMission = data.currentMission ?? null;
  const pastMissions   = data.pastMissions   ?? [];
  const essentials     = data.essentialsDeliveredThisMonth ?? 0;
  const avatarInitial  = identity.name?.charAt(0).toUpperCase() ?? "?";
  const teammates      = Math.max(0, (currentMission?.memberCount ?? 1) - 1);

  async function handleShare() {
    setSharing(true);
    try {
      const res = await fetch("/api/profile/contributor/share", { method: "POST" });
      const { url } = await res.json();
      const fullUrl = `${window.location.origin}${url}`;
      if (navigator.share) {
        await navigator.share({ title: `${identity.name}'s Care Contributor Profile`, url: fullUrl });
      } else {
        await navigator.clipboard.writeText(fullUrl);
        setShareDone(true);
        setTimeout(() => setShareDone(false), 2500);
      }
    } catch { /* dismissed */ } finally {
      setSharing(false);
    }
  }

  function handleSaved(bio: string | null, location: string | null) {
    setEditing(false);
    setData(prev => prev?.identity ? { ...prev, identity: { ...prev.identity, bio, location } } : prev);
  }

  return (
    <>
      <style>{styles}</style>
      <div className="cp2">

        {/* ── header ── */}
        <div style={{
          background: "white", borderBottom: `1px solid ${C.border}`,
          padding: "12px 16px 14px", position: "relative",
        }}>
          <button onClick={() => router.back()} style={{
            position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
            width: 36, height: 36, borderRadius: "50%", background: C.cream,
            border: "none", fontSize: 18, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>←</button>
          <div style={{ textAlign: "center", paddingLeft: 48, paddingRight: 48 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>
              Care Contributor Profile
            </div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: C.muted, marginTop: 2 }}>
              Your actions. Real change. 💜
            </div>
          </div>
        </div>

        {/* ── outer: two-column layout on desktop ── */}
        <div className="cp2-outer">
          <div className="cp2-layout">

            {/* ════ LEFT COLUMN ════ */}
            <div className="cp2-left">

              {/* identity card */}
              <div className="cp2-card" style={{ padding: "16px" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  {/* avatar + verify badge */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{
                      width: 84, height: 84, borderRadius: "50%",
                      background: identity.avatar ? "transparent" : `linear-gradient(135deg, ${C.purple}, #9b7fe8)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      overflow: "hidden", border: `3px solid ${C.purplePale}`,
                    }}>
                      {identity.avatar
                        ? <img src={identity.avatar} alt={identity.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ fontFamily: "Lora, serif", fontSize: 32, fontWeight: 700, color: "white" }}>{avatarInitial}</span>
                      }
                    </div>
                    {identity.isVerified && (
                      <div style={{
                        position: "absolute", bottom: 2, right: 2,
                        width: 20, height: 20, borderRadius: "50%",
                        background: C.green, border: "2px solid white",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, color: "white", fontWeight: 800,
                      }}>✓</div>
                    )}
                  </div>

                  {/* right side */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 19, fontWeight: 700, color: C.text, lineHeight: 1.2, flex: 1, marginRight: 8 }}>
                        {identity.name}
                        {identity.isVerified && <span style={{ color: C.green, fontSize: 13 }}> ✓</span>}
                      </div>
                      <button onClick={() => setEditing(true)} style={{
                        flexShrink: 0, background: C.purplePale, color: C.purple, border: "none",
                        borderRadius: 20, padding: "5px 12px",
                        fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 800, cursor: "pointer",
                      }}>
                        Edit
                      </button>
                    </div>

                    {identity.careContributorSince && (
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: "Nunito, sans-serif", marginBottom: 3 }}>
                        Care Contributor since {formatSince(identity.careContributorSince)}
                      </div>
                    )}

                    {identity.location && (
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: "Nunito, sans-serif", marginBottom: 7 }}>
                        📍 {identity.location}
                      </div>
                    )}

                    {identity.bio ? (
                      <div style={{ fontFamily: "Lora, serif", fontStyle: "italic", fontSize: 13, color: C.mid, lineHeight: 1.55, marginBottom: 10 }}>
                        &ldquo;{identity.bio}&rdquo;
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: "Nunito, sans-serif", marginBottom: 10 }}>
                        <button onClick={() => setEditing(true)} style={{ background: "none", border: "none", color: C.purple, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                          Add your story →
                        </button>
                      </div>
                    )}

                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      background: C.greenLight, color: C.green, border: `1px solid #b7dfd1`,
                      borderRadius: 20, padding: "4px 10px",
                      fontFamily: "Nunito, sans-serif", fontSize: 10, fontWeight: 800,
                    }}>
                      ❤️ Active Contributor
                    </div>
                  </div>
                </div>
              </div>

              {/* impact stats */}
              <div className="cp2-card">
                <div style={{
                  position: "absolute", top: -6, right: -4, fontSize: 44,
                  opacity: 0.18, transform: "rotate(15deg)", pointerEvents: "none",
                }}>🌿</div>
                <div className="cp2-label" style={{ position: "relative", zIndex: 1 }}>Your Overall Impact</div>
                <div className="cp2-stats-scroll" style={{ position: "relative", zIndex: 1 }}>
                  <StatTile emoji="👥" count={stats.mothersSupported}    label="Mothers Supported"    bg="#e8f5f0"      color={C.green}   />
                  <StatTile emoji="🎁" count={stats.essentialsDelivered} label="Essentials Delivered" bg="#eaf5f2"    color="#2a8c6e"   />
                  <StatTile emoji="💝" count={stats.bundlesSupported}    label="Bundles Supported"    bg="#fce8e8"      color="#c4585a"   />
                  <StatTile emoji="📣" count={stats.peopleReached}       label="People Reached"       bg={C.purplePale} color={C.purple}  />
                </div>
              </div>

              {/* current mission */}
              {currentMission && (
                <div className="cp2-card">
                  <div style={{
                    position: "absolute", bottom: -8, right: -4, fontSize: 36,
                    opacity: 0.15, transform: "rotate(-20deg)", pointerEvents: "none",
                  }}>🌿</div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div className="cp2-label cp2-label-green" style={{ marginBottom: 0 }}>Current Mission</div>
                    <button onClick={() => router.push("/missions/my")} style={{
                      background: "none", border: "none", color: C.green,
                      fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 800, cursor: "pointer",
                    }}>
                      View Mission →
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 }}>
                    <div style={{
                      width: 72, height: 72, borderRadius: 20, flexShrink: 0,
                      background: C.purplePale, border: `1px solid #d8d0f5`,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34,
                    }}>
                      🎁
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: C.text, lineHeight: 1.3, marginBottom: 5 }}>
                        {currentMission.name}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: "Nunito, sans-serif", marginBottom: 6 }}>
                        {formatMonth(currentMission.month)}
                        {currentMission.isComplete && <span style={{ color: C.green, fontWeight: 800, marginLeft: 6 }}>✓ Complete</span>}
                      </div>
                      <div style={{ fontSize: 12, color: C.mid, fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>
                        Working with {teammates} teammate{teammates !== 1 ? "s" : ""} to provide {currentMission.goalBlocks} impact blocks this month
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: C.green, fontFamily: "Nunito, sans-serif" }}>
                        Care Delivered This Month
                      </div>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: C.green }}>
                        {Math.min(essentials, CARE_GOAL)}<span style={{ fontSize: 11, color: C.muted, fontWeight: 400, fontFamily: "Nunito, sans-serif" }}>/{CARE_GOAL} essentials</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: C.mid, fontFamily: "Nunito, sans-serif", lineHeight: 1.5, marginBottom: 6 }}>
                      Each block is one essential delivered to a mom — through requests, registers, or bundles. Your team&rsquo;s collective effort this month.
                    </div>
                    <CareGrid essentials={essentials} />
                  </div>
                </div>
              )}

              {/* mission history */}
              <div className="cp2-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div className="cp2-label" style={{ marginBottom: 0 }}>Mission History</div>
                  {pastMissions.length > 0 && (
                    <button onClick={() => router.push("/missions/my")} style={{
                      background: "none", border: "none", color: C.purple,
                      fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 800, cursor: "pointer",
                    }}>
                      View All →
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 11, color: C.mid, fontFamily: "Nunito, sans-serif", lineHeight: 1.5, marginBottom: 14 }}>
                  Each entry below is something you helped happen.
                </div>
                {pastMissions.length > 0 ? (
                  <div className="cp2-hist-scroll">
                    {pastMissions.map(m => <PastMissionCard key={m.id} m={m} />)}
                  </div>
                ) : (
                  <div style={{
                    background: C.purplePale, border: `1px dashed #d8d0f5`,
                    borderRadius: 20, padding: "20px 16px", textAlign: "center",
                  }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>🌿</div>
                    <div style={{ fontFamily: "Lora, serif", fontSize: 12, fontWeight: 600, color: C.purple, lineHeight: 1.4 }}>
                      Your first completed mission will appear here.
                    </div>
                  </div>
                )}
              </div>

              {/* why I support */}
              <div className="cp2-card" style={{ background: C.purplePale, border: "1px solid #d8d0f5" }}>
                <div style={{
                  position: "absolute", top: -6, left: -4, fontSize: 36,
                  opacity: 0.2, transform: "rotate(-10deg)", pointerEvents: "none",
                }}>🌿</div>
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start", position: "relative", zIndex: 1 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cp2-label" style={{ marginBottom: 10 }}>Why I Support</div>
                    {identity.bio ? (
                      <div style={{ fontFamily: "Lora, serif", fontStyle: "italic", fontSize: 14, color: C.purple, lineHeight: 1.75 }}>
                        &ldquo;{identity.bio}&rdquo;
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: C.mid, fontFamily: "Nunito, sans-serif", lineHeight: 1.65 }}>
                        Share what brought you here in your profile settings.{" "}
                        <button onClick={() => setEditing(true)} style={{
                          background: "none", border: "none", color: C.purple,
                          fontWeight: 800, cursor: "pointer", fontSize: 13,
                          fontFamily: "Nunito, sans-serif", padding: 0,
                        }}>
                          Add it →
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "center" }}>
                    <div style={{ fontSize: 52, lineHeight: 1 }}>🤱🏽</div>
                    <div style={{ fontSize: 22, marginTop: -4, opacity: 0.7 }}>🌿</div>
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 18, marginTop: 10, position: "relative", zIndex: 1 }}>💜</div>
              </div>

            </div>
            {/* ════ END LEFT COLUMN ════ */}

            {/* ════ RIGHT COLUMN ════ */}
            <div className="cp2-right">
              <WhyThisProfileMatters />
              <ShareablePreview
                identity={identity}
                stats={stats}
                currentMission={currentMission}
                essentials={essentials}
                onShare={handleShare}
              />
              <ClosingCard />
            </div>
            {/* ════ END RIGHT COLUMN ════ */}

            {/* ════ SHARE ROW — spans both columns on desktop ════ */}
            <div className="cp2-share-row">
              <button
                onClick={handleShare}
                disabled={sharing}
                style={{
                  width: "100%", background: shareDone ? C.green : C.purple,
                  border: "none", borderRadius: 18,
                  padding: "16px 0", fontFamily: "Nunito, sans-serif",
                  fontSize: 15, fontWeight: 800, color: "white",
                  cursor: sharing ? "default" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  transition: "background 0.2s", opacity: sharing ? 0.7 : 1,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 17 }}>📤</span>
                {shareDone ? "Link Copied!" : sharing ? "Creating link…" : "Share My Profile"}
              </button>

              <div style={{
                textAlign: "center", fontSize: 12, color: C.muted,
                fontFamily: "Nunito, sans-serif", marginBottom: 24, lineHeight: 1.5,
              }}>
                Let others see how we can create change together.
              </div>

              <div style={{
                textAlign: "center", fontFamily: "Lora, serif", fontStyle: "italic",
                fontSize: 14, color: C.muted, lineHeight: 1.8, padding: "4px 0 8px",
              }}>
                <span style={{ marginRight: 6 }}>💜</span>
                Care moves everything. Thank you for showing up.
              </div>
            </div>

          </div>
        </div>
        {/* ── end outer ── */}

      </div>

      <BottomNav />

      {editing && (
        <EditModal
          identity={identity}
          onClose={() => setEditing(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
