"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { STAGE_META, StageKey } from "@/lib/stage";
import {
  HeartPulse, Heart, Smile, Star, Users, ChevronRight, ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";

const STAGE_ICONS: Record<string, LucideIcon> = {
  "pregnancy-0-3":    HeartPulse,
  "pregnancy-4-6":    HeartPulse,
  "pregnancy-7-9":    HeartPulse,
  "postpartum-0-3":   Heart,
  "postpartum-4-6":   Smile,
  "postpartum-7-12":  Smile,
  "postpartum-13-24": Star,
};

const STAGE_COLORS: Record<string, { bg: string; color: string }> = {
  "pregnancy-0-3":    { bg: "#d4edda", color: "#1a7a5e" },
  "pregnancy-4-6":    { bg: "#d4edda", color: "#1a7a5e" },
  "pregnancy-7-9":    { bg: "#c3e6cb", color: "#155724" },
  "postpartum-0-3":   { bg: "#f8d7da", color: "#9d174d" },
  "postpartum-4-6":   { bg: "#f8d7da", color: "#9d174d" },
  "postpartum-7-12":  { bg: "#fff3cd", color: "#b45309" },
  "postpartum-13-24": { bg: "#d1ecf1", color: "#1e50a2" },
};

interface StageCircle {
  id: string;
  name: string;
  emoji: string | null;
  stageKey: string;
  groupLetter: string | null;
  memberCount: number;
  postCount: number;
  isPrimary: boolean;
  isGraduated: boolean;
  accessType: string | null;
}

export default function AllCirclesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [circles, setCircles] = useState<StageCircle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    if (!user.currentCircleId) { setLoading(false); return; }
    fetch("/api/circles/stages", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { setCircles(d.circles ?? []); setLoading(false); });
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "20px 16px 16px" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "white" }}>All Circles</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 20px" }}>
          <div className="spinner" />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
      <style>{`
        .circle-row {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px; border-radius: 16px;
          border: 1.5px solid var(--border); background: var(--white);
          box-shadow: var(--shadow);
        }
        .circle-row.primary { border-color: #1a7a5e; background: #f0faf7; }
      `}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "20px 16px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}
          >
            <ArrowLeft size={16} strokeWidth={2} color="white" />
          </button>
          <div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "white" }}>All Circles</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
              Explore every stage of the journey
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {circles.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--mid)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No circles available</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>Complete your profile to see circles for your stage.</div>
          </div>
        ) : (
          circles.map((circle) => {
            const meta  = STAGE_META[circle.stageKey as StageKey];
            const theme = STAGE_COLORS[circle.stageKey] ?? { bg: "#f0f4f2", color: "#1a7a5e" };
            const Icon  = STAGE_ICONS[circle.stageKey] ?? Heart;

            return (
              <div key={circle.id} className={`circle-row${circle.isPrimary ? " primary" : ""}`}>
                {/* Stage icon */}
                <div style={{
                  width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                  background: circle.isPrimary ? "#1a7a5e" : theme.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={22} strokeWidth={1.75} color={circle.isPrimary ? "white" : theme.color} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                    <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                      {meta?.label ?? circle.name}
                    </div>
                    {circle.isPrimary && (
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "#1a7a5e", color: "white", fontFamily: "Nunito, sans-serif" }}>
                        Your Circle
                      </span>
                    )}
                    {circle.isGraduated && !circle.isPrimary && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#f3f4f6", color: "#6b7280", fontFamily: "Nunito, sans-serif" }}>
                        Previously here
                      </span>
                    )}
                  </div>
                  {meta?.description && (
                    <div style={{ fontSize: 11, color: "var(--mid)", lineHeight: 1.4, marginBottom: 3 }}>
                      {meta.description}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--mid)" }}>
                    <Users size={11} strokeWidth={1.75} />
                    {circle.memberCount.toLocaleString()} members
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={() => router.push(`/circles/${circle.id}`)}
                  style={{
                    flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
                    padding: "8px 14px", borderRadius: 20, fontSize: 12, fontWeight: 800,
                    fontFamily: "Nunito, sans-serif", cursor: "pointer",
                    border: circle.isPrimary ? "none" : "1.5px solid var(--border)",
                    background: circle.isPrimary ? "#1a7a5e" : "var(--white)",
                    color: circle.isPrimary ? "white" : "var(--ink)",
                  }}
                >
                  {circle.isPrimary ? "Open" : "Visit"}
                  <ChevronRight size={13} strokeWidth={2.5} />
                </button>
              </div>
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
}
