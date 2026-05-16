import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

type Params = { params: Promise<{ snapshotId: string }> };

interface SnapshotIdentity {
  name: string;
  avatar: string | null;
  location: string | null;
  bio: string | null;
  careContributorSince: string | null;
  isVerified: boolean;
}

interface SnapshotStats {
  mothersSupported: number;
  essentialsDelivered: number;
  bundlesSupported: number;
  discoverPickups: number;
  peopleReached: number;
}

interface SnapshotMission {
  name: string;
  month: string;
  totalBlocks: number;
  goalBlocks: number;
  myBlocks: number;
  memberCount: number;
  isComplete: boolean;
}

interface SnapshotPastMission {
  id: string;
  missionName: string;
  month: string;
  teamBlocks: number;
  goalBlocks: number;
  myBlocks: number;
  isComplete: boolean;
  joinedAt: string;
}

interface SnapshotData {
  identity: SnapshotIdentity;
  stats: SnapshotStats;
  currentMission: SnapshotMission | null;
  pastMissions: SnapshotPastMission[];
  snapshotAt: string;
}

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleString("en", { month: "long", year: "numeric" });
}

function formatSince(date: string | null): string {
  if (!date) return "";
  return new Date(date).toLocaleString("en", { month: "long", year: "numeric" });
}

function formatShortDate(date: string): string {
  return new Date(date).toLocaleString("en", { month: "short", day: "numeric", year: "numeric" });
}

const C = {
  green: "#1a7a5e", greenLight: "#e8f5f0", greenMid: "#a8d4bf",
  purple: "#6d5acd", purplePale: "#f5f3ff",
  cream: "#faf8f3", text: "#2a2a2a", mid: "#5a5a5a", muted: "#8a8a8a",
  border: "#ede8df",
};

const pageStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Nunito:wght@400;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #faf8f3; font-family: 'Nunito', sans-serif; color: #2a2a2a; }
  .snap-inner { max-width: 600px; margin: 0 auto; padding: 24px 16px 60px; }
  .snap-card {
    background: white; border-radius: 22px; border: 1px solid #ede8df;
    padding: 22px 20px; margin-bottom: 16px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.04);
  }
  .snap-label {
    font-family: 'Nunito', sans-serif; font-size: 10px; font-weight: 800;
    letter-spacing: 1.6px; text-transform: uppercase; color: #6d5acd; margin-bottom: 14px;
  }
  .snap-label-green { color: #1a7a5e; }
  .stat-grid-5 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .stat-grid-5 > *:last-child:nth-child(odd) { grid-column: 1 / -1; }
  .snap-scroll { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 6px; scrollbar-width: none; }
  .snap-scroll::-webkit-scrollbar { display: none; }
`;

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

export default async function SnapshotPage({ params }: Params) {
  const { snapshotId } = await params;
  const snapshot = await prisma.profileSnapshot.findUnique({ where: { id: snapshotId } });

  if (!snapshot) notFound();

  if (snapshot.expiresAt < new Date()) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: pageStyles }} />
        <div className="snap-inner" style={{ textAlign: "center", paddingTop: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🕊️</div>
          <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: C.purple, marginBottom: 8 }}>
            This profile link has expired
          </div>
          <div style={{ fontSize: 14, color: C.mid, lineHeight: 1.7 }}>
            The contributor who shared this can create a new link from their profile.
          </div>
          <div style={{ marginTop: 28 }}>
            <a href="/" style={{
              display: "inline-block", background: C.purple, color: "white",
              borderRadius: 14, padding: "13px 28px",
              fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 800,
              textDecoration: "none",
            }}>
              Learn about CareCircle
            </a>
          </div>
        </div>
      </>
    );
  }

  const d = snapshot.snapshotData as unknown as SnapshotData;
  const { identity, stats, currentMission, pastMissions } = d;
  const avatarInitial = identity.name?.charAt(0).toUpperCase() ?? "?";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

      {/* branding bar */}
      <div style={{
        background: "white", borderBottom: `1px solid ${C.border}`,
        padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: C.purple }}>
          CareCircle
        </div>
        <a href="/" style={{
          background: C.purplePale, color: C.purple, border: "none",
          borderRadius: 20, padding: "7px 16px",
          fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 800,
          textDecoration: "none",
        }}>
          Join us
        </a>
      </div>

      <div className="snap-inner">

        {/* identity */}
        <div className="snap-card" style={{ textAlign: "center", paddingTop: 28, paddingBottom: 24 }}>
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
          <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 6 }}>
            {identity.name}
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: C.greenLight, color: C.green, border: "1px solid #b7dfd1",
            borderRadius: 20, padding: "5px 12px",
            fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 800,
            letterSpacing: "0.5px", marginBottom: 14,
          }}>
            <span style={{ fontSize: 8 }}>●</span> Active Contributor
          </div>
          <div style={{ fontSize: 12, color: C.muted, fontFamily: "Nunito, sans-serif", lineHeight: 1.8 }}>
            {identity.careContributorSince && (
              <div>Care Contributor since {formatSince(identity.careContributorSince)}</div>
            )}
            {identity.location && <div>📍 {identity.location}</div>}
          </div>
        </div>

        {/* why I support */}
        {identity.bio && (
          <div className="snap-card" style={{ background: C.purplePale, border: "1px solid #d8d0f5" }}>
            <div className="snap-label">Why I Support</div>
            <div style={{
              fontFamily: "Lora, serif", fontStyle: "italic",
              fontSize: 15, color: C.purple, lineHeight: 1.8,
            }}>
              &ldquo;{identity.bio}&rdquo;
            </div>
          </div>
        )}

        {/* impact stats */}
        <div className="snap-card">
          <div className="snap-label">Impact</div>
          <div className="stat-grid-5">
            {[
              { emoji: "👥", count: stats.mothersSupported,    label: "Mothers Supported",             bg: "#e8f5f0", color: C.green },
              { emoji: "🎁", count: stats.essentialsDelivered, label: "Essentials Delivered",          bg: "#eaf5f2", color: "#2a8c6e" },
              { emoji: "💝", count: stats.bundlesSupported,    label: "Bundles Supported",             bg: "#fce8e8", color: "#c4585a" },
              { emoji: "🛍️", count: stats.discoverPickups,    label: "Discover Pickups Facilitated",  bg: "#fef4e4", color: "#c87c15" },
              { emoji: "📣", count: stats.peopleReached,       label: "People Reached",                bg: C.purplePale, color: C.purple },
            ].map((s, idx) => (
              <div key={idx} style={{
                background: "white", borderRadius: 18, padding: "18px 14px", textAlign: "center",
                border: `1px solid ${C.border}`, gridColumn: idx === 4 ? "1 / -1" : undefined,
              }}>
                <div style={{ width: 46, height: 46, borderRadius: "50%", background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 10px" }}>
                  {s.emoji}
                </div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 30, fontWeight: 700, color: s.color, lineHeight: 1 }}>
                  {s.count}
                </div>
                <div style={{ fontSize: 11, color: C.mid, marginTop: 6, lineHeight: 1.4 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* current mission */}
        {currentMission && (
          <div className="snap-card">
            <div className="snap-label snap-label-green">Current Mission</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: C.text, flex: 1, marginRight: 12 }}>
                {currentMission.name}
              </div>
              <div style={{ flexShrink: 0, background: C.purplePale, color: C.purple, fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 20, fontFamily: "Nunito, sans-serif" }}>
                {formatMonth(currentMission.month)}
              </div>
            </div>
            <BlockGrid myBlocks={currentMission.myBlocks} totalBlocks={currentMission.totalBlocks} goalBlocks={currentMission.goalBlocks} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, fontFamily: "Nunito, sans-serif" }}>
              <span><span style={{ color: C.green, fontWeight: 800 }}>{currentMission.myBlocks}</span> my blocks</span>
              <span>Team: {currentMission.totalBlocks}/{currentMission.goalBlocks}{currentMission.isComplete && <span style={{ color: C.green, fontWeight: 800, marginLeft: 4 }}>✓</span>}</span>
            </div>
          </div>
        )}

        {/* past missions */}
        {pastMissions.length > 0 && (
          <div className="snap-card">
            <div className="snap-label">Mission History</div>
            <div className="snap-scroll">
              {pastMissions.map(m => (
                <div key={m.id} style={{
                  minWidth: 160, background: "white", border: `1px solid ${C.border}`,
                  borderRadius: 18, padding: "16px 14px", flexShrink: 0,
                }}>
                  <div style={{
                    display: "inline-block",
                    background: m.isComplete ? C.greenLight : C.purplePale,
                    color: m.isComplete ? C.green : C.purple,
                    fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20,
                    fontFamily: "Nunito, sans-serif", marginBottom: 8,
                  }}>
                    {formatMonth(m.month).split(" ").join(" '").slice(0, 8)}{m.isComplete ? " ✓" : ""}
                  </div>
                  <div style={{ fontFamily: "Lora, serif", fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.3, marginBottom: 8 }}>
                    {m.missionName}
                  </div>
                  <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: C.purple }}>
                    {m.myBlocks}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, fontFamily: "Nunito, sans-serif" }}>
                    your blocks
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* snapshot meta */}
        <div style={{ textAlign: "center", fontSize: 11, color: C.muted, fontFamily: "Nunito, sans-serif", marginBottom: 20 }}>
          Profile shared {formatShortDate(d.snapshotAt)} · Expires {formatShortDate(snapshot.expiresAt.toISOString())}
        </div>

        {/* footer CTA */}
        <div style={{ textAlign: "center" }}>
          <a href="/" style={{
            display: "inline-block", background: C.purple, color: "white",
            borderRadius: 16, padding: "14px 28px",
            fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 800,
            textDecoration: "none", marginBottom: 12,
          }}>
            Join CareCircle
          </a>
          <div style={{ fontFamily: "Lora, serif", fontStyle: "italic", fontSize: 13, color: C.muted, lineHeight: 1.8 }}>
            Care moves everything.
          </div>
        </div>

      </div>
    </>
  );
}
