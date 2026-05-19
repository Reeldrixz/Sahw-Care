"use client";

import { useEffect } from "react";
import {
  X, Calendar, Heart, Leaf, ArrowRight,
  HeartPulse, Sprout, Moon, Star, Users, Globe, Sun,
  Zap, BookOpen, Package, MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { STAGE_BULLETS, StageBullet, StageKey } from "@/lib/stage";

interface TransitionStatus {
  currentStageKey:  string;
  currentStageName: string;
  currentStageDesc: string;
  nextStageKey:     string;
  nextStageName:    string;
  nextStageDesc:    string;
  daysUntil:        number;
  transitionDate:   string;
}

interface Props {
  status:    TransitionStatus;
  circleId:  string;
  onDismiss: () => void;
}

const STAGE_LUCIDE: Record<string, LucideIcon> = {
  "pregnancy-0-3":    HeartPulse,
  "pregnancy-4-6":    Sprout,
  "pregnancy-7-9":    Star,
  "postpartum-0-3":   Sun,
  "postpartum-4-6":   Moon,
  "postpartum-7-12":  Globe,
  "postpartum-13-24": Heart,
};

const BULLET_ICON_MAP: Record<string, LucideIcon> = {
  "heart-pulse":    HeartPulse,
  "sprout":         Sprout,
  "star":           Star,
  "users":          Users,
  "moon":           Moon,
  "globe":          Globe,
  "sun":            Sun,
  "leaf":           Leaf,
  "zap":            Zap,
  "book-open":      BookOpen,
  "package":        Package,
  "message-circle": MessageCircle,
  "heart":          Heart,
};

const DEFAULT_BULLETS: [StageBullet, StageBullet, StageBullet] = [
  { icon: "heart",  title: "A new chapter begins",       description: "New support and connection awaits in your next stage." },
  { icon: "users",  title: "New topics & support",        description: "Conversations tailored to where you are in your journey." },
  { icon: "sprout", title: "Mothers at the same stage",   description: "You're never navigating this alone." },
];

export default function StageTransitionModal({ status, circleId, onDismiss }: Props) {
  const {
    currentStageKey, currentStageName, currentStageDesc,
    nextStageKey, nextStageName, nextStageDesc,
    daysUntil, transitionDate,
  } = status;

  const bullets   = STAGE_BULLETS[nextStageKey as StageKey] ?? DEFAULT_BULLETS;
  const dateLabel = new Date(transitionDate).toLocaleDateString("en", {
    month: "long", day: "numeric", year: "numeric",
  });

  const handleDismiss = async () => {
    try {
      await fetch("/api/user/transition-status", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ circleId }),
      });
    } catch { /* ignore */ }
    onDismiss();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleDismiss(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const CurrentIcon = STAGE_LUCIDE[currentStageKey] ?? Heart;
  const NextIcon    = STAGE_LUCIDE[nextStageKey]    ?? Heart;

  return (
    <div
      onClick={handleDismiss}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px 16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: 28,
          width: "100%", maxWidth: 460,
          maxHeight: "90vh", overflowY: "auto",
          padding: "28px 24px 32px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          position: "relative",
        }}
      >
        {/* × close */}
        <button
          onClick={handleDismiss}
          style={{
            position: "absolute", top: 16, right: 16,
            background: "#f5f5f0", border: "none", borderRadius: "50%",
            width: 32, height: 32, display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer",
          }}
        >
          <X size={15} color="#9ca3af" />
        </button>

        {/* Top icon area — leaf · calendar+heart tile · leaf */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 18 }}>
          <Leaf size={16} color="#b7dfd1" strokeWidth={1.5} style={{ transform: "scaleX(-1)" }} />
          <div style={{
            width: 64, height: 64, borderRadius: "50%", background: "#e8f5f1",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 0 6px rgba(232,245,241,0.5)",
            position: "relative",
          }}>
            <Calendar size={28} strokeWidth={1.75} color="#1a7a5e" />
            <div style={{
              position: "absolute", bottom: 8, right: 6,
              width: 18, height: 18, borderRadius: "50%",
              background: "#e8f5f1", border: "2px solid white",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Heart size={9} color="#1a7a5e" fill="#1a7a5e" />
            </div>
          </div>
          <Leaf size={16} color="#b7dfd1" strokeWidth={1.5} />
        </div>

        {/* Title + subtitle */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: "#1a7a5e", lineHeight: 1.3, marginBottom: 8 }}>
            A new stage is coming soon!
          </div>
          <div style={{ fontSize: 14, color: "#6b7280", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
            In <strong style={{ color: "#1a1a1a" }}>{daysUntil} {daysUntil === 1 ? "day" : "days"}</strong>, you&apos;ll be transitioning to a new Circle stage.
          </div>
        </div>

        {/* Stage cards row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          {/* Current */}
          <div style={{ flex: 1, background: "#faf8f3", borderRadius: 16, padding: "16px 12px", textAlign: "center" }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%", background: "#e8e4de",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px",
            }}>
              <CurrentIcon size={18} color="#6b7280" strokeWidth={1.75} />
            </div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 800, color: "#555", marginBottom: 3, lineHeight: 1.3 }}>
              {currentStageName}
            </div>
            <div style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1.4 }}>{currentStageDesc}</div>
          </div>

          {/* Circular arrow */}
          <div style={{
            width: 32, height: 32, borderRadius: "50%", border: "1.5px solid #d1d5db",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <ArrowRight size={14} color="#9ca3af" />
          </div>

          {/* Next */}
          <div style={{ flex: 1, background: "#e8f5f1", borderRadius: 16, padding: "16px 12px", textAlign: "center", border: "1.5px solid #b7dfd1" }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%", background: "#b7dfd1",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px",
            }}>
              <NextIcon size={18} color="#1a7a5e" strokeWidth={1.75} />
            </div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 800, color: "#1a7a5e", marginBottom: 3, lineHeight: 1.3 }}>
              {nextStageName}
            </div>
            <div style={{ fontSize: 10, color: "#1a7a5e", opacity: 0.7, lineHeight: 1.4 }}>{nextStageDesc}</div>
          </div>
        </div>

        {/* Date pill */}
        <div style={{
          background: "#e8f5f1", borderRadius: 20, padding: "8px 16px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          marginBottom: 22,
        }}>
          <Calendar size={13} color="#1a7a5e" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1a7a5e", fontFamily: "Nunito, sans-serif" }}>
            {daysUntil} {daysUntil === 1 ? "day" : "days"} until the transition
          </span>
          <span style={{ fontSize: 11, color: "#1a7a5e", opacity: 0.65 }}>· {dateLabel}</span>
        </div>

        {/* What this stage means */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", color: "#1a1a1a", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <span>✨</span> What this stage means
          </div>
          {bullets.map((b, i) => {
            const BulletIcon = BULLET_ICON_MAP[b.icon] ?? Heart;
            return (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%", background: "#e8f5f1",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <BulletIcon size={15} color="#1a7a5e" strokeWidth={1.75} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", marginBottom: 2 }}>{b.title}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>{b.description}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Cream callout */}
        <div style={{
          background: "#faf8f3", borderRadius: 14, padding: "14px 16px",
          display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 24,
        }}>
          <Leaf size={16} color="#b7dfd1" strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 13, color: "#555", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, marginBottom: 4 }}>
              You&apos;ll be able to introduce yourself to your new Circle on the day of your transition.
            </div>
            <div style={{ fontSize: 12, color: "#1a7a5e", fontFamily: "Lora, serif", fontStyle: "italic", lineHeight: 1.6 }}>
              You&apos;re never alone in this journey. ♡
            </div>
          </div>
        </div>

        {/* Got it */}
        <button
          onClick={handleDismiss}
          style={{
            width: "100%", padding: "15px", background: "#1a7a5e", color: "white",
            border: "none", borderRadius: 16, fontSize: 15, fontWeight: 800,
            fontFamily: "Nunito, sans-serif", cursor: "pointer",
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
