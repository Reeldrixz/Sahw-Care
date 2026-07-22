"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";

interface MissionDetail {
  id: string;
  name: string;
  description: string;
  category: string;
  goalBlocks: number;
}

const BLOCK_COLORS = {
  completed: "#1a7a5e",
  activity:  "#a8d4bf",
  signup:    "#c8d8c8",
  click:     "#d4cfc8",
  empty:     "#e8e4de",
  // legacy aliases kept for demoBlocks
  donation:  "#1a7a5e",
  listing:   "#a8d4bf",
};

export default function HowItWorksPage() {
  const { user }   = useAuth();
  const router     = useRouter();
  const { id }     = useParams<{ id: string }>();

  const [mission,  setMission]  = useState<MissionDetail | null>(null);
  const [joining,  setJoining]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/missions/${id}`).then(r => r.json()),
      fetch("/api/missions/my").then(r => r.json()).catch(() => ({})),
    ]).then(([missionData, myData]) => {
      if (missionData.mission) setMission(missionData.mission);
      if (myData.membership?.mission?.id === id) setIsMember(true);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleJoin = async () => {
    if (!user) { router.push("/auth"); return; }
    setJoining(true);
    setError(null);
    const res = await fetch(`/api/missions/${id}/join`, { method: "POST" });
    const d   = await res.json();
    if (res.ok) {
      router.push("/missions/my");
    } else {
      setError(d.error ?? "Something went wrong");
      setJoining(false);
    }
  };

  // Example 40-block grid for the visual — pre-filled demo layout
  const demoBlocks = Array.from({ length: 40 }, (_, i) => {
    if (i < 8)  return "completed";
    if (i < 16) return "activity";
    if (i < 20) return "signup";
    if (i < 24) return "click";
    return "empty";
  });

  if (loading) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!mission) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh", padding: 24, textAlign: "center", fontFamily: "Nunito, sans-serif", color: "var(--mid)" }}>
        Mission not found.
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">
        {/* Header */}
        <div style={{ background: "var(--white)", padding: "16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)" }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg)", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
          <div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700 }}>How It Works</div>
            <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>{isMember ? "You're already a member" : "Before you join"}</div>
          </div>
        </div>

        <div style={{ padding: "20px 16px 140px" }}>

          {/* Hero */}
          <div style={{ background: "#1a7a5e", borderRadius: 18, padding: "24px 20px", marginBottom: 20, color: "white" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🤝</div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{mission.name}</div>
            <div style={{ fontSize: 14, fontFamily: "Nunito, sans-serif", opacity: 0.9, lineHeight: 1.6 }}>{mission.description}</div>
          </div>

          {/* What is a mission */}
          <div style={{ background: "var(--white)", borderRadius: 16, padding: "18px 16px", marginBottom: 14, border: "1px solid var(--border)" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, marginBottom: 10 }}>What is a mission?</div>
            <div style={{ fontSize: 13, fontFamily: "Nunito, sans-serif", color: "var(--mid)", lineHeight: 1.7 }}>
              A mission is a monthly collective challenge. You join a team of 5 partners. Together, your actions fill a shared progress bar toward 40 essentials. As your team works together, Kradel turns those actions into verified maternal care.
            </div>
          </div>

          {/* Team avatars */}
          <div style={{ background: "var(--white)", borderRadius: 16, padding: "18px 16px", marginBottom: 14, border: "1px solid var(--border)" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Your team of 5</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {["You", "A", "F", "G", "?"].map((init, i) => (
                <div key={i} style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: i === 0 ? "#1a7a5e" : i === 4 ? "#e8e4de" : "#7bc4a4",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 14,
                  color: i === 4 ? "#a0a0a0" : "white",
                  border: i === 0 ? "2.5px solid #1a7a5e" : "2.5px solid transparent",
                }}>
                  {init}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
              Every team has a maximum of 5 donors. You'll be matched with others working toward the same mission this month.
            </div>
          </div>

          {/* Block grid */}
          <div style={{ background: "var(--white)", borderRadius: 16, padding: "18px 16px", marginBottom: 14, border: "1px solid var(--border)" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>40 essentials for mothers this month</div>
            <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 14 }}>
              Every step your team takes is real maternal care delivered.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 5, marginBottom: 16 }}>
              {demoBlocks.map((type, i) => (
                <div
                  key={i}
                  style={{
                    height: 28, borderRadius: 5,
                    background: BLOCK_COLORS[type as keyof typeof BLOCK_COLORS],
                    transition: "opacity 0.3s",
                  }}
                />
              ))}
            </div>

            {/* Stacked progress bar */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", fontFamily: "Nunito, sans-serif", marginBottom: 6 }}>How mission progress adds up</div>
              <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "#e8e4de" }}>
                <div style={{ width: "20%", background: BLOCK_COLORS.completed, borderRadius: "7px 0 0 7px" }} />
                <div style={{ width: "20%", background: BLOCK_COLORS.activity  }} />
                <div style={{ width: "10%", background: BLOCK_COLORS.signup    }} />
                <div style={{ width: "10%", background: BLOCK_COLORS.click     }} />
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                {([
                  { color: BLOCK_COLORS.completed, label: "Fulfilled" },
                  { color: BLOCK_COLORS.activity,  label: "Activity" },
                  { color: BLOCK_COLORS.signup,    label: "Sign-up" },
                  { color: BLOCK_COLORS.click,     label: "Visit" },
                  { color: BLOCK_COLORS.empty,     label: "Unfilled" },
                ] as const).map(({ color, label }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: color, border: color === BLOCK_COLORS.empty ? "1px solid #ccc" : "none" }} />
                    <span style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* How the bar fills */}
          <div style={{ background: "var(--white)", borderRadius: 16, padding: "18px 16px", marginBottom: 14, border: "1px solid var(--border)" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, marginBottom: 14 }}>How your mission creates impact</div>

            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", color: "#8a8a8a", textTransform: "uppercase", marginBottom: 6 }}>AWARENESS</div>
            {[
              { icon: "🔗", title: "Mission visit",    action: "Someone visits Kradel through your shared link." },
              { icon: "👤", title: "Account created", action: "They sign up through your link." },
            ].map(({ icon, title, action }) => (
              <div key={title} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", color: "var(--ink)" }}>{title}</div>
                  <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginTop: 2 }}>{action}</div>
                </div>
              </div>
            ))}

            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", color: "#8a8a8a", textTransform: "uppercase", marginBottom: 6, marginTop: 14 }}>ACTIVITY</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📦</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", color: "var(--ink)" }}>Item listed or register committed</div>
                <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginTop: 2 }}>They list an item to donate or commit to a register.</div>
              </div>
            </div>

            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", color: "#8a8a8a", textTransform: "uppercase", marginBottom: 6, marginTop: 14 }}>OUTCOME</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>💚</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", color: "var(--ink)" }}>Support delivered</div>
                <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginTop: 2 }}>A request is fulfilled, listing completed, or bundle delivered.</div>
              </div>
            </div>
          </div>

          {/* Mission flow */}
          <div style={{ background: "var(--white)", borderRadius: 16, padding: "18px 16px", marginBottom: 14, border: "1px solid var(--border)" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Mission flow</div>
            <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.7, marginBottom: 16 }}>
              Every action matters. Whether you share, donate, or fulfil a request, your contribution moves the mission forward. No one has to do all of it.
            </div>
            {[
              { step: "1", label: "Accept the mission",      desc: "You join a team of 5 donors." },
              { step: "2", label: "Share, list, deliver care", desc: "Every action your team takes moves the mission forward, and Kradel turns it into verified maternal care." },
              { step: "3", label: "Mission completes",       desc: "When the shared goal is reached, the mission is done." },
              { step: "4", label: "See the real outcome",    desc: "The platform shows what your team's work funded." },
            ].map(({ step, label, desc }) => (
              <div key={step} style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a7a5e", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                  {step}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", color: "var(--ink)" }}>{label}</div>
                  <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginTop: 2 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Impact translation */}
          <div style={{ background: "linear-gradient(135deg, #1a7a5e 0%, #22a37c 100%)", borderRadius: 16, padding: "18px 16px", marginBottom: 14 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: "white", marginBottom: 8 }}>When the mission completes</div>
            <div style={{ fontSize: 13, fontFamily: "Nunito, sans-serif", color: "rgba(255,255,255,0.9)", lineHeight: 1.7, marginBottom: 14 }}>
              Your mission&rsquo;s progress translates into real outcomes. The whole team sees exactly what the mission made possible.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { val: "8",  label: "Mothers reached", icon: "🤱🏽" },
                { val: "24", label: "Items fulfilled",  icon: "🎁"  },
                { val: "3",  label: "Kits delivered",   icon: "📦"  },
              ].map(({ val, label, icon }) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, margin: "0 auto 8px" }}>{icon}</div>
                  <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: "white" }}>{val}</div>
                  <div style={{ fontSize: 10, fontFamily: "Nunito, sans-serif", color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Community note */}
          <div style={{ background: "var(--white)", borderRadius: 16, padding: "16px", marginBottom: 20, border: "1px solid var(--border)", textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>💛</div>
            <div style={{ fontSize: 13, fontFamily: "Nunito, sans-serif", color: "var(--mid)", lineHeight: 1.7 }}>
              This is not a competition. Every team's work matters equally. Missions exist to connect donors around a shared purpose. Not to rank them.
            </div>
          </div>

          {error && (
            <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#dc2626", fontFamily: "Nunito, sans-serif" }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Sticky CTA */}
      <div style={{ position: "fixed", bottom: 60, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, padding: "0 16px", zIndex: 50 }}>
        {isMember ? (
          <button
            onClick={() => router.push("/missions/my")}
            style={{ width: "100%", padding: "16px", background: "#6d5acd", color: "white", border: "none", borderRadius: 16, fontFamily: "Nunito, sans-serif", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px rgba(109,90,205,0.35)" }}
          >
            ← Back to my mission
          </button>
        ) : (
          <button
            onClick={handleJoin}
            disabled={joining}
            style={{ width: "100%", padding: "16px", background: joining ? "#7bc4a4" : "#1a7a5e", color: "white", border: "none", borderRadius: 16, fontFamily: "Nunito, sans-serif", fontSize: 15, fontWeight: 800, cursor: joining ? "default" : "pointer", boxShadow: "0 4px 20px rgba(26,122,94,0.35)" }}
          >
            {joining ? "Joining…" : "Accept Mission"}
          </button>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
