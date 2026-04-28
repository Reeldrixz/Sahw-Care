"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import CirclePostCard, { Post } from "@/components/CirclePostCard";
import CircleComposer from "@/components/CircleComposer";
import CircleComments from "@/components/CircleComments";
import CircleIdentityModal from "@/components/CircleIdentityModal";
import { STAGE_META, StageKey } from "@/lib/stage";
import {
  HeartPulse, Heart, Smile, Star, LayoutGrid,
  Compass, Users, Lightbulb, BookOpen, HandHeart, HelpCircle, Trophy,
  type LucideIcon,
} from "lucide-react";

// ── Stage icon mapping ────────────────────────────────────────────────────────

const STAGE_ICONS: Record<string, LucideIcon> = {
  "pregnancy-0-3":    HeartPulse,
  "pregnancy-4-6":    HeartPulse,
  "pregnancy-7-9":    HeartPulse,
  "postpartum-0-3":   Heart,
  "postpartum-4-6":   Smile,
  "postpartum-7-12":  Smile,
  "postpartum-13-24": Star,
};

function StageIcon({ stageKey, size = 20, color = "#1a7a5e" }: { stageKey: string; size?: number; color?: string }) {
  const Icon = STAGE_ICONS[stageKey] ?? Heart;
  return <Icon size={size} strokeWidth={1.75} color={color} />;
}

// ── Weekly prompt (rotates by ISO week number) ────────────────────────────────

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
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week = Math.floor((now.getTime() - start.getTime()) / (7 * 86400 * 1000));
  return WEEKLY_PROMPTS[week % WEEKLY_PROMPTS.length];
}

// ── Category filter config ────────────────────────────────────────────────────

type PostCategory = "ALL" | "TIP" | "STORY" | "GRATITUDE" | "QUESTION" | "SMALL_WIN" | "SUPPORT";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  TIP: Lightbulb, STORY: BookOpen, GRATITUDE: HandHeart,
  QUESTION: HelpCircle, SMALL_WIN: Trophy, SUPPORT: Users,
};

const POST_FILTERS: { value: PostCategory; label: string }[] = [
  { value: "ALL",       label: "All"         },
  { value: "QUESTION",  label: "Questions"   },
  { value: "SUPPORT",   label: "Support"     },
  { value: "TIP",       label: "Tips"        },
  { value: "STORY",     label: "Stories"     },
  { value: "SMALL_WIN", label: "Small Wins"  },
  { value: "GRATITUDE", label: "Gratitude"   },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface StageCircle {
  id:          string;
  name:        string;
  emoji:       string | null;
  stageKey:    string;
  groupLetter: string | null;
  memberCount: number;
  postCount:   number;
  isPrimary:   boolean;
  isGraduated: boolean;
  accessType:  string | null;
}

interface CohortCircle {
  id: string;
  name: string;
  emoji: string | null;
  stageKey: string | null;
  groupLetter: string | null;
  _count: { members: number; posts: number };
}

interface Channel {
  id: string;
  name: string;
  emoji: string;
  order: number;
}

interface Member {
  joinedAt: string;
  isLeader: boolean;
  lastViewedAt: string | null;
}

interface CountryCircle {
  id: string;
  name: string;
  country: string;
  _count: { members: number; posts: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (86400 * 1000));
}

function isNewMember(joinedAt: string): boolean {
  return daysAgo(joinedAt) < 7;
}

async function fetchCountryCircle(): Promise<{ circle: CountryCircle; member: Member } | null> {
  const res = await fetch("/api/circles/my", { cache: "no-store" });
  const d   = await res.json();
  return d.circle ? { circle: d.circle, member: d.member } : null;
}

async function joinViaLocation(location: string): Promise<{ circle: CountryCircle; member: Member } | null> {
  await fetch("/api/profile", {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ location }),
  });
  return fetchCountryCircle();
}

async function detectLocationViaIP(): Promise<{ location: string; countryCode: string } | null> {
  try {
    const res  = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    const data = await res.json();
    const city    = data.city        as string | undefined;
    const country = data.country_name as string | undefined;
    const code    = data.country_code as string | undefined;
    if (!country || !code) return null;
    return { location: city ? `${city}, ${country}` : country, countryCode: code };
  } catch {
    return null;
  }
}

// ── Moderation banner (localStorage-dismissed per circle) ─────────────────────

function useModBannerDismissed(circleId: string | undefined) {
  const key = circleId ? `mod_banner_${circleId}` : null;
  const [dismissed, setDismissed] = useState(() => {
    if (!key || typeof window === "undefined") return true;
    return localStorage.getItem(key) === "1";
  });
  const dismiss = () => {
    if (key) localStorage.setItem(key, "1");
    setDismissed(true);
  };
  return [dismissed, dismiss] as const;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CirclesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Cohort circle state
  const [cohortCircle,   setCohortCircle]   = useState<CohortCircle | null>(null);
  const [cohortChannels, setCohortChannels] = useState<Channel[]>([]);
  const [cohortMember,   setCohortMember]   = useState<Member | null>(null);
  const [activeChannel,  setActiveChannel]  = useState<string>("ALL");
  const [loadingCohort,  setLoadingCohort]  = useState(false);

  // Explore / previous circles
  const [allStages,    setAllStages]    = useState<StageCircle[]>([]);
  const [exploreOpen,  setExploreOpen]  = useState(false);

  // Visiting (non-primary circle browse)
  const [visitingCircle,      setVisitingCircle]      = useState<StageCircle | null>(null);
  const [visitPosts,          setVisitPosts]          = useState<Post[]>([]);
  const [visitLoading,        setVisitLoading]        = useState(false);
  const [visitCommentsPostId, setVisitCommentsPostId] = useState<string | null>(null);

  // Country circle state (fallback)
  const [countryCircle,  setCountryCircle]  = useState<CountryCircle | null>(null);
  const [countryMember,  setCountryMember]  = useState<Member | null>(null);
  const [geoDetecting,   setGeoDetecting]   = useState(false);
  const [loadingCountry, setLoadingCountry] = useState(false);

  // Shared post state
  const [posts,          setPosts]          = useState<Post[]>([]);
  const [postCategory,   setPostCategory]   = useState<PostCategory>("ALL");
  const [cursor,         setCursor]         = useState<string | null>(null);
  const [hasMore,        setHasMore]        = useState(false);
  const [loadingPosts,   setLoadingPosts]   = useState(false);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);

  // Moderation banner (dismissed via localStorage)
  const [modBannerDismissed, dismissModBanner] = useModBannerDismissed(cohortCircle?.id ?? countryCircle?.id);

  // Weekly prompt dismiss state
  const [promptDismissed, setPromptDismissed] = useState(false);

  // Circle identity modal
  const [showIdentityModal, setShowIdentityModal] = useState(false);

  const activeCircle = cohortCircle ?? countryCircle;
  const activeMember = cohortCircle ? cohortMember : countryMember;

  // ── Identity modal ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || user.journeyType === "donor") return;
    if (user.circleIdentitySet) return;
    if (user.circleIdentitySkippedAt) {
      const daysSinceSkip = (Date.now() - new Date(user.circleIdentitySkippedAt).getTime()) / (86400 * 1000);
      if (daysSinceSkip < 7) return;
    }
    const t = setTimeout(() => setShowIdentityModal(true), 800);
    return () => clearTimeout(t);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load cohort circle ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.currentCircleId) return;
    setLoadingCohort(true);
    fetch("/api/circles/cohort", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.circle) {
          setCohortCircle(d.circle);
          setCohortChannels(d.channels ?? []);
          setCohortMember(d.member);
        }
      })
      .finally(() => setLoadingCohort(false));
  }, [user?.currentCircleId]);

  // ── Load country circle ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || user.currentCircleId) return;
    setLoadingCountry(true);
    (async () => {
      let result = await fetchCountryCircle();
      if (!result && user.location) {
        setGeoDetecting(true);
        result = await joinViaLocation(user.location);
        setGeoDetecting(false);
      }
      if (!result) {
        setGeoDetecting(true);
        const detected = await detectLocationViaIP();
        if (detected) {
          fetch("/api/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ location: detected.location, countryCode: detected.countryCode }),
          }).catch(() => {});
          result = await joinViaLocation(detected.location);
        }
        setGeoDetecting(false);
      }
      if (result) {
        setCountryCircle(result.circle);
        setCountryMember(result.member);
        fetch("/api/circles/my", { method: "PATCH" }).catch(() => {});
      }
      setLoadingCountry(false);
    })();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load all stages for Explore ────────────────────────────────────────────
  useEffect(() => {
    if (!user?.currentCircleId) return;
    fetch("/api/circles/stages", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAllStages(d.circles ?? []));
  }, [user?.currentCircleId]);

  // ── Visit a non-primary circle ─────────────────────────────────────────────
  const openVisiting = useCallback(async (circle: StageCircle) => {
    setVisitingCircle(circle);
    setVisitPosts([]);
    setVisitLoading(true);
    const res = await fetch(`/api/circles/${circle.id}/posts?category=ALL`, { cache: "no-store" });
    if (res.ok) {
      const d = await res.json();
      setVisitPosts(d.posts ?? []);
    }
    setVisitLoading(false);
  }, []);

  const closeVisiting = useCallback(() => {
    setVisitingCircle(null);
    setVisitPosts([]);
    setVisitCommentsPostId(null);
    fetch("/api/circles/stages", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAllStages(d.circles ?? []));
  }, []);

  // ── Load posts ─────────────────────────────────────────────────────────────
  const loadPosts = useCallback(async (reset = false) => {
    if (!activeCircle) return;
    setLoadingPosts(true);
    const cur = reset ? null : cursor;
    const params = new URLSearchParams({ category: postCategory });
    if (cohortCircle && activeChannel !== "ALL") params.set("channelId", activeChannel);
    if (cur) params.set("cursor", cur);
    const url = `/api/circles/${activeCircle.id}/posts?${params}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const d = await res.json();
      setPosts((p) => reset ? d.posts : [...p, ...d.posts]);
      setCursor(d.nextCursor);
      setHasMore(!!d.nextCursor && d.posts.length === 20);
    }
    setLoadingPosts(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCircle, postCategory, activeChannel, cursor]);

  useEffect(() => {
    if (activeCircle) { setPosts([]); setCursor(null); loadPosts(true); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCircle?.id, postCategory, activeChannel]);

  // ── SSE: real-time new posts ───────────────────────────────────────────────
  useEffect(() => {
    if (!activeCircle || !user || visitingCircle) return;
    const since = new Date().toISOString();
    let es: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      es = new EventSource(`/api/circles/${activeCircle.id}/stream?since=${encodeURIComponent(since)}`);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "new_post" && data.post) {
            const newPost = data.post as Post;
            if (newPost.author.id === user.id) return;
            setPosts(prev => {
              if (prev.some(p => p.id === newPost.id)) return prev;
              return [newPost, ...prev];
            });
          }
        } catch {}
      };
      es.onerror = () => {
        es?.close();
        reconnectTimeout = setTimeout(connect, 5000);
      };
    };

    connect();
    return () => { es?.close(); if (reconnectTimeout) clearTimeout(reconnectTimeout); };
  }, [activeCircle?.id, user?.id, visitingCircle]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (postId: string) => {
    if (!confirm("Delete this post?")) return;
    await fetch(`/api/circles/posts/${postId}`, { method: "DELETE" });
    setPosts((p) => p.filter((x) => x.id !== postId));
  };

  const handlePin = async (postId: string, pin: boolean) => {
    await fetch(`/api/circles/posts/${postId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isPinned: pin }),
    });
    setPosts((p) =>
      p.map((x) => (x.id === postId ? { ...x, isPinned: pin } : x))
       .sort((a, b) => {
         if (a.isPinned && !b.isPinned) return -1;
         if (!a.isPinned && b.isPinned) return 1;
         return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
       })
    );
  };

  const isAdminOrLeader = user?.role === "ADMIN" || activeMember?.isLeader === true;

  // ── Loading / auth guards ──────────────────────────────────────────────────

  if (authLoading) {
    return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;
  }

  if (!user) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Join the Circle</div>
        <p style={{ color: "var(--mid)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
          Sign in to connect with mothers at your stage of the journey.
        </p>
        <button className="btn-primary" onClick={() => router.push("/auth")}>Sign in to join</button>
      </div>
    );
  }

  if (user.onboardingComplete && user.journeyType === "donor") {
    router.replace("/");
    return null;
  }

  // ── Not onboarded → prompt + country fallback ──────────────────────────────

  if (!user.onboardingComplete && user.verificationLevel < 2 && !user.currentCircleId) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
        <div className="browse-header">
          <div className="browse-title">Circles</div>
        </div>
        <div style={{ padding: "20px 16px" }}>
          <div
            onClick={() => {}}
            style={{
              background: "linear-gradient(135deg, #1a7a5e 0%, #2a9d7f 100%)",
              borderRadius: 18, padding: "22px 20px", marginBottom: 20, cursor: "pointer",
              color: "white",
            }}
          >
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
              Join your stage circle
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.9, marginBottom: 14 }}>
              Complete your profile to be placed with mothers at exactly your stage of pregnancy or parenthood.
            </p>
            <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700 }}>
              Complete your profile →
            </div>
          </div>
          <CountryCircleFallback
            user={user}
            countryCircle={countryCircle}
            countryMember={countryMember}
            posts={posts}
            loadingPosts={loadingPosts}
            hasMore={hasMore}
            postCategory={postCategory}
            setPostCategory={setPostCategory}
            isAdminOrLeader={isAdminOrLeader}
            commentsPostId={commentsPostId}
            setCommentsPostId={setCommentsPostId}
            onDelete={handleDelete}
            onPin={handlePin}
            onLoadMore={() => loadPosts(false)}
            onPosted={() => loadPosts(true)}
            router={router}
            modBannerDismissed={modBannerDismissed}
            dismissModBanner={dismissModBanner}
            promptDismissed={promptDismissed}
            setPromptDismissed={setPromptDismissed}
          />
        </div>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loadingCohort || geoDetecting || (loadingCountry && !countryCircle)) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div className="browse-header"><div className="browse-title">Circles</div></div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", gap: 16 }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700 }}>Finding your circle…</div>
          <div className="spinner" style={{ marginTop: 8 }} />
        </div>
      </div>
    );
  }

  // ── Visiting a non-primary circle ──────────────────────────────────────────

  if (visitingCircle) {
    const meta = STAGE_META[visitingCircle.stageKey as StageKey];
    const isGrad = visitingCircle.isGraduated;

    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "16px 16px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={closeVisiting}
              style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "7px 12px", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", flexShrink: 0 }}
            >
              ← Back
            </button>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <StageIcon stageKey={visitingCircle.stageKey} size={20} color="white" />
            </div>
            <div>
              <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: "white" }}>
                {meta?.label ?? visitingCircle.name}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
                {visitingCircle.memberCount.toLocaleString()} members
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 16px 0" }}>
          {/* Visitor banner */}
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 12,
            background: isGrad ? "#eff6ff" : "#fdf8e8",
            border: `1.5px solid ${isGrad ? "#93c5fd" : "#fbbf24"}`,
            borderRadius: 14, padding: "12px 14px", marginBottom: 16,
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: isGrad ? "#dbeafe" : "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Compass size={16} color={isGrad ? "#2563eb" : "#d97706"} strokeWidth={2} />
            </div>
            <div style={{ flex: 1, fontSize: 13, color: isGrad ? "#1e40af" : "#92400e", lineHeight: 1.5 }}>
              {isGrad
                ? "You were here once. Your posts are still here and you can still comment."
                : "You're visiting this circle. You can read and comment, but posting is for members at this stage."}
            </div>
          </div>

          {visitLoading ? (
            <div className="loading" style={{ minHeight: 200 }}><div className="spinner" /></div>
          ) : visitPosts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--mid)" }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>No posts here yet</div>
            </div>
          ) : (
            visitPosts.map((post) => (
              <CirclePostCard
                key={post.id}
                post={post}
                currentUserId={user!.id}
                isAdminOrLeader={false}
                onOpenComments={setVisitCommentsPostId}
                onDelete={() => {}}
                onPin={() => {}}
              />
            ))
          )}
        </div>

        {visitCommentsPostId && (
          <CircleComments postId={visitCommentsPostId} onClose={() => setVisitCommentsPostId(null)} />
        )}
      </div>
    );
  }

  // ── Cohort circle view ─────────────────────────────────────────────────────

  if (cohortCircle) {
    const stageMeta = cohortCircle.stageKey ? STAGE_META[cohortCircle.stageKey as keyof typeof STAGE_META] : null;
    const joined    = cohortMember ? daysAgo(cohortMember.joinedAt) : 0;
    const showWelcome = cohortMember && isNewMember(cohortMember.joinedAt);
    const weekPrompt = getWeeklyPrompt();

    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
        {/* Circle header */}
        <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "20px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <StageIcon stageKey={cohortCircle.stageKey ?? ""} size={22} color="white" />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 2 }}>
                  YOUR CIRCLE
                </div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "white", lineHeight: 1.2 }}>
                  {stageMeta?.label ?? cohortCircle.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                    <Users size={11} />
                    {cohortCircle._count.members.toLocaleString()}
                  </div>
                  {cohortMember && joined > 0 && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                      · Joined {joined}d ago
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setExploreOpen(true)}
              style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginTop: 2 }}
              title="Explore all circles"
            >
              <LayoutGrid size={18} color="white" />
            </button>
          </div>

          {/* Sub-channel tabs */}
          {cohortChannels.length > 0 && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 14, scrollbarWidth: "none" }}>
              <button
                onClick={() => setActiveChannel("ALL")}
                style={{
                  flexShrink: 0, padding: "7px 16px", borderRadius: 20, border: "none",
                  background: activeChannel === "ALL" ? "white" : "rgba(255,255,255,0.15)",
                  color: activeChannel === "ALL" ? "var(--green)" : "rgba(255,255,255,0.85)",
                  fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif",
                  transition: "all 0.15s",
                }}
              >
                All
              </button>
              {cohortChannels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch.id)}
                  style={{
                    flexShrink: 0, padding: "7px 14px", borderRadius: 20, border: "none",
                    background: activeChannel === ch.id ? "white" : "rgba(255,255,255,0.15)",
                    color: activeChannel === ch.id ? "var(--green)" : "rgba(255,255,255,0.85)",
                    fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif",
                    transition: "all 0.15s", whiteSpace: "nowrap",
                  }}
                >
                  {ch.emoji} {ch.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "16px 16px 0" }}>
          {/* Welcome card (new members only) */}
          {showWelcome && (
            <div style={{
              background: "var(--green-light)", borderRadius: 16, padding: "16px",
              marginBottom: 16, border: "1.5px solid var(--green)",
            }}>
              <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: "var(--green)", marginBottom: 6 }}>
                Welcome to your circle
              </div>
              <div style={{ fontSize: 13, color: "#1a5c45", lineHeight: 1.6 }}>
                You&apos;re now with mothers at exactly your stage. This is a space to share, ask, and be heard — without judgment. Start by introducing yourself, or just read along.
              </div>
              <div style={{ fontSize: 11, color: "var(--mid)", marginTop: 8 }}>
                {cohortCircle._count.members.toLocaleString()} members · Joined {joined === 0 ? "today" : `${joined}d ago`}
              </div>
            </div>
          )}

          {/* Moderation community note (one-time) */}
          {!modBannerDismissed && (
            <div style={{
              background: "white", borderRadius: 14, padding: "12px 14px",
              marginBottom: 16, border: "1px solid var(--border)",
              display: "flex", alignItems: "flex-start", gap: 12,
            }}>
              <div style={{ flex: 1, fontSize: 12, color: "var(--mid)", lineHeight: 1.6 }}>
                This circle is a space for kindness, honesty, and real support — not for requesting items or donations.
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
          {!promptDismissed && (
            <div style={{
              background: "linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)",
              borderRadius: 14, padding: "14px 14px", marginBottom: 16,
              border: "1px solid #e0e7ff", position: "relative",
            }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>
                This week&apos;s prompt
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#312e81", lineHeight: 1.5, marginBottom: 10 }}>
                &ldquo;{weekPrompt}&rdquo;
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => setPromptDismissed(true)}
                  style={{ fontSize: 11, color: "var(--mid)", background: "none", border: "none", cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Composer */}
          <CircleComposer
            circleId={cohortCircle.id}
            userAvatar={user.avatar}
            userName={user.name}
            channels={cohortChannels}
            activeChannelId={activeChannel !== "ALL" ? activeChannel : null}
            onPosted={() => loadPosts(true)}
          />

          {/* Post type filter */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, scrollbarWidth: "none" }}>
            {POST_FILTERS.map((f) => {
              const CatIcon = f.value !== "ALL" ? CATEGORY_ICONS[f.value] : null;
              return (
                <button
                  key={f.value}
                  onClick={() => setPostCategory(f.value)}
                  style={{
                    flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
                    padding: "6px 13px", borderRadius: 20, border: "1.5px solid",
                    borderColor: postCategory === f.value ? "var(--green)" : "var(--border)",
                    background: postCategory === f.value ? "var(--green)" : "var(--white)",
                    color: postCategory === f.value ? "white" : "var(--mid)",
                    fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif",
                  }}
                >
                  {CatIcon && <CatIcon size={11} strokeWidth={2} color={postCategory === f.value ? "white" : "var(--mid)"} />}
                  {f.label}
                </button>
              );
            })}
          </div>

          <PostFeed
            posts={posts}
            loading={loadingPosts}
            hasMore={hasMore}
            circleName={stageMeta?.label ?? cohortCircle.name}
            currentUserId={user.id}
            isAdminOrLeader={isAdminOrLeader}
            commentsPostId={commentsPostId}
            setCommentsPostId={setCommentsPostId}
            onDelete={handleDelete}
            onPin={handlePin}
            onLoadMore={() => loadPosts(false)}
            onPosted={() => loadPosts(true)}
          />
        </div>

        {commentsPostId && (
          <CircleComments postId={commentsPostId} onClose={() => { setCommentsPostId(null); loadPosts(true); }} />
        )}

        {showIdentityModal && (
          <CircleIdentityModal onDone={() => setShowIdentityModal(false)} />
        )}

        {/* Explore overlay */}
        {exploreOpen && (
          <div style={{ position: "fixed", inset: 0, background: "var(--bg)", zIndex: 1000, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "20px 16px 16px", position: "sticky", top: 0, zIndex: 1001 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "white" }}>All Circles</div>
                <button
                  onClick={() => setExploreOpen(false)}
                  style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 20, padding: "6px 14px", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                >
                  Close
                </button>
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
                Explore every stage of the journey
              </div>
            </div>
            <div style={{ padding: "16px 16px 80px", display: "flex", flexDirection: "column", gap: 10 }}>
              {allStages.map((c) => (
                <StageCircleCard
                  key={c.id}
                  circle={c}
                  isGraduated={c.isGraduated}
                  isPrimary={c.isPrimary}
                  onVisit={() => { setExploreOpen(false); openVisiting(c); }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── No cohort circle → country circle fallback ─────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
      <div className="browse-header" style={{ paddingBottom: 12 }}>
        <div className="browse-title">{countryCircle?.name ?? "Circles"}</div>
        {countryCircle && (
          <div style={{ fontSize: 12, color: "var(--mid)", marginTop: 4 }}>
            {countryCircle._count.members.toLocaleString()} members
          </div>
        )}
      </div>

      {!countryCircle ? (
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 10 }}>
            We couldn&apos;t detect your location
          </div>
          <p style={{ color: "var(--mid)", fontSize: 14, lineHeight: 1.6, maxWidth: 300, margin: "0 auto 24px" }}>
            Add your city and country in your profile settings to join your country circle.
          </p>
          <button className="btn-primary" onClick={() => router.push("/profile")}>Go to profile settings</button>
        </div>
      ) : (
        <CountryCircleFallback
          user={user}
          countryCircle={countryCircle}
          countryMember={countryMember}
          posts={posts}
          loadingPosts={loadingPosts}
          hasMore={hasMore}
          postCategory={postCategory}
          setPostCategory={setPostCategory}
          isAdminOrLeader={isAdminOrLeader}
          commentsPostId={commentsPostId}
          setCommentsPostId={setCommentsPostId}
          onDelete={handleDelete}
          onPin={handlePin}
          onLoadMore={() => loadPosts(false)}
          onPosted={() => loadPosts(true)}
          router={router}
          modBannerDismissed={modBannerDismissed}
          dismissModBanner={dismissModBanner}
          promptDismissed={promptDismissed}
          setPromptDismissed={setPromptDismissed}
        />
      )}

      {showIdentityModal && (
        <CircleIdentityModal onDone={() => setShowIdentityModal(false)} />
      )}
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────────

interface PostFeedProps {
  posts: Post[];
  loading: boolean;
  hasMore: boolean;
  circleName: string;
  currentUserId: string;
  isAdminOrLeader: boolean;
  commentsPostId: string | null;
  setCommentsPostId: (id: string | null) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pin: boolean) => void;
  onLoadMore: () => void;
  onPosted: () => void;
}

function PostFeed({ posts, loading, hasMore, circleName, currentUserId, isAdminOrLeader, setCommentsPostId, onDelete, onPin, onLoadMore }: PostFeedProps) {
  if (loading && posts.length === 0) {
    return <div className="loading" style={{ minHeight: 200 }}><div className="spinner" /></div>;
  }
  if (posts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--mid)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
          Be the first to post in {circleName}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>Share a tip, a small win, or something you&apos;re grateful for today.</div>
      </div>
    );
  }
  return (
    <>
      {posts.map((post) => (
        <CirclePostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          isAdminOrLeader={isAdminOrLeader}
          onOpenComments={setCommentsPostId}
          onDelete={onDelete}
          onPin={onPin}
        />
      ))}
      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={loading}
          style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--white)", color: "var(--mid)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", marginBottom: 16 }}
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </>
  );
}

// ── Stage Circle Card ──────────────────────────────────────────────────────────

function StageCircleCard({ circle, isGraduated, isPrimary, onVisit }: { circle: StageCircle; isGraduated?: boolean; isPrimary?: boolean; onVisit: () => void }) {
  const meta = STAGE_META[circle.stageKey as StageKey];
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "14px 16px", borderRadius: 14,
        border: `1.5px solid ${isPrimary ? "var(--green)" : isGraduated ? "#e5e7eb" : "var(--border)"}`,
        background: isPrimary ? "var(--green-light)" : isGraduated ? "#f9fafb" : "var(--white)",
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 10, background: isPrimary ? "var(--green)" : isGraduated ? "#e5e7eb" : "#f0f4f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <StageIcon stageKey={circle.stageKey} size={20} color={isPrimary ? "white" : isGraduated ? "#9ca3af" : "var(--green)"} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <div style={{ fontWeight: 800, fontSize: 13, fontFamily: "Nunito, sans-serif", color: "var(--ink)" }}>
            {meta?.label ?? circle.name}
          </div>
          {isPrimary && (
            <span style={{ fontSize: 10, fontWeight: 800, color: "var(--green)", background: "rgba(26,122,94,0.12)", borderRadius: 20, padding: "1px 8px", fontFamily: "Nunito, sans-serif" }}>
              Your Circle
            </span>
          )}
        </div>
        {meta && (
          <div style={{ fontSize: 11, color: "var(--mid)", lineHeight: 1.4 }}>{meta.description}</div>
        )}
        <div style={{ fontSize: 11, color: "var(--mid)", marginTop: 2 }}>
          {circle.memberCount.toLocaleString()} members
          {isGraduated && <span style={{ marginLeft: 6, color: "#9ca3af", fontStyle: "italic" }}>· Previously here</span>}
        </div>
      </div>
      {!isPrimary && (
        <button
          onClick={onVisit}
          style={{
            flexShrink: 0, padding: "7px 14px", borderRadius: 20,
            border: "none", background: isGraduated ? "var(--bg)" : "var(--green-light)",
            color: isGraduated ? "var(--mid)" : "var(--green)",
            fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif",
          }}
        >
          Visit
        </button>
      )}
    </div>
  );
}

// ── Country circle fallback ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CountryCircleFallback({ user, countryCircle, countryMember, posts, loadingPosts, hasMore, postCategory, setPostCategory, isAdminOrLeader, commentsPostId, setCommentsPostId, onDelete, onPin, onLoadMore, onPosted, router, modBannerDismissed, dismissModBanner, promptDismissed, setPromptDismissed }: any) {
  if (!countryCircle) return null;
  const joined = countryMember ? daysAgo(countryMember.joinedAt) : 0;
  const weekPrompt = getWeeklyPrompt();

  return (
    <div style={{ padding: "16px 16px 0" }}>
      {/* Welcome card */}
      {countryMember && isNewMember(countryMember.joinedAt) && (
        <div style={{ background: "var(--green-light)", borderRadius: 16, padding: "16px", marginBottom: 16, border: "1.5px solid var(--green)" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: "var(--green)", marginBottom: 6 }}>
            Welcome to {countryCircle.name}
          </div>
          <div style={{ fontSize: 13, color: "#1a5c45", lineHeight: 1.6 }}>
            {countryCircle._count.members.toLocaleString()} members here.
            {countryMember && ` Joined ${joined === 0 ? "today" : `${joined}d ago`}.`}
            {" "}Share, ask, and be heard — without judgment.
          </div>
        </div>
      )}

      {/* Moderation banner */}
      {!modBannerDismissed && (
        <div style={{ background: "white", borderRadius: 14, padding: "12px 14px", marginBottom: 16, border: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, fontSize: 12, color: "var(--mid)", lineHeight: 1.6 }}>
            This is a space for kindness, honesty, and real support — not for requesting items or donations.
          </div>
          <button onClick={dismissModBanner} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--green)", fontWeight: 700, fontFamily: "Nunito, sans-serif", flexShrink: 0 }}>
            Got it
          </button>
        </div>
      )}

      {/* Weekly prompt */}
      {!promptDismissed && (
        <div style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)", borderRadius: 14, padding: "14px", marginBottom: 16, border: "1px solid #e0e7ff" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>
            This week&apos;s prompt
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#312e81", lineHeight: 1.5, marginBottom: 10 }}>
            &ldquo;{weekPrompt}&rdquo;
          </div>
          <button onClick={() => setPromptDismissed(true)} style={{ fontSize: 11, color: "var(--mid)", background: "none", border: "none", cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
            Dismiss
          </button>
        </div>
      )}

      <CircleComposer
        circleId={countryCircle.id}
        userAvatar={user.avatar}
        userName={user.name}
        channels={[]}
        activeChannelId={null}
        onPosted={onPosted}
      />

      {/* Category filter */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, scrollbarWidth: "none" }}>
        {POST_FILTERS.map((f) => {
          const CatIcon = f.value !== "ALL" ? CATEGORY_ICONS[f.value] : null;
          return (
            <button
              key={f.value}
              onClick={() => setPostCategory(f.value)}
              style={{
                flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
                padding: "6px 13px", borderRadius: 20, border: "1.5px solid",
                borderColor: postCategory === f.value ? "var(--green)" : "var(--border)",
                background: postCategory === f.value ? "var(--green)" : "var(--white)",
                color: postCategory === f.value ? "white" : "var(--mid)",
                fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif",
              }}
            >
              {CatIcon && <CatIcon size={11} strokeWidth={2} color={postCategory === f.value ? "white" : "var(--mid)"} />}
              {f.label}
            </button>
          );
        })}
      </div>

      <PostFeed
        posts={posts}
        loading={loadingPosts}
        hasMore={hasMore}
        circleName={countryCircle.name}
        currentUserId={user.id}
        isAdminOrLeader={isAdminOrLeader}
        commentsPostId={commentsPostId}
        setCommentsPostId={setCommentsPostId}
        onDelete={onDelete}
        onPin={onPin}
        onLoadMore={onLoadMore}
        onPosted={onPosted}
      />

      {commentsPostId && (
        <CircleComments postId={commentsPostId} onClose={() => setCommentsPostId(null)} />
      )}

      {!user.onboardingComplete && (
        <div style={{ marginTop: 20, padding: "20px", background: "var(--green-light)", borderRadius: 16, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--green)", marginBottom: 8 }}>
            Complete your profile for your stage circle
          </div>
          <div style={{ fontSize: 12, color: "#1a5c45", marginBottom: 14, lineHeight: 1.5 }}>
            Once you add your pregnancy or postpartum stage, you&apos;ll be placed with mothers at exactly your point in the journey.
          </div>
          <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => router.push("/profile")}>
            Complete profile
          </button>
        </div>
      )}
    </div>
  );
}
