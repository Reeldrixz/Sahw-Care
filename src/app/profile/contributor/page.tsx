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
  discoverPickups: number;
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
  .cp2-inner { max-width: 640px; margin: 0 auto; padding: 16px 16px; }
  .cp2-card {
    background: white; border-radius: 22px; border: 1px solid #ede8df;
    padding: 18px 16px; margin-bottom: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.04);
    position: relative; overflow: hidden;
  }
  .cp2-label {
    font-family: 'Nunito', sans-serif; font-size: 10px; font-weight: 800;
    letter-spacing: 1.6px; text-transform: uppercase; color: #6d5acd; margin-bottom: 12px;
  }
  .cp2-label-green { color: #1a7a5e; }

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

// ── sub-components ─────────────────────────────────────────────────────────

function BlockGrid({ myBlocks, totalBlocks, goalBlocks }: {
  myBlocks: number; totalBlocks: number; goalBlocks: number;
}) {
  const CELLS = 26;
  const cap   = Math.max(1, goalBlocks);
  const teamN = Math.min(CELLS, Math.round((totalBlocks / cap) * CELLS));
  const myN   = Math.min(teamN, Math.round((myBlocks / cap) * CELLS));
  const cells = [
    ...Array(myN).fill(C.green),
    ...Array(teamN - myN).fill(C.greenMid),
    ...Array(CELLS - teamN).fill(C.border),
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(13, 1fr)", gap: 4, margin: "10px 0" }}>
      {cells.map((bg, i) => (
        <div key={i} style={{ aspectRatio: "1", borderRadius: 4, background: bg }} />
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
        {/* header */}
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
        <div className="cp2-inner" style={{ textAlign: "center", paddingTop: 64 }}>
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
  const stats          = data.stats ?? { mothersSupported: 0, essentialsDelivered: 0, bundlesSupported: 0, discoverPickups: 0, peopleReached: 0 };
  const currentMission = data.currentMission ?? null;
  const pastMissions   = data.pastMissions   ?? [];
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

        {/* ── header: back left, centered title + subtitle ── */}
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

        <div className="cp2-inner">

          {/* ── identity card: horizontal layout ── */}
          <div className="cp2-card" style={{ padding: "16px" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>

              {/* LEFT: avatar + verification badge */}
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
                    fontSize: 10, color: "white", fontWeight: 800, lineHeight: 1,
                  }}>✓</div>
                )}
              </div>

              {/* RIGHT: name row + details stack */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* name + edit pill */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
                  <div style={{ fontFamily: "Lora, serif", fontSize: 19, fontWeight: 700, color: C.text, lineHeight: 1.2, flex: 1, marginRight: 8 }}>
                    {identity.name}
                    {identity.isVerified && (
                      <span style={{ color: C.green, fontSize: 13, marginLeft: 4, fontStyle: "normal" }}> ✓</span>
                    )}
                  </div>
                  <button onClick={() => setEditing(true)} style={{
                    flexShrink: 0, background: C.purplePale, color: C.purple, border: "none",
                    borderRadius: 20, padding: "5px 12px", fontFamily: "Nunito, sans-serif",
                    fontSize: 11, fontWeight: 800, cursor: "pointer",
                  }}>
                    Edit
                  </button>
                </div>

                {/* since */}
                {identity.careContributorSince && (
                  <div style={{ fontSize: 11, color: C.muted, fontFamily: "Nunito, sans-serif", marginBottom: 3 }}>
                    Care Contributor since {formatSince(identity.careContributorSince)}
                  </div>
                )}

                {/* location */}
                {identity.location && (
                  <div style={{ fontSize: 11, color: C.muted, fontFamily: "Nunito, sans-serif", marginBottom: 7 }}>
                    📍 {identity.location}
                  </div>
                )}

                {/* bio / placeholder */}
                {identity.bio ? (
                  <div style={{
                    fontFamily: "Lora, serif", fontStyle: "italic",
                    fontSize: 13, color: C.mid, lineHeight: 1.55, marginBottom: 10,
                  }}>
                    &ldquo;{identity.bio}&rdquo;
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: C.muted, fontFamily: "Nunito, sans-serif", marginBottom: 10 }}>
                    <button onClick={() => setEditing(true)} style={{
                      background: "none", border: "none", color: C.purple,
                      fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0,
                    }}>
                      Add your story →
                    </button>
                  </div>
                )}

                {/* active contributor badge */}
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

          {/* ── your overall impact ── */}
          <div className="cp2-card">
            {/* decorative leaf top-right */}
            <div style={{
              position: "absolute", top: -6, right: -4, fontSize: 44,
              opacity: 0.18, transform: "rotate(15deg)", pointerEvents: "none", zIndex: 0,
            }}>🌿</div>

            <div className="cp2-label" style={{ position: "relative", zIndex: 1 }}>Your Overall Impact</div>
            <div className="cp2-stats-scroll" style={{ position: "relative", zIndex: 1 }}>
              <StatTile emoji="👥" count={stats.mothersSupported}    label="Mothers Supported"            bg="#e8f5f0" color={C.green}    />
              <StatTile emoji="🎁" count={stats.essentialsDelivered} label="Essentials Delivered"         bg="#eaf5f2" color="#2a8c6e"    />
              <StatTile emoji="💝" count={stats.bundlesSupported}    label="Bundles Supported"            bg="#fce8e8" color="#c4585a"    />
              <StatTile emoji="🛍️" count={stats.discoverPickups}    label="Discover Pickups"             bg="#fef4e4" color="#c87c15"    />
              <StatTile emoji="📣" count={stats.peopleReached}       label="People Reached"               bg={C.purplePale} color={C.purple} />
            </div>
          </div>

          {/* ── current mission ── */}
          {currentMission && (
            <div className="cp2-card">
              {/* decorative leaf */}
              <div style={{
                position: "absolute", bottom: -8, right: -4, fontSize: 36,
                opacity: 0.15, transform: "rotate(-20deg)", pointerEvents: "none",
              }}>🌿</div>

              {/* heading row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div className="cp2-label cp2-label-green" style={{ marginBottom: 0 }}>Current Mission</div>
                <button onClick={() => router.push("/missions/my")} style={{
                  background: "none", border: "none", color: C.green,
                  fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 800, cursor: "pointer",
                }}>
                  View Mission →
                </button>
              </div>

              {/* two-column: illustration + text */}
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 }}>
                {/* LEFT: illustration */}
                <div style={{
                  width: 72, height: 72, borderRadius: 20, flexShrink: 0,
                  background: C.purplePale, border: `1px solid #d8d0f5`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34,
                }}>
                  🎁
                </div>
                {/* RIGHT: mission details */}
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

              {/* third row: mission progress + block grid */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: C.muted, fontFamily: "Nunito, sans-serif" }}>
                    Mission Progress
                  </div>
                  <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: C.green }}>
                    {currentMission.myBlocks}<span style={{ fontSize: 11, color: C.muted, fontWeight: 400, fontFamily: "Nunito, sans-serif" }}>/{currentMission.goalBlocks} blocks</span>
                  </div>
                </div>
                <BlockGrid
                  myBlocks={currentMission.myBlocks}
                  totalBlocks={currentMission.totalBlocks}
                  goalBlocks={currentMission.goalBlocks}
                />
                <div style={{ fontSize: 10, color: C.muted, fontFamily: "Nunito, sans-serif", display: "flex", gap: 12 }}>
                  <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: C.green, marginRight: 4, verticalAlign: "middle" }}/>My blocks</span>
                  <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: C.greenMid, marginRight: 4, verticalAlign: "middle" }}/>Team blocks</span>
                </div>
              </div>
            </div>
          )}

          {/* ── mission history (always shown) ── */}
          <div className="cp2-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
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

            {pastMissions.length > 0 ? (
              <div className="cp2-hist-scroll">
                {pastMissions.map(m => <PastMissionCard key={m.id} m={m} />)}
              </div>
            ) : (
              <div style={{
                minWidth: 144, background: C.purplePale, border: `1px dashed #d8d0f5`,
                borderRadius: 20, padding: "20px 16px", textAlign: "center",
              }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🌿</div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 12, fontWeight: 600, color: C.purple, lineHeight: 1.4 }}>
                  Your first completed mission will appear here.
                </div>
              </div>
            )}
          </div>

          {/* ── why I support ── */}
          <div className="cp2-card" style={{ background: C.purplePale, border: "1px solid #d8d0f5" }}>
            {/* decorative leaf */}
            <div style={{
              position: "absolute", top: -6, left: -4, fontSize: 36,
              opacity: 0.2, transform: "rotate(-10deg)", pointerEvents: "none",
            }}>🌿</div>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", position: "relative", zIndex: 1 }}>
              {/* LEFT */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="cp2-label" style={{ marginBottom: 10 }}>Why I Support</div>
                {identity.bio ? (
                  <div style={{
                    fontFamily: "Lora, serif", fontStyle: "italic",
                    fontSize: 14, color: C.purple, lineHeight: 1.75,
                  }}>
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

              {/* RIGHT: illustration */}
              <div style={{ flexShrink: 0, textAlign: "center" }}>
                <div style={{ fontSize: 52, lineHeight: 1 }}>🤱🏽</div>
                <div style={{ fontSize: 22, marginTop: -4, opacity: 0.7 }}>🌿</div>
              </div>
            </div>

            {/* purple heart bottom-right */}
            <div style={{ textAlign: "right", fontSize: 18, marginTop: 10, position: "relative", zIndex: 1 }}>
              💜
            </div>
          </div>

          {/* ── share button ── */}
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
            fontFamily: "Nunito, sans-serif", marginBottom: 20, lineHeight: 1.5,
          }}>
            Let others see how we can create change together.
          </div>

          {/* ── footer ── */}
          <div style={{
            textAlign: "center", fontFamily: "Lora, serif", fontStyle: "italic",
            fontSize: 14, color: C.muted, lineHeight: 1.8, padding: "4px 0 8px",
          }}>
            <span style={{ marginRight: 6 }}>💜</span>
            Care moves everything. Thank you for showing up.
          </div>

        </div>
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
