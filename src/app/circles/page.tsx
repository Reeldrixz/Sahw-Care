"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import CirclePostCard, { Post } from "@/components/CirclePostCard";
import CircleComposer from "@/components/CircleComposer";
import CircleComments from "@/components/CircleComments";
import CircleIdentityModal from "@/components/CircleIdentityModal";
import { STAGE_META, StageKey } from "@/lib/stage";
import { HeartPulse, Heart, Smile, Star, LayoutGrid, type LucideIcon } from "lucide-react";

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

// ── Types ────────────────────────────────────────────────────────────────────

type PostCategory = "ALL" | "TIP" | "STORY" | "GRATITUDE" | "QUESTION";

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

// ── Helpers ──────────────────────────────────────────────────────────────────

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

/** Detect location via IP — no browser permissions required, works on all devices. */
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

// ── Main page ────────────────────────────────────────────────────────────────

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
  const [visitingCircle,     setVisitingCircle]     = useState<StageCircle | null>(null);
  const [visitPosts,         setVisitPosts]         = useState<Post[]>([]);
  const [visitLoading,       setVisitLoading]       = useState(false);
  const [visitCommentsPostId,setVisitCommentsPostId]= useState<string | null>(null);

  // Country circle state (fallback)
  const [countryCircle,   setCountryCircle]   = useState<CountryCircle | null>(null);
  const [countryMember,   setCountryMember]   = useState<Member | null>(null);
  const [geoDetecting,    setGeoDetecting]    = useState(false);
  const [loadingCountry,  setLoadingCountry]  = useState(false);

  // Shared post state
  const [posts,           setPosts]           = useState<Post[]>([]);
  const [postCategory,    setPostCategory]    = useState<PostCategory>("ALL");
  const [cursor,          setCursor]          = useState<string | null>(null);
  const [hasMore,         setHasMore]         = useState(false);
  const [loadingPosts,    setLoadingPosts]    = useState(false);
  const [commentsPostId,  setCommentsPostId]  = useState<string | null>(null);

  // Circle identity modal
  const [showIdentityModal, setShowIdentityModal] = useState(false);

  // Intro post
  const [showIntroPrompt, setShowIntroPrompt] = useState(false);
  const [introText, setIntroText] = useState("");
  const [hasIntroPost, setHasIntroPost] = useState(false);

  // Which circle are we showing the feed for?
  const activeCircle = cohortCircle ?? countryCircle;
  const activeMember = cohortCircle ? cohortMember : countryMember;

  // ── Show circle identity modal on first Circles visit ───────────────────
  useEffect(() => {
    if (!user || user.journeyType === "donor") return;
    if (user.circleIdentitySet) return;
    // Respect 7-day skip cooldown
    if (user.circleIdentitySkippedAt) {
      const daysSinceSkip = (Date.now() - new Date(user.circleIdentitySkippedAt).getTime()) / (86400 * 1000);
      if (daysSinceSkip < 7) return;
    }
    // Small delay so the page loads first
    const t = setTimeout(() => setShowIdentityModal(true), 800);
    return () => clearTimeout(t);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Check if user has already done intro post ─────────────────────────────
  useEffect(() => {
    if (!user || user.journeyType === "donor") return;
    fetch("/api/user/trust").then(r => r.json()).then(d => {
      const hasIntro = d.recentEvents?.some((e: { eventType: string }) => e.eventType === "INTRO_POST") ?? false;
      setHasIntroPost(hasIntro);
    }).catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Show intro prompt after identity modal is dismissed ───────────────────
  useEffect(() => {
    if (hasIntroPost || !user || user.journeyType === "donor") return;
    if (!activeCircle) return;
    if (user.circleIdentitySet && !showIdentityModal) {
      const t = setTimeout(() => setShowIntroPrompt(true), 1000);
      return () => clearTimeout(t);
    }
  }, [hasIntroPost, user?.id, activeCircle?.id, user?.circleIdentitySet, showIdentityModal]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load cohort circle ────────────────────────────────────────────────────
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

  // ── Load country circle (fallback if no cohort circle) ───────────────────
  useEffect(() => {
    if (!user || user.currentCircleId) return; // skip if cohort circle exists

    setLoadingCountry(true);
    (async () => {
      let result = await fetchCountryCircle();

      if (!result && user.location) {
        setGeoDetecting(true);
        result = await joinViaLocation(user.location);
        setGeoDetecting(false);
      }

      // No circle yet — detect via IP (works on all devices, no permissions)
      if (!result) {
        setGeoDetecting(true);
        const detected = await detectLocationViaIP();
        if (detected) {
          // Save location + countryCode to profile in background
          fetch("/api/profile", {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ location: detected.location, countryCode: detected.countryCode }),
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
  }, [user]);

  // ── Load all stage circles for Explore section ───────────────────────────
  useEffect(() => {
    if (!user?.currentCircleId) return;
    fetch("/api/circles/stages", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAllStages(d.circles ?? []));
  }, [user?.currentCircleId]);

  // ── Visit a non-primary circle ────────────────────────────────────────────
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
    // refresh allStages so accessType updates after auto-join
    fetch("/api/circles/stages", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAllStages(d.circles ?? []));
  }, []);

  // ── Load posts ────────────────────────────────────────────────────────────
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
    if (!activeCircle || !user) return;
    // Only subscribe when on primary/cohort circle, not when visiting
    if (visitingCircle) return;

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
            // Don't add own posts (already added optimistically by CircleComposer)
            if (newPost.author.id === user.id) return;
            // Prepend to top of feed only if not already there
            setPosts(prev => {
              if (prev.some(p => p.id === newPost.id)) return prev;
              return [newPost, ...prev];
            });
          }
        } catch {}
      };

      es.onerror = () => {
        es?.close();
        // Reconnect after 5s
        reconnectTimeout = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      es?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
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

  const submitIntroPost = async () => {
    if (!introText.trim() || !activeCircle) return;
    const res = await fetch(`/api/circles/${activeCircle.id}/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: introText.trim(), category: "STORY", isIntroPost: true }),
    });
    if (res.ok) {
      const d = await res.json();
      if (!d.flagged && d.post) {
        setPosts(prev => [{ ...d.post, author: { id: user!.id, name: user!.name, avatar: user!.avatar, city: null, countryFlag: user!.countryFlag, circleContext: user!.circleContext, circleDisplayName: user!.circleDisplayName, subTags: user!.subTags, trustScore: user!.trustScore, isLeader: false }, reactions: { HEART: 0, HUG: 0, CLAP: 0, myReaction: null }, commentCount: 0, liked: false, likeCount: 0, channelName: null, channelEmoji: null, channelId: null, isPinned: false }, ...prev]);
      }
      setHasIntroPost(true);
      setShowIntroPrompt(false);
      setIntroText("");
    }
  };

  const isAdminOrLeader = user?.role === "ADMIN" || activeMember?.isLeader === true;

  // ── Loading / auth guards ─────────────────────────────────────────────────

  if (authLoading) {
    return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;
  }

  if (!user) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
        <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Join the Circle</div>
        <p style={{ color: "var(--mid)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
          Sign in to connect with mothers in your community.
        </p>
        <button className="btn-primary" onClick={() => router.push("/auth")}>Sign in to join</button>
      </div>
    );
  }

  // Donors have no circles access — redirect to discover
  if (user.onboardingComplete && user.journeyType === "donor") {
    router.replace("/");
    return null;
  }

  // ── Not onboarded & no country circle yet ────────────────────────────────

  if (!user.onboardingComplete && !user.currentCircleId) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
        <div className="browse-header">
          <div className="browse-title">Circles</div>
        </div>
        <div style={{ padding: "20px 16px" }}>
          {/* Onboarding prompt card */}
          <div
            onClick={() => {/* OnboardingGate in layout handles the modal */}}
            style={{
              background: "linear-gradient(135deg, #1a7a5e 0%, #2a9d7f 100%)",
              borderRadius: 18, padding: "22px 20px", marginBottom: 20, cursor: "pointer",
              color: "white",
            }}
          >
            <div style={{ fontSize: 26, marginBottom: 8 }}>💛</div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
              Join your stage group
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.9, marginBottom: 14 }}>
              Complete your profile to be placed in a circle with moms at exactly your stage of pregnancy or parenthood.
            </p>
            <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700 }}>
              Complete your profile →
            </div>
          </div>

          {/* Country circle fallback below prompt */}
          <CountryCircleFallback
            user={user}
            loadingCountry={loadingCountry}
            geoDetecting={geoDetecting}
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
          />
        </div>
      </div>
    );
  }

  // ── Loading cohort circle ─────────────────────────────────────────────────

  if (loadingCohort || geoDetecting || (loadingCountry && !countryCircle)) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div className="browse-header"><div className="browse-title">Circles</div></div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", gap: 16 }}>
          <div style={{ fontSize: 40 }}>🌍</div>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700 }}>Finding your circle…</div>
          <div className="spinner" style={{ marginTop: 8 }} />
        </div>
      </div>
    );
  }

  // ── Visiting a non-primary circle ────────────────────────────────────────

  if (visitingCircle) {
    const meta = STAGE_META[visitingCircle.stageKey as StageKey];
    const bannerText = visitingCircle.isGraduated
      ? "You previously belonged to this circle. Your posts are still here and you can still comment!"
      : "You are visiting this circle — you can read and comment, but posting is for members at this stage.";

    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "16px 16px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <StageIcon stageKey={visitingCircle.stageKey} size={22} color="white" />
            </div>
            <div>
              <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, color: "white", lineHeight: 1.2 }}>
                {meta?.label ?? visitingCircle.name}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
                {meta?.description ?? `${visitingCircle.memberCount.toLocaleString()} members`}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 16px 0" }}>
          {/* Visiting / graduated banner */}
          <div style={{
            background: visitingCircle.isGraduated ? "#f0f7ff" : "#fdf8e8",
            border: `1.5px solid ${visitingCircle.isGraduated ? "#90c4f9" : "#f6c90e"}`,
            borderRadius: 14, padding: "12px 16px", marginBottom: 16, fontSize: 13, lineHeight: 1.6,
            color: visitingCircle.isGraduated ? "#1a5c9e" : "#8a6800",
          }}>
            {visitingCircle.isGraduated ? "📚 " : "👀 "}{bannerText}
          </div>

          {/* Post feed — no composer */}
          {visitLoading ? (
            <div className="loading" style={{ minHeight: 200 }}><div className="spinner" /></div>
          ) : visitPosts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--mid)" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>✨</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>No posts here yet</div>
            </div>
          ) : (
            <>
              {visitPosts.map((post) => (
                <CirclePostCard
                  key={post.id}
                  post={post}
                  currentUserId={user!.id}
                  isAdminOrLeader={false}
                  onOpenComments={setVisitCommentsPostId}
                  onDelete={() => {}}
                  onPin={() => {}}
                />
              ))}
            </>
          )}
        </div>

        {visitCommentsPostId && (
          <CircleComments
            postId={visitCommentsPostId}
            onClose={() => setVisitCommentsPostId(null)}
          />
        )}
      </div>
    );
  }

  // ── Cohort circle view ────────────────────────────────────────────────────

  if (cohortCircle) {
    const stageMeta = cohortCircle.stageKey ? STAGE_META[cohortCircle.stageKey as keyof typeof STAGE_META] : null;
    const joined    = cohortMember ? daysAgo(cohortMember.joinedAt) : 0;

    const POST_FILTERS: { value: PostCategory; label: string }[] = [
      { value: "ALL",       label: "All"          },
      { value: "TIP",       label: "💡 Tips"      },
      { value: "STORY",     label: "📖 Stories"   },
      { value: "GRATITUDE", label: "🙏 Gratitude" },
      { value: "QUESTION",  label: "❓ Questions" },
    ];

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
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 3 }}>
                  {stageMeta?.description ?? `${cohortCircle._count.members.toLocaleString()} members`}
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
          {/* Welcome banner for new members */}
          {cohortMember && isNewMember(cohortMember.joinedAt) && (
            <div style={{ background: "var(--green-light)", borderRadius: 14, padding: "14px 16px", marginBottom: 16, border: "1.5px solid var(--green)" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--green)", marginBottom: 4 }}>
                👋 Welcome to your circle!
              </div>
              <div style={{ fontSize: 13, color: "var(--green)", lineHeight: 1.6, opacity: 0.9 }}>
                You&apos;re now connected with moms at the same stage as you. Share tips, ask questions, and support each other.
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
            {POST_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setPostCategory(f.value)}
                style={{
                  flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "1.5px solid",
                  borderColor: postCategory === f.value ? "var(--green)" : "var(--border)",
                  background: postCategory === f.value ? "var(--green)" : "var(--white)",
                  color: postCategory === f.value ? "white" : "var(--mid)",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Community note */}
          <div style={{ fontSize: 11, color: "var(--mid)", background: "var(--green-light)", borderRadius: 10, padding: "8px 12px", marginBottom: 16, lineHeight: 1.5 }}>
            💛 This is a space for sharing, support and connection — not for requesting items. Posts that ask for donations are blocked.
          </div>

          {/* Intro post banner */}
          {!hasIntroPost && cohortCircle && !showIntroPrompt && (
            <div style={{ background: "#e8f5f1", borderRadius: 14, padding: "12px 14px", marginBottom: 14, border: "1.5px solid #1a7a5e", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
              onClick={() => setShowIntroPrompt(true)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1a7a5e" }}>Introduce yourself to your circle</div>
                <div style={{ fontSize: 11, color: "var(--mid)", marginTop: 2 }}>Earn +8 trust points · takes 30 seconds</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#1a7a5e" }}>→</div>
            </div>
          )}

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

        {/* Circle identity setup modal */}
        {showIdentityModal && (
          <CircleIdentityModal onDone={() => setShowIdentityModal(false)} />
        )}

        {/* Intro post modal */}
        {showIntroPrompt && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowIntroPrompt(false); }}>
            <div style={{ background: "var(--white)", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 430, padding: "20px 20px 40px", animation: "sheetUp 0.3s ease" }}>
              <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 4, margin: "0 auto 16px" }} />
              <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Introduce yourself</div>
              <div style={{ fontSize: 12, color: "var(--mid)", marginBottom: 16, fontFamily: "Nunito, sans-serif" }}>Share a little about yourself with your circle. This earns you +8 trust points!</div>
              <textarea
                value={introText}
                onChange={e => setIntroText(e.target.value.slice(0, 500))}
                placeholder="Hi! I'm [name]. I'm [stage] and I'm so excited to be here..."
                rows={4}
                style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", resize: "none", outline: "none", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button onClick={() => setShowIntroPrompt(false)}
                  style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1.5px solid var(--border)", background: "none", fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                  Skip for now
                </button>
                <button onClick={submitIntroPost} disabled={!introText.trim()}
                  style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: "#1a7a5e", color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif", opacity: !introText.trim() ? 0.5 : 1 }}>
                  Post intro (+8 pts)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ExploreSheet — full-screen overlay */}
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

  // ── No cohort circle → country circle fallback ────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
      <div className="browse-header" style={{ paddingBottom: 12 }}>
        <div className="browse-title">{countryCircle?.name ?? "Circles"}</div>
        {countryCircle && (
          <div style={{ fontSize: 12, color: "var(--mid)", marginTop: 4 }}>
            {countryCircle._count.members.toLocaleString()} members · Neighbourhood circle
          </div>
        )}
      </div>

      {!countryCircle ? (
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📍</div>
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
          loadingCountry={false}
          geoDetecting={false}
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
        />
      )}

      {showIdentityModal && (
        <CircleIdentityModal onDone={() => setShowIdentityModal(false)} />
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

const POST_FILTERS: { value: PostCategory; label: string }[] = [
  { value: "ALL",       label: "All"          },
  { value: "TIP",       label: "💡 Tips"      },
  { value: "STORY",     label: "📖 Stories"   },
  { value: "GRATITUDE", label: "🙏 Gratitude" },
  { value: "QUESTION",  label: "❓ Questions" },
];

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

function PostFeed({ posts, loading, hasMore, circleName, currentUserId, isAdminOrLeader, commentsPostId, setCommentsPostId, onDelete, onPin, onLoadMore }: PostFeedProps) {
  if (loading && posts.length === 0) {
    return <div className="loading" style={{ minHeight: 200 }}><div className="spinner" /></div>;
  }
  if (posts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--mid)" }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>✨</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
          Be the first to post in {circleName} 🌟
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>Share a tip, a story, or something you&apos;re grateful for today.</div>
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

// ── Stage Circle Card (used in Explore + Previous sections) ──────────────────

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
          <div style={{ fontSize: 11, color: "var(--mid)", lineHeight: 1.4 }}>
            {meta.description}
          </div>
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CountryCircleFallback({ user, countryCircle, countryMember, posts, loadingPosts, hasMore, postCategory, setPostCategory, isAdminOrLeader, commentsPostId, setCommentsPostId, onDelete, onPin, onLoadMore, onPosted }: any) {
  if (!countryCircle) return null;
  const joined = countryMember ? daysAgo(countryMember.joinedAt) : 0;
  return (
    <div style={{ padding: "16px 16px 0" }}>
      {countryMember && isNewMember(countryMember.joinedAt) && (
        <div style={{ background: "linear-gradient(135deg, #1a7a5e 0%, #2a9d7f 100%)", borderRadius: 16, padding: "16px 18px", marginBottom: 16, color: "white" }}>
          <div style={{ fontSize: 18, marginBottom: 6 }}>👋 Welcome to {countryCircle.name}!</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.9 }}>
            {countryCircle._count.members.toLocaleString()} members
            {countryMember && ` · Joined ${joined === 0 ? "today" : `${joined}d ago`}`}
          </div>
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

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, scrollbarWidth: "none" }}>
        {POST_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setPostCategory(f.value)}
            style={{
              flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "1.5px solid",
              borderColor: postCategory === f.value ? "var(--green)" : "var(--border)",
              background: postCategory === f.value ? "var(--green)" : "var(--white)",
              color: postCategory === f.value ? "white" : "var(--mid)",
              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, color: "var(--mid)", background: "var(--green-light)", borderRadius: 10, padding: "8px 12px", marginBottom: 16, lineHeight: 1.5 }}>
        💛 This is a space for sharing, support and connection — not for requesting items or donations.
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
    </div>
  );
}
