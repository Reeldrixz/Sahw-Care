"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import CirclePostCard, { Post } from "@/components/CirclePostCard";
import CircleComposer from "@/components/CircleComposer";
import CircleComments from "@/components/CircleComments";

type Category = "ALL" | "TIP" | "STORY" | "GRATITUDE" | "QUESTION";

interface Circle {
  id: string;
  name: string;
  country: string;
  _count: { members: number; posts: number };
}

interface Member {
  joinedAt: string;
  isLeader: boolean;
  lastViewedAt: string | null;
}

const FILTERS: { value: Category; label: string }[] = [
  { value: "ALL",       label: "All" },
  { value: "TIP",       label: "💡 Tips" },
  { value: "STORY",     label: "📖 Stories" },
  { value: "GRATITUDE", label: "🙏 Gratitude" },
  { value: "QUESTION",  label: "❓ Questions" },
];

function isNewMember(joinedAt: string): boolean {
  return Date.now() - new Date(joinedAt).getTime() < 7 * 24 * 60 * 60 * 1000;
}

async function detectAndJoin(): Promise<{ circle: Circle; member: Member } | null> {
  // Already have a circle from profile location?
  const myRes = await fetch("/api/circles/my", { cache: "no-store" });
  const myData = await myRes.json();
  if (myData.circle) return { circle: myData.circle, member: myData.member };

  // No circle yet — try browser geolocation
  if (!navigator.geolocation) return null;

  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 8000 });
  });
  if (!position) return null;

  try {
    const { latitude, longitude } = position.coords;
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
    );
    const geoData = await geoRes.json();
    const city =
      geoData.address?.city ||
      geoData.address?.town ||
      geoData.address?.village ||
      geoData.address?.county;
    const country = geoData.address?.country;
    if (!country) return null;

    const location = city ? `${city}, ${country}` : country;

    // Save to profile (this also triggers autoJoinCircle server-side)
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location }),
    });

    // Re-fetch circle after joining
    const refreshed = await fetch("/api/circles/my", { cache: "no-store" });
    const refreshedData = await refreshed.json();
    if (refreshedData.circle) return { circle: refreshedData.circle, member: refreshedData.member };
  } catch {
    // Nominatim or network error — fall through
  }

  return null;
}

export default function CirclesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [circle, setCircle] = useState<Circle | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [category, setCategory] = useState<Category>("ALL");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingCircle, setLoadingCircle] = useState(true);
  const [geoDetecting, setGeoDetecting] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    (async () => {
      // First: quick check for existing circle (covers users who already have location)
      const myRes = await fetch("/api/circles/my", { cache: "no-store" });
      const myData = await myRes.json();

      if (myData.circle) {
        setCircle(myData.circle);
        setMember(myData.member);
        setLoadingCircle(false);
        fetch("/api/circles/my", { method: "PATCH" }).catch(() => {});
        return;
      }

      // No circle — attempt geolocation silently
      setGeoDetecting(true);
      const result = await detectAndJoin();
      setGeoDetecting(false);

      if (result) {
        setCircle(result.circle);
        setMember(result.member);
        fetch("/api/circles/my", { method: "PATCH" }).catch(() => {});
      }
      // If result is null, circle stays null → show manual fallback
      setLoadingCircle(false);
    })();
  }, [user]);

  const loadPosts = useCallback(async (reset = false) => {
    if (!circle) return;
    setLoadingPosts(true);
    const cur = reset ? null : cursor;
    const url = `/api/circles/${circle.id}/posts?category=${category}${cur ? `&cursor=${cur}` : ""}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const d = await res.json();
      setPosts((p) => reset ? d.posts : [...p, ...d.posts]);
      setCursor(d.nextCursor);
      setHasMore(!!d.nextCursor && d.posts.length === 20);
    }
    setLoadingPosts(false);
  }, [circle, category, cursor]);

  useEffect(() => {
    if (circle) { setPosts([]); setCursor(null); loadPosts(true); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circle, category]);

  const handleDelete = async (postId: string) => {
    if (!confirm("Delete this post?")) return;
    await fetch(`/api/circles/posts/${postId}`, { method: "DELETE" });
    setPosts((p) => p.filter((x) => x.id !== postId));
  };

  const handlePin = async (postId: string, pin: boolean) => {
    await fetch(`/api/circles/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: pin }),
    });
    setPosts((p) =>
      p
        .map((x) => (x.id === postId ? { ...x, isPinned: pin } : x))
        .sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
    );
  };

  const isAdminOrLeader = user?.role === "ADMIN" || member?.isLeader === true;

  // ── Loading states ───────────────────────────────────────────────────────

  if (authLoading) {
    return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;
  }

  if (!user) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
        <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Join the Circle</div>
        <p style={{ color: "var(--mid)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
          Sign in to connect with mothers and donors in your community.
        </p>
        <button className="btn-primary" onClick={() => router.push("/auth")}>Sign in to join</button>
      </div>
    );
  }

  if (loadingCircle || geoDetecting) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div className="browse-header"><div className="browse-title">Circles</div></div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", gap: 16 }}>
          <div style={{ fontSize: 40 }}>🌍</div>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700 }}>Finding your circle…</div>
          <div style={{ fontSize: 13, color: "var(--mid)" }}>Detecting your location</div>
          <div className="spinner" style={{ marginTop: 8 }} />
        </div>
      </div>
    );
  }

  // ── No circle — geolocation unavailable or denied ────────────────────────

  if (!circle) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
        <div className="browse-header"><div className="browse-title">Circles</div></div>
        <div style={{ padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📍</div>
          <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 10 }}>
            We couldn't detect your location
          </div>
          <p style={{ color: "var(--mid)", fontSize: 14, lineHeight: 1.6, maxWidth: 300, margin: "0 auto 24px" }}>
            Add your city and country in your profile and we'll place you in your country's circle automatically.
          </p>
          <button className="btn-primary" onClick={() => router.push("/profile")}>
            Go to profile settings
          </button>
          <p style={{ fontSize: 11, color: "var(--light)", marginTop: 16, lineHeight: 1.5 }}>
            As our community grows, circles will split into cities and neighbourhoods.
          </p>
        </div>
      </div>
    );
  }

  // ── Circle feed ──────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
      {/* Header */}
      <div className="browse-header" style={{ paddingBottom: 12 }}>
        <div className="browse-title">{circle.name}</div>
        <div style={{ fontSize: 12, color: "var(--mid)", marginTop: 4 }}>
          {circle._count.members.toLocaleString()} {circle._count.members === 1 ? "member" : "members"} · Neighbourhood circle
        </div>
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        {/* New member welcome banner */}
        {member && isNewMember(member.joinedAt) && (
          <div style={{ background: "linear-gradient(135deg, #1a7a5e 0%, #2a9d7f 100%)", borderRadius: 16, padding: "16px 18px", marginBottom: 16, color: "white" }}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>👋 Welcome to {circle.name}!</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.9 }}>
              This is a warm space to share tips, stories and encouragement — not a place to request donations. Be yourself, be kind.
            </div>
            {member.isLeader && (
              <div style={{ marginTop: 10, fontSize: 12, background: "rgba(255,255,255,0.2)", borderRadius: 8, padding: "6px 10px", fontWeight: 700 }}>
                ⭐ You're a Circle Leader — you can pin and remove posts.
              </div>
            )}
          </div>
        )}

        {/* Post composer */}
        <CircleComposer
          circleId={circle.id}
          userAvatar={user.avatar}
          userName={user.name}
          onPosted={() => loadPosts(true)}
        />

        {/* Category filter chips */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, scrollbarWidth: "none" }}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setCategory(f.value)}
              style={{
                flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "1.5px solid",
                borderColor: category === f.value ? "var(--green)" : "var(--border)",
                background: category === f.value ? "var(--green)" : "var(--white)",
                color: category === f.value ? "white" : "var(--mid)",
                fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Community note */}
        <div style={{ fontSize: 11, color: "var(--mid)", background: "var(--green-light)", borderRadius: 10, padding: "8px 12px", marginBottom: 16, lineHeight: 1.5 }}>
          💛 This is a space for sharing, support and connection — not for requesting items or donations. Posts that ask for donations are automatically blocked.
        </div>

        {/* Feed */}
        {loadingPosts && posts.length === 0 ? (
          <div className="loading" style={{ minHeight: 200 }}><div className="spinner" /></div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--mid)" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✨</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              Be the first to post in {circle.name} 🌟
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>Share a tip, a story, or something you're grateful for today.</div>
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

        <p style={{ fontSize: 11, color: "var(--light)", textAlign: "center", lineHeight: 1.6, marginTop: 8, paddingBottom: 16 }}>
          As our community grows, circles will split into cities and neighbourhoods.
        </p>
      </div>

      {/* Comments sheet */}
      {commentsPostId && (
        <CircleComments
          postId={commentsPostId}
          onClose={() => {
            setCommentsPostId(null);
            loadPosts(true);
          }}
        />
      )}
    </div>
  );
}
