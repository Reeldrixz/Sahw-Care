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
  green:       "#1a7a5e",
  greenLight:  "#e8f5f0",
  greenMid:    "#a8d4bf",
  purple:      "#6d5acd",
  purplePale:  "#f5f3ff",
  cream:       "#faf8f3",
  white:       "#ffffff",
  text:        "#2a2a2a",
  mid:         "#5a5a5a",
  muted:       "#8a8a8a",
  border:      "#ede8df",
};

// ── global styles ──────────────────────────────────────────────────────────

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
  .cp2-inner { max-width: 640px; margin: 0 auto; padding: 20px 16px; }
  .cp2-card {
    background: white; border-radius: 22px; border: 1px solid #ede8df;
    padding: 22px 20px; margin-bottom: 16px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.04);
  }
  .cp2-label {
    font-family: 'Nunito', sans-serif; font-size: 10px; font-weight: 800;
    letter-spacing: 1.6px; text-transform: uppercase; color: #6d5acd; margin-bottom: 14px;
  }
  .cp2-label-green { color: #1a7a5e; }

  .stat-grid-5 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .stat-grid-5 > *:last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }

  .mission-history-scroll {
    display: flex; gap: 12px; overflow-x: auto; padding-bottom: 6px;
    scrollbar-width: none; -ms-overflow-style: none;
  }
  .mission-history-scroll::-webkit-scrollbar { display: none; }

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

function formatShortMonth(month: string): string {
  const [y, m] = month.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleString("en", { month: "short", year: "2-digit" });
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
    <div style={{ display: "grid", gridTemplateColumns: "repeat(13, 1fr)", gap: 5, margin: "14px 0" }}>
      {cells.map((bg, i) => (
        <div key={i} style={{ aspectRatio: "1", borderRadius: 5, background: bg }} />
      ))}
    </div>
  );
}

function MiniBar({ value, total }: { value: number; total: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, total)) * 100));
  return (
    <div style={{ height: 4, background: C.border, borderRadius: 4, overflow: "hidden", marginTop: 6 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: C.green, borderRadius: 4 }} />
    </div>
  );
}

function StatCard({ emoji, count, label, bg, color, fullWidth }: {
  emoji: string; count: number; label: string; bg: string; color: string; fullWidth?: boolean;
}) {
  return (
    <div style={{
      background: "white", borderRadius: 18, padding: "18px 14px", textAlign: "center",
      border: `1px solid ${C.border}`, gridColumn: fullWidth ? "1 / -1" : undefined,
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: "50%", background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, margin: "0 auto 10px",
      }}>
        {emoji}
      </div>
      <div style={{ fontFamily: "Lora, serif", fontSize: 30, fontWeight: 700, color, lineHeight: 1 }}>
        {count}
      </div>
      <div style={{ fontSize: 11, color: C.mid, marginTop: 6, lineHeight: 1.4, fontFamily: "Nunito, sans-serif" }}>
        {label}
      </div>
    </div>
  );
}

function PastMissionCard({ m }: { m: PastMission }) {
  return (
    <div style={{
      minWidth: 168, background: "white", border: `1px solid ${C.border}`,
      borderRadius: 18, padding: "16px 14px", flexShrink: 0,
    }}>
      <div style={{
        display: "inline-block", background: m.isComplete ? C.greenLight : C.purplePale,
        color: m.isComplete ? C.green : C.purple,
        fontSize: 10, fontWeight: 800, letterSpacing: "1px",
        padding: "3px 9px", borderRadius: 20, fontFamily: "Nunito, sans-serif", marginBottom: 8,
      }}>
        {formatShortMonth(m.month)}{m.isComplete ? " ✓" : ""}
      </div>
      <div style={{ fontFamily: "Lora, serif", fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.3, marginBottom: 10 }}>
        {m.missionName}
      </div>
      <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: C.purple, lineHeight: 1 }}>
        {m.myBlocks}
      </div>
      <div style={{ fontSize: 10, color: C.muted, fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>
        your blocks
      </div>
      <MiniBar value={m.teamBlocks} total={m.goalBlocks} />
      <div style={{ fontSize: 10, color: C.muted, fontFamily: "Nunito, sans-serif", marginTop: 4 }}>
        {m.teamBlocks}/{m.goalBlocks} team
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
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.muted, lineHeight: 1 }}>✕</button>
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

  const [data,       setData]       = useState<ContributorData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [editing,    setEditing]    = useState(false);
  const [sharing,    setSharing]    = useState(false);
  const [shareDone,  setShareDone]  = useState(false);

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
        <div style={{ background: "white", borderBottom: `1px solid ${C.border}`, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: C.cream, border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
          <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700 }}>Care Contributor</div>
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

  // ── full v2 profile (hasActions true or false) ─────────────────────────

  const identity       = data.identity!;
  const stats          = data.stats   ?? { mothersSupported: 0, essentialsDelivered: 0, bundlesSupported: 0, discoverPickups: 0, peopleReached: 0 };
  const currentMission = data.currentMission ?? null;
  const pastMissions   = data.pastMissions   ?? [];

  const avatarInitial = identity.name?.charAt(0).toUpperCase() ?? "?";

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
    setData(prev => prev && prev.identity ? {
      ...prev,
      identity: { ...prev.identity, bio, location },
    } : prev);
  }

  return (
    <>
      <style>{styles}</style>
      <div className="cp2">

        {/* ── top nav ── */}
        <div style={{
          background: "white", borderBottom: `1px solid ${C.border}`,
          padding: "13px 16px", display: "flex", alignItems: "center", gap: 12,
        }}>
          <button onClick={() => router.back()} style={{
            width: 36, height: 36, borderRadius: "50%", background: C.cream,
            border: "none", fontSize: 18, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>←</button>
          <div style={{ flex: 1, fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700 }}>
            Care Contributor
          </div>
          <button onClick={() => setEditing(true)} style={{
            background: C.purplePale, color: C.purple, border: "none",
            borderRadius: 20, padding: "7px 16px", fontFamily: "Nunito, sans-serif",
            fontSize: 12, fontWeight: 800, cursor: "pointer", letterSpacing: "0.3px",
          }}>
            Edit Profile
          </button>
        </div>

        <div className="cp2-inner">

          {/* ── identity card ── */}
          <div className="cp2-card" style={{ textAlign: "center", paddingTop: 28, paddingBottom: 24 }}>
            {/* avatar */}
            <div style={{
              width: 96, height: 96, borderRadius: "50%", margin: "0 auto 14px",
              background: identity.avatar ? "transparent" : `linear-gradient(135deg, ${C.purple}, #9b7fe8)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden", border: `3px solid ${C.purplePale}`,
            }}>
              {identity.avatar
                ? <img src={identity.avatar} alt={identity.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontFamily: "Lora, serif", fontSize: 36, fontWeight: 700, color: "white" }}>{avatarInitial}</span>
              }
            </div>

            {/* name */}
            <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 6 }}>
              {identity.name}
            </div>

            {/* active contributor badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: C.greenLight, color: C.green, border: `1px solid #b7dfd1`,
              borderRadius: 20, padding: "5px 12px",
              fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 800,
              letterSpacing: "0.5px", marginBottom: 14,
            }}>
              <span style={{ fontSize: 8 }}>●</span> Active Contributor
            </div>

            {/* since + location */}
            <div style={{ fontSize: 12, color: C.muted, fontFamily: "Nunito, sans-serif", lineHeight: 1.8 }}>
              {identity.careContributorSince && (
                <div>Care Contributor since {formatSince(identity.careContributorSince)}</div>
              )}
              {identity.location && (
                <div>📍 {identity.location}</div>
              )}
            </div>

            {/* bio */}
            {identity.bio && (
              <div style={{
                marginTop: 14, fontSize: 13, color: C.mid, fontFamily: "Nunito, sans-serif",
                lineHeight: 1.7, maxWidth: 340, margin: "14px auto 0",
              }}>
                {identity.bio}
              </div>
            )}
          </div>

          {/* ── impact stats ── */}
          <div className="cp2-card">
            <div className="cp2-label">Your Impact</div>
            <div className="stat-grid-5">
              <StatCard emoji="👥" count={stats.mothersSupported}    label="Mothers Supported"            bg="#e8f5f0" color={C.green} />
              <StatCard emoji="🎁" count={stats.essentialsDelivered} label="Essentials Delivered"         bg="#eaf5f2" color="#2a8c6e" />
              <StatCard emoji="💝" count={stats.bundlesSupported}    label="Bundles Supported"            bg="#fce8e8" color="#c4585a" />
              <StatCard emoji="🛍️" count={stats.discoverPickups}    label="Discover Pickups Facilitated" bg="#fef4e4" color="#c87c15" />
              <StatCard emoji="📣" count={stats.peopleReached}       label="People Reached Through Sharing" bg={C.purplePale} color={C.purple} fullWidth />
            </div>
          </div>

          {/* ── current mission ── */}
          {currentMission && (
            <div className="cp2-card">
              <div className="cp2-label cp2-label-green">Your Mission</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: C.text, flex: 1, marginRight: 12 }}>
                  {currentMission.name}
                </div>
                <div style={{
                  flexShrink: 0, background: C.purplePale, color: C.purple,
                  fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 20,
                  fontFamily: "Nunito, sans-serif", letterSpacing: "0.5px",
                }}>
                  {formatShortMonth(currentMission.month)}
                </div>
              </div>

              <BlockGrid
                myBlocks={currentMission.myBlocks}
                totalBlocks={currentMission.totalBlocks}
                goalBlocks={currentMission.goalBlocks}
              />

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, fontFamily: "Nunito, sans-serif" }}>
                <span>
                  <span style={{ color: C.green, fontWeight: 800 }}>{currentMission.myBlocks}</span> my blocks
                </span>
                <span>
                  Team: {currentMission.totalBlocks}/{currentMission.goalBlocks}
                  {currentMission.isComplete && <span style={{ color: C.green, fontWeight: 800, marginLeft: 4 }}>✓ Complete</span>}
                </span>
              </div>

              <div style={{ marginTop: 10, fontSize: 11, color: C.muted, fontFamily: "Nunito, sans-serif" }}>
                {currentMission.memberCount} member{currentMission.memberCount !== 1 ? "s" : ""} in your team
              </div>
            </div>
          )}

          {/* ── mission history ── */}
          {pastMissions.length > 0 && (
            <div className="cp2-card">
              <div className="cp2-label">Mission History</div>
              <div className="mission-history-scroll">
                {pastMissions.map(m => <PastMissionCard key={m.id} m={m} />)}
              </div>
            </div>
          )}

          {/* ── why I support ── */}
          <div className="cp2-card" style={{ background: C.purplePale, border: `1px solid #d8d0f5` }}>
            <div className="cp2-label">Why I Support</div>
            {identity.bio ? (
              <div style={{
                fontFamily: "Lora, serif", fontStyle: "italic",
                fontSize: 15, color: C.purple, lineHeight: 1.8,
              }}>
                &ldquo;{identity.bio}&rdquo;
              </div>
            ) : (
              <div style={{ fontSize: 13, color: C.muted, fontFamily: "Nunito, sans-serif", lineHeight: 1.7 }}>
                Share why you care about supporting mothers — it inspires everyone who sees your profile.{" "}
                <button
                  onClick={() => setEditing(true)}
                  style={{ background: "none", border: "none", color: C.purple, fontWeight: 800, cursor: "pointer", fontSize: 13, fontFamily: "Nunito, sans-serif", padding: 0 }}
                >
                  Add it here →
                </button>
              </div>
            )}
          </div>

          {/* ── share button ── */}
          <button
            onClick={handleShare}
            disabled={sharing}
            style={{
              width: "100%", background: "white",
              border: `2px solid ${C.purple}`, borderRadius: 18,
              padding: "16px 0", fontFamily: "Nunito, sans-serif",
              fontSize: 15, fontWeight: 800, color: C.purple,
              cursor: sharing ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              transition: "all 0.2s", opacity: sharing ? 0.6 : 1,
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>↗</span>
            {shareDone ? "Link Copied!" : sharing ? "Creating link…" : "Share My Profile"}
          </button>

          <div style={{
            textAlign: "center", fontSize: 11, color: C.muted,
            fontFamily: "Nunito, sans-serif", marginBottom: 20, lineHeight: 1.6,
          }}>
            Generates a private link · expires in 30 days
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

      {/* ── edit modal ── */}
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
