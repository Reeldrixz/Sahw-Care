"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import CirclePostCard, { Post } from "@/components/CirclePostCard";
import CircleComposer from "@/components/CircleComposer";
import CircleComments from "@/components/CircleComments";
import CircleIdentityModal from "@/components/CircleIdentityModal";
import StageTransitionModal from "@/components/StageTransitionModal";
import StageRefinementBanner from "@/components/StageRefinementBanner";
import { STAGE_META, StageKey } from "@/lib/stage";
import BottomNav from "@/components/BottomNav";
import {
  HeartPulse, Heart, Smile, Star, LayoutGrid,
  Users, Lightbulb, BookOpen, HandHeart, HelpCircle, Trophy, Target,
  X, Shield,
  type LucideIcon,
} from "lucide-react";

// ── Stage icon map ─────────────────────────────────────────────────────────────

const STAGE_ICONS: Record<string, LucideIcon> = {
  "pregnancy-0-3":    HeartPulse,
  "pregnancy-4-6":    HeartPulse,
  "pregnancy-7-9":    HeartPulse,
  "postpartum-0-3":   Heart,
  "postpartum-4-6":   Smile,
  "postpartum-7-12":  Smile,
  "postpartum-13-24": Star,
};

function StageIconComp({ stageKey, size = 20, color = "white" }: { stageKey: string; size?: number; color?: string }) {
  const Icon = STAGE_ICONS[stageKey] ?? Heart;
  return <Icon size={size} strokeWidth={1.75} color={color} />;
}

// ── Weekly prompt ──────────────────────────────────────────────────────────────

const WEEKLY_PROMPTS = [
  "What's the most useful thing someone told you this week?",
  "What are you proud of yourself for right now, however small?",
  "What do you wish more people talked about openly?",
  "Share a small win from today. Even tiny counts.",
  "What would you tell your pre-pregnancy self?",
  "What's one thing that has genuinely helped you lately?",
  "What does support look like for you right now?",
];

function getWeeklyPrompt(): string {
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week  = Math.floor((now.getTime() - start.getTime()) / (7 * 86400 * 1000));
  return WEEKLY_PROMPTS[week % WEEKLY_PROMPTS.length];
}

// ── Post filters ───────────────────────────────────────────────────────────────

type PostCategory = "ALL" | "TIP" | "STORY" | "GRATITUDE" | "QUESTION" | "SMALL_WIN" | "SUPPORT" | "WORKING_ON";

const POST_FILTERS: { value: PostCategory; label: string }[] = [
  { value: "ALL",        label: "All"        },
  { value: "QUESTION",   label: "Questions"  },
  { value: "WORKING_ON", label: "Working on" },
  { value: "TIP",        label: "Tips"       },
  { value: "STORY",      label: "Stories"    },
  { value: "SMALL_WIN",  label: "Small Wins" },
  { value: "GRATITUDE",  label: "Gratitude"  },
];

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  TIP: Lightbulb, STORY: BookOpen, GRATITUDE: HandHeart,
  QUESTION: HelpCircle, SMALL_WIN: Trophy, SUPPORT: Users, WORKING_ON: Target,
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface StageCircle {
  id: string; name: string; stageKey: string;
  memberCount: number; postCount: number;
  isPrimary: boolean; isGraduated: boolean;
}

interface Channel { id: string; name: string; emoji: string; order: number; }

interface Member { joinedAt: string; isLeader: boolean; lastViewedAt: string | null; }

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (86400 * 1000));
}

function isNewMember(joinedAt: string): boolean {
  return daysAgo(joinedAt) < 7;
}

function useModBannerDismissed(circleId: string) {
  const key = `mod_banner_${circleId}`;
  // Start "dismissed" so server and first client render match (no hydration
  // mismatch); read the real value from localStorage after mount.
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    setDismissed(localStorage.getItem(key) === "1");
  }, [key]);
  const dismiss = () => { localStorage.setItem(key, "1"); setDismissed(true); };
  return [dismissed, dismiss] as const;
}

// ── Guidelines modal ───────────────────────────────────────────────────────────

const GUIDELINES = [
  "No medical misinformation",
  "No MLM products or promotions",
  "No scammers or suspicious links",
  "No creepy or inappropriate users",
  "No judgment wars",
  "No postpartum triggering content without a warning",
  "No religious or political arguments",
];

function GuidelinesModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "white", borderRadius: "20px 20px 0 0", padding: "24px 20px 48px", maxWidth: 520, width: "100%", maxHeight: "80vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>Circle Guidelines</div>
          <button
            onClick={onClose}
            style={{ background: "var(--bg)", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <X size={16} color="var(--mid)" />
          </button>
        </div>
        <div style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.6, marginBottom: 18 }}>
          This circle is a safe, supportive space. Please respect these community guidelines.
        </div>
        {GUIDELINES.map((rule) => (
          <div key={rule} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.5 }}>🚫</span>
            <span style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.55 }}>{rule}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CircleDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router   = useRouter();
  const params   = useParams<{ id: string }>();
  const circleId = params?.id ?? "";

  // Circle metadata
  const [stageCircle,    setStageCircle]    = useState<StageCircle | null>(null);
  const [channels,       setChannels]       = useState<Channel[]>([]);
  const [member,         setMember]         = useState<Member | null>(null);
  const [isCountryMember, setIsCountryMember] = useState(false);
  const [circleName,     setCircleName]     = useState<string>("");

  // Feed
  const [posts,          setPosts]          = useState<Post[]>([]);
  const [postCategory,   setPostCategory]   = useState<PostCategory>("ALL");
  const [activeChannel,  setActiveChannel]  = useState<string>("ALL");
  const [cursor,         setCursor]         = useState<string | null>(null);
  const [hasMore,        setHasMore]        = useState(false);
  const [loadingPosts,   setLoadingPosts]   = useState(false);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);

  // UI
  const [promptDismissed,   setPromptDismissed]   = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [showGuidelines,    setShowGuidelines]    = useState(false);
  const [modBannerDismissed, dismissModBanner]    = useModBannerDismissed(circleId);

  // Transition countdown
  const [transitionStatus, setTransitionStatus] = useState<null | {
    applicable: boolean; daysUntil: number | null; nextStageKey: string | null;
    nextStageName: string | null; nextStageDesc: string | null;
    currentStageKey: string; currentStageName: string; currentStageDesc: string;
    transitionDate: string | null; hasSeenTransitionModal: boolean;
    showSurveyBanner: boolean; surveyCompleted: boolean; surveyOptedOut: boolean;
    journeyType: "pregnant" | "postpartum";
  }>(null);
  const [showTransitionModal, setShowTransitionModal] = useState(false);

  // ── Load circle metadata ──────────────────────────────────────────────────

  useEffect(() => {
    if (!user || authLoading || !circleId) return;

    // Try stages list (gives isPrimary, isGraduated, memberCount)
    if (user.currentCircleId) {
      fetch("/api/circles/stages", { cache: "no-store" })
        .then(r => r.json())
        .then(d => {
          const found = (d.circles as StageCircle[] ?? []).find(c => c.id === circleId);
          if (found) setStageCircle(found);
        });
    }

    // Try cohort (gives channels + member info)
    fetch("/api/circles/cohort", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (d.circle?.id === circleId) {
          setChannels(d.channels ?? []);
          setMember(d.member ?? null);
          setCircleName(d.circle.name ?? "");
        }
      });

    // Check country circle membership
    fetch("/api/circles/my", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (d.circle?.id === circleId) {
          setIsCountryMember(true);
          setCircleName(d.circle.name ?? "");
          if (!member && d.member) setMember(d.member);
        }
      });
  }, [user, authLoading, circleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Transition status ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!user || !user.onboardingComplete || user.journeyType === "donor") return;
    fetch("/api/user/transition-status")
      .then(r => r.json())
      .then(d => {
        if (!d.applicable) return;
        setTransitionStatus(d);
        if (
          d.daysUntil !== null && d.daysUntil <= 30 && d.daysUntil >= 0 &&
          !d.hasSeenTransitionModal && d.nextStageKey
        ) {
          const t = setTimeout(() => setShowTransitionModal(true), 1200);
          return () => clearTimeout(t);
        }
      })
      .catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Identity modal ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user || user.journeyType === "donor") return;
    if (user.circleIdentitySet) return;
    if (user.circleIdentitySkippedAt) {
      const d = (Date.now() - new Date(user.circleIdentitySkippedAt).getTime()) / (86400 * 1000);
      if (d < 7) return;
    }
    const t = setTimeout(() => setShowIdentityModal(true), 800);
    return () => clearTimeout(t);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load posts ────────────────────────────────────────────────────────────

  const loadPosts = useCallback(async (reset = false) => {
    if (!circleId) return;
    setLoadingPosts(true);
    const cur = reset ? null : cursor;
    const p   = new URLSearchParams({ category: postCategory });
    if (activeChannel !== "ALL") p.set("channelId", activeChannel);
    if (cur) p.set("cursor", cur);
    const res = await fetch(`/api/circles/${circleId}/posts?${p}`, { cache: "no-store" });
    if (res.ok) {
      const d = await res.json();
      setPosts(prev => reset ? d.posts : [...prev, ...d.posts]);
      setCursor(d.nextCursor);
      setHasMore(!!d.nextCursor && d.posts.length === 20);
    }
    setLoadingPosts(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId, postCategory, activeChannel, cursor]);

  useEffect(() => {
    if (circleId) { setPosts([]); setCursor(null); loadPosts(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId, postCategory, activeChannel]);

  // ── SSE ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!circleId || !user) return;
    const since = new Date().toISOString();
    let es: EventSource | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      es = new EventSource(`/api/circles/${circleId}/stream?since=${encodeURIComponent(since)}`);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "new_post" && data.post) {
            const p = data.post as Post;
            if (p.author.id === user.id) return;
            setPosts(prev => prev.some(x => x.id === p.id) ? prev : [p, ...prev]);
          }
        } catch {}
      };
      es.onerror = () => { es?.close(); reconnect = setTimeout(connect, 5000); };
    };

    connect();
    return () => { es?.close(); if (reconnect) clearTimeout(reconnect); };
  }, [circleId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Post actions ──────────────────────────────────────────────────────────

  const handleDelete = async (postId: string) => {
    if (!confirm("Delete this post?")) return;
    await fetch(`/api/circles/posts/${postId}`, { method: "DELETE" });
    setPosts(p => p.filter(x => x.id !== postId));
  };

  const handlePin = async (postId: string, pin: boolean) => {
    await fetch(`/api/circles/posts/${postId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: pin }),
    });
    setPosts(p =>
      p.map(x => x.id === postId ? { ...x, isPinned: pin } : x)
        .sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
    );
  };

  // ── Guards ────────────────────────────────────────────────────────────────

  if (authLoading) {
    return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;
  }
  if (!user) { router.push("/auth"); return null; }

  // ── Derived values ────────────────────────────────────────────────────────

  const stageKey      = stageCircle?.stageKey ?? "";
  const stageMeta     = STAGE_META[stageKey as StageKey];
  const displayName   = stageMeta?.label ?? (circleName || "Circle");
  const memberCount   = stageCircle?.memberCount ?? 0;
  const isMember      = (stageCircle?.isPrimary === true) || (member !== null) || isCountryMember;
  const isGraduated   = stageCircle?.isGraduated === true;
  const isAdminOrLeader = user.role === "ADMIN" || member?.isLeader === true;
  const joined        = member ? daysAgo(member.joinedAt) : 0;
  const showWelcome   = member && isNewMember(member.joinedAt);
  const weekPrompt    = getWeeklyPrompt();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>

      {/* ── Header ── */}
      {isMember ? (
        /* Member header — matches old cohort circle style */
        <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "20px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <StageIconComp stageKey={stageKey} size={22} color="white" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 2 }}>
                  YOUR CIRCLE
                </div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "white", lineHeight: 1.2 }}>
                  {displayName}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                    <Users size={11} />
                    {memberCount.toLocaleString()}
                  </div>
                  {member && joined > 0 && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                      · Joined {joined}d ago
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => router.push("/circles/all")}
              style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginTop: 2 }}
              title="All circles"
            >
              <LayoutGrid size={18} color="white" />
            </button>
          </div>

          {/* Channel tabs */}
          {channels.length > 0 && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 14, scrollbarWidth: "none" }}>
              <button
                onClick={() => setActiveChannel("ALL")}
                style={{
                  flexShrink: 0, padding: "7px 16px", borderRadius: 20, border: "none",
                  background: activeChannel === "ALL" ? "white" : "rgba(255,255,255,0.15)",
                  color: activeChannel === "ALL" ? "var(--green)" : "rgba(255,255,255,0.85)",
                  fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif",
                }}
              >
                All
              </button>
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch.id)}
                  style={{
                    flexShrink: 0, padding: "7px 14px", borderRadius: 20, border: "none",
                    background: activeChannel === ch.id ? "white" : "rgba(255,255,255,0.15)",
                    color: activeChannel === ch.id ? "var(--green)" : "rgba(255,255,255,0.85)",
                    fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif", whiteSpace: "nowrap",
                  }}
                >
                  {ch.emoji} {ch.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Visiting / graduated header — matches old visiting circle style */
        <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "16px 16px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => router.push("/circles/all")}
              style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "7px 12px", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", flexShrink: 0 }}
            >
              ← Back
            </button>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <StageIconComp stageKey={stageKey} size={20} color="white" />
            </div>
            <div>
              <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: "white" }}>
                {displayName}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
                {memberCount.toLocaleString()} members
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div style={{ padding: "16px 16px 0" }}>

        {/* Refinement survey banner */}
        {transitionStatus?.showSurveyBanner && (
          <StageRefinementBanner
            journeyType={transitionStatus.journeyType}
            onCompleted={() => setTransitionStatus(prev => prev ? { ...prev, showSurveyBanner: false, surveyCompleted: true } : prev)}
          />
        )}

        {/* 1. Safe space banner (members only) */}
        {isMember && (
          <div style={{
            background: "var(--green-light)", border: "1.5px solid var(--green)",
            borderRadius: 14, padding: "12px 14px", marginBottom: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Heart size={15} color="var(--green)" strokeWidth={2} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: "#1a5c45" }}>You&apos;re in a safe space</span>
            </div>
            <div style={{ fontSize: 12, color: "#1a5c45", lineHeight: 1.6, marginBottom: 6 }}>
              Support is what we do here. Please be kind, respectful, and uplifting.
            </div>
            <button
              onClick={() => setShowGuidelines(true)}
              style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Nunito, sans-serif" }}
            >
              View guidelines ›
            </button>
          </div>
        )}

        {/* 2. Visiting banner (non-members, non-graduated) */}
        {!isMember && !isGraduated && (
          <div style={{
            background: "#f8fafc", border: "1.5px solid #cbd5e1",
            borderRadius: 14, padding: "12px 14px", marginBottom: 14,
            display: "flex", alignItems: "flex-start", gap: 10,
          }}>
            <Shield size={15} color="#64748b" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 3 }}>
                You&apos;re visiting this circle.
              </div>
              <div style={{ fontSize: 12, color: "var(--mid)", lineHeight: 1.55, marginBottom: 6 }}>
                You can read and comment, but posting is for members at this stage.
              </div>
              <button
                onClick={() => router.push("/profile")}
                style={{ fontSize: 12, fontWeight: 700, color: "#1a7a5e", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Nunito, sans-serif" }}
              >
                Learn how to join →
              </button>
            </div>
          </div>
        )}

        {/* 3. Graduated banner */}
        {isGraduated && (
          <div style={{
            background: "#eff6ff", border: "1.5px solid #93c5fd",
            borderRadius: 14, padding: "12px 14px", marginBottom: 14,
            display: "flex", alignItems: "flex-start", gap: 10,
          }}>
            <Shield size={15} color="#2563eb" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: "#1e40af", lineHeight: 1.55 }}>
              You were here once. Your posts are still here and you can still comment.
            </div>
          </div>
        )}

        {/* Welcome card (new members — first 7 days) */}
        {showWelcome && (
          <div style={{ background: "var(--green-light)", borderRadius: 16, padding: "16px", marginBottom: 16, border: "1.5px solid var(--green)" }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: "var(--green)", marginBottom: 6 }}>
              Welcome to your circle
            </div>
            <div style={{ fontSize: 13, color: "#1a5c45", lineHeight: 1.6 }}>
              You&apos;re now with mothers at exactly your stage. This is a space to share, ask, and be heard. Without judgment.
              Start by introducing yourself, or just read along.
            </div>
            <div style={{ fontSize: 11, color: "var(--mid)", marginTop: 8 }}>
              {memberCount.toLocaleString()} members · Joined {joined === 0 ? "today" : `${joined}d ago`}
            </div>
          </div>
        )}

        {/* Moderation banner (one-time, members only) */}
        {isMember && !modBannerDismissed && (
          <div style={{
            background: "white", borderRadius: 14, padding: "12px 14px",
            marginBottom: 16, border: "1px solid var(--border)",
            display: "flex", alignItems: "flex-start", gap: 12,
          }}>
            <div style={{ flex: 1, fontSize: 12, color: "var(--mid)", lineHeight: 1.6 }}>
              This circle is a space for kindness, honesty, and real support. Not for requesting items or donations.
              Posts are reviewed before appearing if they trigger our safety filters.
            </div>
            <button
              onClick={dismissModBanner}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--green)", fontWeight: 700, fontFamily: "Nunito, sans-serif", flexShrink: 0 }}
            >
              Got it
            </button>
          </div>
        )}

        {/* Weekly prompt card */}
        {isMember && !promptDismissed && (
          <div style={{
            background: "linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)",
            borderRadius: 14, padding: "14px", marginBottom: 16,
            border: "1px solid #e0e7ff",
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>
              This week&apos;s prompt
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#312e81", lineHeight: 1.5, marginBottom: 10 }}>
              &ldquo;{weekPrompt}&rdquo;
            </div>
            <button
              onClick={() => setPromptDismissed(true)}
              style={{ fontSize: 11, color: "var(--mid)", background: "none", border: "none", cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Composer (members only) */}
        {isMember && (
          <CircleComposer
            circleId={circleId}
            userAvatar={user.avatar}
            userName={user.name}
            channels={channels}
            activeChannelId={activeChannel !== "ALL" ? activeChannel : null}
            onPosted={() => loadPosts(true)}
          />
        )}

        {/* Post type filter tabs (members only) */}
        {isMember && (
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, scrollbarWidth: "none" }}>
            {POST_FILTERS.map((f) => {
              const CatIcon = f.value !== "ALL" ? CATEGORY_ICONS[f.value] : null;
              const active  = postCategory === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setPostCategory(f.value)}
                  style={{
                    flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
                    padding: "6px 13px", borderRadius: 20, border: "1.5px solid",
                    borderColor: active ? "var(--green)" : "var(--border)",
                    background: active ? "var(--green)" : "var(--white)",
                    color: active ? "white" : "var(--mid)",
                    fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif",
                  }}
                >
                  {CatIcon && <CatIcon size={11} strokeWidth={2} color={active ? "white" : "var(--mid)"} />}
                  {f.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Post feed */}
        {loadingPosts && posts.length === 0 ? (
          <div className="loading" style={{ minHeight: 200 }}><div className="spinner" /></div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--mid)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Be the first to post in {displayName}</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>Share a tip, a small win, or something you&apos;re grateful for today.</div>
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <CirclePostCard
                key={post.id}
                post={post}
                currentUserId={user.id}
                isAdminOrLeader={isAdminOrLeader}
                onOpenComments={setCommentsPostId}
                onDelete={handleDelete}
                onPin={handlePin}
              />
            ))}
            {hasMore && (
              <button
                onClick={() => loadPosts(false)}
                disabled={loadingPosts}
                style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--white)", color: "var(--mid)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", marginBottom: 16 }}
              >
                {loadingPosts ? "Loading…" : "Load more"}
              </button>
            )}
          </>
        )}
      </div>

      {/* Comments sheet */}
      {commentsPostId && (
        <CircleComments postId={commentsPostId} onClose={() => { setCommentsPostId(null); loadPosts(true); }} />
      )}

      {/* Identity modal */}
      {showIdentityModal && (
        <CircleIdentityModal onDone={() => setShowIdentityModal(false)} />
      )}

      {/* Guidelines modal */}
      {showGuidelines && <GuidelinesModal onClose={() => setShowGuidelines(false)} />}

      {/* Stage transition countdown modal */}
      {showTransitionModal && transitionStatus && transitionStatus.daysUntil !== null && transitionStatus.nextStageKey && (
        <StageTransitionModal
          status={{
            currentStageKey:  transitionStatus.currentStageKey,
            currentStageName: transitionStatus.currentStageName,
            currentStageDesc: transitionStatus.currentStageDesc,
            nextStageKey:     transitionStatus.nextStageKey,
            nextStageName:    transitionStatus.nextStageName ?? "",
            nextStageDesc:    transitionStatus.nextStageDesc ?? "",
            daysUntil:        transitionStatus.daysUntil,
            transitionDate:   transitionStatus.transitionDate ?? "",
          }}
          circleId={circleId}
          onDismiss={() => {
            setShowTransitionModal(false);
            setTransitionStatus(prev => prev ? { ...prev, hasSeenTransitionModal: true } : prev);
          }}
        />
      )}

      <BottomNav />
    </div>
  );
}
