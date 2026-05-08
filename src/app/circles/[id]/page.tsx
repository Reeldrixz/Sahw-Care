"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import CirclePostCard, { Post } from "@/components/CirclePostCard";
import CircleComposer from "@/components/CircleComposer";
import CircleComments from "@/components/CircleComments";
import CircleIdentityModal from "@/components/CircleIdentityModal";
import { STAGE_META, StageKey, COHORT_CIRCLES } from "@/lib/stage";
import BottomNav from "@/components/BottomNav";
import {
  HeartPulse, Heart, Smile, Star, LayoutGrid, ArrowLeft,
  Users, Lightbulb, BookOpen, HandHeart, HelpCircle, Trophy,
  Info, Sparkles, Shield, Eye, Calendar, MessageCircle, Lock,
  type LucideIcon,
} from "lucide-react";

// ── Stage config ───────────────────────────────────────────────────────────────

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

const MEMBER_AVATAR_COLORS = ["#1a7a5e", "#7c3aed", "#2563eb", "#db2777", "#d97706", "#0891b2"];

// ── Weekly prompt ──────────────────────────────────────────────────────────────

const WEEKLY_PROMPTS = [
  "What's the most useful thing someone told you this week?",
  "What are you proud of yourself for right now — however small?",
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

type PostCategory = "ALL" | "TIP" | "STORY" | "GRATITUDE" | "QUESTION" | "SMALL_WIN" | "SUPPORT";

const POST_FILTERS: { value: PostCategory; label: string }[] = [
  { value: "ALL",       label: "All"        },
  { value: "QUESTION",  label: "Questions"  },
  { value: "SUPPORT",   label: "Support"    },
  { value: "TIP",       label: "Tips"       },
  { value: "STORY",     label: "Stories"    },
  { value: "SMALL_WIN", label: "Small Wins" },
  { value: "GRATITUDE", label: "Gratitude"  },
];

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  TIP: Lightbulb, STORY: BookOpen, GRATITUDE: HandHeart,
  QUESTION: HelpCircle, SMALL_WIN: Trophy, SUPPORT: Users,
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface StageCircle {
  id: string; name: string; emoji: string | null; stageKey: string;
  groupLetter: string | null; memberCount: number; postCount: number;
  isPrimary: boolean; isGraduated: boolean; accessType: string | null;
}

interface Channel { id: string; name: string; emoji: string; order: number; }

interface Member { joinedAt: string; isLeader: boolean; lastViewedAt: string | null; }

interface CohortData {
  circle: { id: string; name: string; stageKey: string | null; _count: { members: number; posts: number } };
  channels: Channel[];
  member: Member | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (86400 * 1000));
}

function useModBannerDismissed(circleId: string) {
  const key = `mod_banner_${circleId}`;
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(key) === "1";
  });
  const dismiss = () => { localStorage.setItem(key, "1"); setDismissed(true); };
  return [dismissed, dismiss] as const;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CircleDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router  = useRouter();
  const params  = useParams<{ id: string }>();
  const circleId = params?.id ?? "";

  // Circle metadata
  const [stageCircle, setStageCircle]   = useState<StageCircle | null>(null);
  const [cohortData,  setCohortData]    = useState<CohortData | null>(null);
  const [isCountryMember, setIsCountryMember] = useState(false);

  // Feed
  const [posts,        setPosts]        = useState<Post[]>([]);
  const [postCategory, setPostCategory] = useState<PostCategory>("ALL");
  const [activeChannel, setActiveChannel] = useState<string>("ALL");
  const [cursor,       setCursor]       = useState<string | null>(null);
  const [hasMore,      setHasMore]      = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);

  // UI
  const [promptDismissed,   setPromptDismissed]   = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [modBannerDismissed, dismissModBanner]    = useModBannerDismissed(circleId);

  // ── Load circle metadata ──────────────────────────────────────────────────

  useEffect(() => {
    if (!user || authLoading || !circleId) return;

    // Try to find in stages list
    if (user.currentCircleId) {
      fetch("/api/circles/stages", { cache: "no-store" })
        .then(r => r.json())
        .then(d => {
          const found = (d.circles as StageCircle[] ?? []).find(c => c.id === circleId);
          if (found) setStageCircle(found);
        });
    }

    // Load cohort (for channels + member info)
    fetch("/api/circles/cohort", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        if (d.circle?.id === circleId) {
          setCohortData({ circle: d.circle, channels: d.channels ?? [], member: d.member ?? null });
        }
      });

    // Check country circle membership
    fetch("/api/circles/my", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.circle?.id === circleId) setIsCountryMember(true); });
  }, [user, authLoading, circleId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── SSE real-time ─────────────────────────────────────────────────────────

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

  // ── Derived display values ────────────────────────────────────────────────

  const stageKey    = stageCircle?.stageKey ?? cohortData?.circle?.stageKey ?? "";
  const stageMeta   = STAGE_META[stageKey as StageKey];
  const circleName  = stageMeta?.label ?? stageCircle?.name ?? cohortData?.circle?.name ?? "Circle";
  const memberCount = stageCircle?.memberCount ?? cohortData?.circle?._count?.members ?? 0;
  const postCount   = stageCircle?.postCount   ?? cohortData?.circle?._count?.posts   ?? 0;

  const StageIconComp = STAGE_ICONS[stageKey] ?? Heart;
  const theme         = STAGE_COLORS[stageKey] ?? { bg: "#f0f4f2", color: "#1a7a5e" };

  const cohortChannels = cohortData?.channels ?? [];
  const cohortMember   = cohortData?.member   ?? null;
  const joined         = cohortMember ? daysAgo(cohortMember.joinedAt) : 0;

  const isMember     = (stageCircle?.isPrimary === true) || (cohortData !== null) || isCountryMember;
  const isGraduated  = stageCircle?.isGraduated === true;
  const isAdminOrLeader = user.role === "ADMIN" || cohortMember?.isLeader === true;

  const weekPrompt    = getWeeklyPrompt();
  const cohortTopics  = COHORT_CIRCLES.find(c => c.stageKey === stageKey)?.channels ?? [];

  const statsOnline   = Math.max(3, Math.floor(memberCount * 0.04));
  const statsNewWeek  = Math.max(1, Math.floor(memberCount * 0.03));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
      <style>{`
        .cl-layout { display: flex; flex-direction: column; }
        .cl-left   { min-width: 0; }
        .cl-right  { display: none; }
        @media (min-width: 768px) {
          .cl-layout { flex-direction: row; align-items: flex-start; max-width: 1100px; margin: 0 auto; }
          .cl-left   { flex: 60; min-width: 0; border-right: 1px solid var(--border); }
          .cl-right  {
            display: block; flex: 40; min-width: 0; max-width: 380px;
            position: sticky; top: 0; max-height: 100vh; overflow-y: auto;
            padding: 20px 18px 80px;
          }
        }
        .cl-topic-pills { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 10px 16px 12px; }
        .cl-topic-pills::-webkit-scrollbar { display: none; }
        .cl-stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }
        .cl-filter-row { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 12px; }
        .cl-filter-row::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── Sticky green header ── */}
      <div style={{ background: "#1a7a5e", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ padding: "14px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>

            {/* Left: back + title */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => router.push("/circles")}
                style={{ background: "rgba(255,255,255,0.18)", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}
              >
                <ArrowLeft size={16} strokeWidth={2.2} color="white" />
              </button>
              <div>
                {isMember && (
                  <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.9px", marginBottom: 1 }}>
                    YOUR CIRCLE
                  </div>
                )}
                <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, color: "white", lineHeight: 1.25, display: "flex", alignItems: "center", gap: 6 }}>
                  {circleName}
                  <Info size={13} color="rgba(255,255,255,0.5)" style={{ flexShrink: 0 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  <Users size={11} strokeWidth={1.75} />
                  {memberCount.toLocaleString()} members
                  {cohortMember && joined > 0 && ` · Joined ${joined}d ago`}
                </div>
              </div>
            </div>

            {/* Right: grid icon */}
            <button
              onClick={() => router.push("/circles")}
              title="All circles"
              style={{ background: "rgba(255,255,255,0.18)", border: "none", borderRadius: 10, padding: "8px", cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}
            >
              <LayoutGrid size={17} color="white" />
            </button>
          </div>
        </div>

        {/* Topic / channel pills */}
        {cohortChannels.length > 0 && (
          <div className="cl-topic-pills">
            {["ALL", ...cohortChannels.map(c => c.id)].map((key, i) => {
              const ch     = cohortChannels.find(c => c.id === key);
              const active = activeChannel === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveChannel(key)}
                  style={{
                    flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "none",
                    background: active ? "white" : "rgba(255,255,255,0.18)",
                    color: active ? "#1a7a5e" : "rgba(255,255,255,0.88)",
                    fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif",
                    whiteSpace: "nowrap",
                  }}
                >
                  {i === 0 ? "All" : `${ch?.emoji ?? ""} ${ch?.name ?? ""}`}
                </button>
              );
            })}
          </div>
        )}
        {cohortChannels.length === 0 && <div style={{ height: 10 }} />}
      </div>

      {/* ── Two-column layout ── */}
      <div className="cl-layout">

        {/* ── Left column: feed ── */}
        <div className="cl-left">
          <div style={{ padding: "14px 16px 0" }}>

            {/* Visitor / safe-space banner */}
            {!isMember && !isGraduated && (
              <div style={{ background: "#f0f9ff", border: "1.5px solid #bae6fd", borderRadius: 14, padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <Eye size={15} color="#0284c7" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: "#0369a1", lineHeight: 1.55, flex: 1 }}>
                  <strong style={{ fontWeight: 800 }}>You&apos;re in a safe space.</strong>{" "}
                  You&apos;re visiting this circle. You can read and comment, but posting is for members.{" "}
                  <button
                    onClick={() => router.push("/profile")}
                    style={{ color: "#0369a1", fontWeight: 800, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Nunito, sans-serif", fontSize: 13, textDecoration: "underline" }}
                  >
                    Learn how to join →
                  </button>
                </div>
              </div>
            )}

            {/* Graduated banner */}
            {isGraduated && (
              <div style={{ background: "#eff6ff", border: "1.5px solid #93c5fd", borderRadius: 14, padding: "12px 14px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <Eye size={15} color="#2563eb" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: "#1e40af", lineHeight: 1.55 }}>
                  You were here once. Your posts are still here and you can still comment.
                </div>
              </div>
            )}

            {/* Moderation banner (one-time, members only) */}
            {isMember && !modBannerDismissed && (
              <div style={{ background: "white", borderRadius: 14, padding: "12px 14px", marginBottom: 14, border: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1, fontSize: 12, color: "var(--mid)", lineHeight: 1.6 }}>
                  This circle is a space for kindness, honesty, and real support — not for requesting items or donations.
                  Posts are reviewed before appearing if they trigger our safety filters.
                </div>
                <button
                  onClick={dismissModBanner}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#1a7a5e", fontWeight: 700, fontFamily: "Nunito, sans-serif", flexShrink: 0 }}
                >
                  Got it
                </button>
              </div>
            )}

            {/* Weekly prompt card */}
            {!promptDismissed && (
              <div style={{ background: "#f0eaff", borderRadius: 14, padding: "14px", marginBottom: 14, border: "1px solid #ddd6fe" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <Sparkles size={13} color="#7c3aed" strokeWidth={2} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.9px" }}>
                    This week&apos;s prompt
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#4c1d95", lineHeight: 1.6, marginBottom: 10 }}>
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

            {/* Stats row */}
            <div style={{ background: "#f8f9fa", borderRadius: 14, padding: "12px 10px", marginBottom: 14, border: "1px solid #e9ecef" }}>
              <div className="cl-stats-grid">
                {[
                  { label: "Online now",     value: statsOnline.toString(),        Icon: Eye         },
                  { label: "Posts this week", value: postCount > 0 ? postCount.toString() : "—", Icon: MessageCircle },
                  { label: "Members",        value: memberCount.toLocaleString(),  Icon: Users       },
                  { label: "New this week",  value: statsNewWeek.toString(),       Icon: Sparkles    },
                ].map(({ label, value, Icon: SI }) => (
                  <div key={label} style={{ textAlign: "center", padding: "2px 0" }}>
                    <SI size={14} color="#1a7a5e" strokeWidth={1.75} />
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", lineHeight: 1.2, marginTop: 3 }}>{value}</div>
                    <div style={{ fontSize: 9, color: "var(--mid)", lineHeight: 1.35, marginTop: 1 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Composer — full if member, locked if visitor */}
            {isMember ? (
              <CircleComposer
                circleId={circleId}
                userAvatar={user.avatar}
                userName={user.name}
                channels={cohortChannels}
                activeChannelId={activeChannel !== "ALL" ? activeChannel : null}
                onPosted={() => loadPosts(true)}
              />
            ) : (
              <div style={{ background: "var(--white)", borderRadius: 16, padding: "12px 14px", marginBottom: 16, boxShadow: "var(--shadow)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, opacity: 0.65 }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--bg)", flexShrink: 0 }} />
                <div style={{ flex: 1, padding: "9px 14px", borderRadius: 24, background: "var(--bg)", fontSize: 13, color: "var(--light)" }}>
                  Share a tip, story, or question with your circle…
                </div>
                <Lock size={16} color="var(--light)" style={{ flexShrink: 0 }} />
              </div>
            )}

            {/* Post type filter tabs */}
            <div className="cl-filter-row">
              {POST_FILTERS.map(f => {
                const CatIcon = f.value !== "ALL" ? CATEGORY_ICONS[f.value] : null;
                const active  = postCategory === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => setPostCategory(f.value)}
                    style={{
                      flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
                      padding: "6px 13px", borderRadius: 20, border: "1.5px solid",
                      borderColor: active ? "#1a7a5e" : "var(--border)",
                      background: active ? "#1a7a5e" : "var(--white)",
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

            {/* Post feed */}
            {loadingPosts && posts.length === 0 ? (
              <div className="loading" style={{ minHeight: 200 }}><div className="spinner" /></div>
            ) : posts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--mid)" }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
                  Be the first to post in {circleName}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  Share a tip, a small win, or something you&apos;re grateful for today.
                </div>
              </div>
            ) : (
              <>
                {posts.map(post => (
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
        </div>

        {/* ── Right column: sidebar (desktop only) ── */}
        <div className="cl-right">

          {/* Circle name + icon */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <StageIconComp size={20} strokeWidth={1.75} color={theme.color} />
            </div>
            <div>
              <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 5 }}>
                {circleName}
                <Info size={13} color="var(--mid)" style={{ flexShrink: 0 }} />
              </div>
              {stageMeta?.description && (
                <div style={{ fontSize: 11, color: "var(--mid)", marginTop: 1 }}>{stageMeta.description}</div>
              )}
            </div>
          </div>

          {/* Member avatar row */}
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 6 }}>
            {Array.from({ length: Math.min(4, memberCount) }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: MEMBER_AVATAR_COLORS[i % MEMBER_AVATAR_COLORS.length],
                  border: "2.5px solid white", marginLeft: i > 0 ? -8 : 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 800, color: "white",
                }}
              />
            ))}
            {memberCount > 4 && (
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: "#e5e7eb", border: "2.5px solid white", marginLeft: -8,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 800, color: "#6b7280",
              }}>
                +{(memberCount - 4).toLocaleString()}
              </div>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--mid)", marginBottom: 14 }}>
            {memberCount.toLocaleString()} members
            {cohortMember && ` · Joined ${joined === 0 ? "today" : `${joined}d ago`}`}
          </div>

          {/* Description */}
          {stageMeta?.description && (
            <div style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.65, marginBottom: 16 }}>
              A supportive circle for mothers at the {stageMeta.description.toLowerCase()} stage.
              Share, ask, and connect with women who understand exactly where you are right now.
            </div>
          )}

          {/* About this circle */}
          <div style={{ background: "white", borderRadius: 14, padding: "14px 14px 10px", border: "1px solid var(--border)", marginBottom: 14 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
              About this circle
            </div>
            {[
              { Icon: Heart,       text: "Supportive & judgment-free" },
              { Icon: Users,       text: "Stage-based — everyone's at your point" },
              { Icon: Shield,      text: "Private & safe" },
            ].map(({ Icon: AI, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <AI size={13} color="#1a7a5e" strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--ink)" }}>{text}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 8 }}>
              <button
                style={{ fontSize: 12, color: "#1a7a5e", fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontFamily: "Nunito, sans-serif", padding: 0 }}
              >
                View guidelines ›
              </button>
            </div>
          </div>

          {/* Circle topics */}
          {cohortTopics.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "Lora, serif", fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
                Circle topics
              </div>
              {cohortTopics.map(topic => (
                <div key={topic.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{topic.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{topic.name}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: "#1a7a5e", background: "#e8f5f1", padding: "2px 7px", borderRadius: 20, flexShrink: 0 }}>
                    new
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Upcoming event */}
          <div style={{ background: "white", borderRadius: 14, padding: "14px", border: "1px solid var(--border)", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Calendar size={13} color="var(--mid)" strokeWidth={1.75} />
              <span style={{ fontSize: 10, fontWeight: 800, color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.7px" }}>
                Upcoming circle event
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--mid)", lineHeight: 1.6 }}>
              No upcoming events. Events will appear here when scheduled.
            </div>
          </div>

          {/* Thinking of joining? (visitors only) */}
          {!isMember && !isGraduated && (
            <div style={{ background: "#f0faf7", borderRadius: 14, padding: "16px", border: "1.5px solid #1a7a5e" }}>
              <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                Thinking of joining?
              </div>
              <div style={{ fontSize: 12, color: "var(--mid)", lineHeight: 1.6, marginBottom: 12 }}>
                Complete your profile to be placed in the circle that matches your stage of pregnancy or parenthood.
              </div>
              <button
                className="btn-primary"
                onClick={() => router.push("/profile")}
                style={{ width: "100%", fontSize: 13 }}
              >
                Join this circle
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Comments sheet */}
      {commentsPostId && (
        <CircleComments postId={commentsPostId} onClose={() => { setCommentsPostId(null); loadPosts(true); }} />
      )}

      {/* Identity modal */}
      {showIdentityModal && (
        <CircleIdentityModal onDone={() => setShowIdentityModal(false)} />
      )}

      <BottomNav />
    </div>
  );
}
