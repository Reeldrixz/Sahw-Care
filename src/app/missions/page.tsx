"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";

interface Mission {
  id: string;
  name: string;
  description: string;
  category: string;
  goalBlocks: number;
  totalMembers: number;
  openSpots: number;
  avgBlocks: number;
}

const CAT_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  bundles:     { label: "Care Bundles",  color: "#1a7a5e", bg: "#e8f5f1" },
  registers:   { label: "Registers",    color: "#6366f1", bg: "#eef2ff" },
  postpartum:  { label: "Postpartum",   color: "#d97706", bg: "#fff8ed" },
};

function MissionsContent() {
  const { user }   = useAuth();
  const router     = useRouter();
  const params     = useSearchParams();
  const refTeamId  = params.get("ref");

  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [clicked,  setClicked]  = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/missions");
    if (r.ok) { const d = await r.json(); setMissions(d.missions ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Fire link-click action when a logged-in user visits via a referral link
  useEffect(() => {
    if (!refTeamId || !user || clicked) return;
    setClicked(true);
    fetch("/api/missions/action", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ teamId: refTeamId, actionType: "click" }),
    }).catch(() => {});
  }, [refTeamId, user, clicked]);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">
        {/* Header */}
        <div style={{ background: "var(--white)", padding: "16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)" }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg)", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
          <div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700 }}>Missions</div>
            <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>Monthly collective challenges</div>
          </div>
        </div>

        <div style={{ padding: "16px 16px 100px" }}>
          {/* Intro */}
          <div style={{ background: "#e8f5f1", borderRadius: 14, padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "#1a7a5e", marginBottom: 4 }}>How missions work</div>
            <div style={{ fontSize: 13, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
              Join a team of 5 donors. Every action your team takes (sharing, listing, donating) fills 40 blocks. When the mission completes, the platform translates that into real outcomes for mothers.
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--mid)" }}>Loading missions…</div>
          ) : missions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>No active missions this month.</div>
          ) : (
            missions.map((m) => {
              const badge = CAT_BADGE[m.category] ?? CAT_BADGE.bundles;
              const progress = Math.min(100, Math.round((m.avgBlocks / m.goalBlocks) * 100));
              return (
                <div
                  key={m.id}
                  onClick={() => router.push(`/missions/${m.id}/how-it-works`)}
                  style={{ background: "var(--white)", borderRadius: 16, padding: "16px", marginBottom: 12, border: "1px solid var(--border)", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "#1a1a1a", flex: 1, paddingRight: 8 }}>{m.name}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: badge.bg, color: badge.color, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {badge.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.5, marginBottom: 12 }}>{m.description}</div>

                  {/* Progress bar */}
                  <div style={{ background: "#e8e4de", borderRadius: 6, height: 6, marginBottom: 10, overflow: "hidden" }}>
                    <div style={{ width: `${progress}%`, height: "100%", background: "#6d5acd", borderRadius: 6, transition: "width 0.4s ease" }} />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                      {m.totalMembers} donor{m.totalMembers !== 1 ? "s" : ""} active
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#6d5acd", fontFamily: "Nunito, sans-serif" }}>
                      Join mission →
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

export default function MissionsPage() {
  return (
    <Suspense fallback={<div style={{ background: "var(--bg)", minHeight: "100vh" }} />}>
      <MissionsContent />
    </Suspense>
  );
}
