"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { computePopoverPos, POPOVER_MAX_WIDTH, type PopoverPos } from "@/lib/popoverPosition";
import Avatar from "./Avatar";
import {
  Heart, HeartHandshake, Sparkles, MessageCircle,
  MoreHorizontal, Pin, X, Shield, Lightbulb, BookOpen,
  HandHeart, HelpCircle, Trophy, Users, Target, type LucideIcon,
} from "lucide-react";

type ReactionType = "HEART" | "HUG" | "CLAP";
type PostCategory = "TIP" | "STORY" | "GRATITUDE" | "QUESTION" | "SMALL_WIN" | "SUPPORT" | "WORKING_ON";

interface Author {
  id: string;
  name: string;
  avatar: string | null;
  city: string | null;
  countryFlag: string | null;
  circleContext: string | null;
  circleDisplayName: string | null;
  subTags: string[];
  trustScore: number;
  isLeader: boolean;
}

interface Reactions {
  HEART: number;
  HUG: number;
  CLAP: number;
  myReaction: ReactionType | null;
}

export interface Post {
  id: string;
  content: string;
  category: PostCategory;
  photoUrl: string | null;
  isPinned: boolean;
  createdAt: string;
  channelName: string | null;
  channelEmoji: string | null;
  channelId?: string | null;
  author: Author;
  reactions: Reactions;
  commentCount: number;
  liked?: boolean;
  likeCount?: number;
}

interface Props {
  post: Post;
  currentUserId: string;
  // The viewer's account role. Admins can read circles but not write in them
  // (lib/circleAccess), so they get no report button. Leaders are mothers.
  viewerRole: "DONOR" | "RECIPIENT" | "ADMIN";
  isAdminOrLeader: boolean;
  onOpenComments: (postId: string) => void;
  onDelete: (postId: string) => void;
  onPin: (postId: string, pin: boolean) => void;
}

const CATEGORY_META: Record<PostCategory, { color: string; bg: string; label: string; Icon: LucideIcon }> = {
  TIP:       { color: "#d97706", bg: "#fef3c7", label: "Tip",       Icon: Lightbulb  },
  STORY:     { color: "#7c3aed", bg: "#f5f3ff", label: "Story",     Icon: BookOpen   },
  GRATITUDE: { color: "#1a7a5e", bg: "#e8f5f1", label: "Gratitude", Icon: HandHeart  },
  QUESTION:  { color: "#2563eb", bg: "#eff6ff", label: "Question",  Icon: HelpCircle },
  SMALL_WIN: { color: "#0891b2", bg: "#ecfeff", label: "Small Win", Icon: Trophy     },
  SUPPORT:    { color: "#db2777", bg: "#fdf2f8", label: "Support",    Icon: Users   },
  WORKING_ON: { color: "#c2410c", bg: "#fff7ed", label: "Working on", Icon: Target  },
};

const REACTIONS: { type: ReactionType; label: string; Icon: LucideIcon }[] = [
  { type: "HEART", label: "Love",            Icon: Heart         },
  { type: "HUG",   label: "You've got this", Icon: HeartHandshake },
  { type: "CLAP",  label: "Thank you",       Icon: Sparkles      },
];

const REPORT_REASONS = [
  "This feels like a request for items or donations",
  "The tone isn't kind or supportive",
  "I'm worried about this person's wellbeing",
  "Something else seems off",
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function CirclePostCard({ post, currentUserId, viewerRole, isAdminOrLeader, onOpenComments, onDelete, onPin }: Props) {
  const [reactions, setReactions] = useState(post.reactions);
  const [reported, setReported] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [popPos, setPopPos] = useState<PopoverPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Place the report popover next to the "..." button. It is portalled and
  // position:fixed, so it is measured against the viewport: opens upward when
  // it fits above the button (as the old menu did), otherwise downward, and
  // never runs under the bottom nav. Re-placed on scroll and resize, and when
  // its height changes (an error message appearing).
  const placePopover = useCallback(() => {
    const btn = triggerRef.current;
    const pop = popoverRef.current;
    if (!btn || !pop) return;
    setPopPos(computePopoverPos(btn.getBoundingClientRect(), pop.offsetHeight));
  }, []);

  useLayoutEffect(() => {
    if (showReport) placePopover();
  }, [showReport, reportError, reporting, placePopover]);

  // While it is open: Escape closes it; scrolling or resizing re-places it.
  useEffect(() => {
    if (!showReport) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !reporting) setShowReport(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", placePopover);
    window.addEventListener("scroll", placePopover, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", placePopover);
      window.removeEventListener("scroll", placePopover, true);
    };
  }, [showReport, reporting, placePopover]);

  const closeReport = () => { if (!reporting) { setShowReport(false); setPopPos(null); } };

  const cat = CATEGORY_META[post.category] ?? CATEGORY_META.STORY;
  const CategoryIcon = cat.Icon;
  const isOwn = post.author.id === currentUserId;

  const displayName = post.author.circleDisplayName?.trim() || post.author.name.split(" ")[0];
  const displayIdentity = post.author.circleContext
    ? `${post.author.circleContext} · ${displayName}`
    : displayName;

  const handleReact = async (type: ReactionType) => {
    const prev = reactions.myReaction;
    setReactions((r) => {
      const next = { ...r };
      if (prev) next[prev] = Math.max(0, next[prev] - 1);
      if (prev === type) {
        next.myReaction = null;
      } else {
        next[type]++;
        next.myReaction = type;
      }
      return next;
    });
    await fetch(`/api/circles/posts/${post.id}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    }).catch(() => setReactions(post.reactions));
  };

  // Only shows the thank-you once the report was accepted. It used to show it
  // whatever came back, so a refused report (rate limit, a post no longer
  // there) still told her it had been flagged.
  const handleReport = async (reason: string) => {
    setReporting(true);
    setReportError(null);
    try {
      const res = await fetch(`/api/circles/posts/${post.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        setShowReport(false);
        setPopPos(null);
        setReported(true);
        return;
      }
      const d = await res.json().catch(() => ({}));
      setReportError(
        res.status === 429 ? (d.error ?? "You've sent a lot of reports recently. Please try again later.")
        : res.status === 404 ? "This post isn't available any more."
        : "Something went wrong. Please try again.",
      );
    } catch {
      setReportError("Network error. Please check your connection.");
    } finally {
      setReporting(false);
    }
  };

  if (reported) {
    return (
      <div style={{ background: "var(--white)", borderRadius: 16, padding: "20px", marginBottom: 12, textAlign: "center", color: "var(--mid)", fontSize: 13, border: "1px solid var(--border)" }}>
        <Shield size={20} color="#1a7a5e" style={{ marginBottom: 6 }} />
        <div style={{ fontWeight: 700, color: "#1a7a5e", marginBottom: 4 }}>Thank you for flagging this</div>
        <div>Our team reviews every report. The circle stays safe because of people like you.</div>
      </div>
    );
  }

  return (
    <div style={{
      background: "var(--white)", borderRadius: 16, marginBottom: 12,
      boxShadow: "var(--shadow)", border: "1px solid var(--border)",
      borderLeft: `4px solid ${cat.color}`, overflow: "hidden", position: "relative",
    }}>
      <div style={{ padding: "14px 14px 0 14px" }}>
        {/* Pin indicator */}
        {post.isPinned && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--green)", fontWeight: 700, marginBottom: 8 }}>
            <Pin size={11} />
            Pinned
          </div>
        )}

        {/* Author row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
          <Avatar src={post.author.avatar} name={post.author.name} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{displayIdentity}</span>
              {post.author.isLeader && (
                <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 20, background: "var(--green)", color: "white" }}>
                  Leader
                </span>
              )}
              {post.channelName && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: "var(--bg)", color: "var(--mid)" }}>
                  {post.channelEmoji} {post.channelName}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--mid)" }}>
              {post.author.countryFlag && <span style={{ marginRight: 3 }}>{post.author.countryFlag}</span>}
              {post.author.city ? `${post.author.city} · ` : ""}{timeAgo(post.createdAt)}
            </div>
            {post.author.subTags?.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                {post.author.subTags.map((tag) => (
                  <span key={tag} style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: "var(--green-light)", color: "var(--green)" }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Category pill */}
          <span style={{
            display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
            fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20,
            background: cat.bg, color: cat.color,
          }}>
            <CategoryIcon size={11} strokeWidth={2} />
            {cat.label}
          </span>
        </div>

        {/* Content — first line bold title if multi-line */}
        {(() => {
          const nl = post.content.indexOf("\n");
          if (nl === -1) {
            return (
              <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--ink)", margin: "0 0 12px", whiteSpace: "pre-wrap" }}>
                {post.content}
              </p>
            );
          }
          const title = post.content.slice(0, nl).trim();
          const body  = post.content.slice(nl + 1).trimStart();
          return (
            <div style={{ marginBottom: 12 }}>
              {title && <p style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.4, color: "var(--ink)", margin: "0 0 5px" }}>{title}</p>}
              {body  && <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--mid)", margin: 0, whiteSpace: "pre-wrap" }}>{body}</p>}
            </div>
          );
        })()}

        {/* Photo */}
        {post.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.photoUrl}
            alt="Post photo"
            style={{ width: "100%", borderRadius: 12, marginBottom: 12, maxHeight: 280, objectFit: "cover" }}
          />
        )}
      </div>

      {/* Action bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 2, borderTop: "1px solid var(--border)", padding: "8px 10px" }}>
        {REACTIONS.map(({ type, label, Icon }) => {
          const active = reactions.myReaction === type;
          return (
            <button
              key={type}
              onClick={() => handleReact(type)}
              title={label}
              style={{
                display: "flex", alignItems: "center", gap: 3, padding: "5px 9px",
                borderRadius: 20, border: "1.5px solid",
                borderColor: active ? cat.color : "var(--border)",
                background: active ? cat.bg : "transparent",
                cursor: "pointer", fontSize: 12, fontWeight: 700,
                fontFamily: "Nunito, sans-serif",
                color: active ? cat.color : "var(--mid)",
                transition: "all 0.12s",
              }}
            >
              <Icon size={13} strokeWidth={1.75} color={active ? cat.color : "var(--mid)"} />
              {reactions[type] > 0 && <span>{reactions[type]}</span>}
            </button>
          );
        })}

        <button
          onClick={() => onOpenComments(post.id)}
          style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 5,
            padding: "5px 10px", borderRadius: 20, border: "1.5px solid var(--border)",
            background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 700,
            color: "var(--mid)", fontFamily: "Nunito, sans-serif",
          }}
        >
          <MessageCircle size={13} strokeWidth={1.75} />
          {post.commentCount > 0 ? post.commentCount : "Reply"}
        </button>

        {/* "..." on other people's posts opens the report sheet. Not shown on
            her own post (she can't report it; it has ✕ delete), nor to an
            admin, who reads circles but can't report in them — the API would
            refuse. Leaders are mothers and keep it. */}
        {!isOwn && viewerRole !== "ADMIN" && (
          <button
            ref={triggerRef}
            onClick={() => { setReportError(null); setPopPos(null); setShowReport((open) => !open); }}
            aria-label="Flag this post"
            aria-haspopup="dialog"
            aria-expanded={showReport}
            style={{ minWidth: 40, minHeight: 36, padding: "5px 7px", borderRadius: 20, border: "none", background: "transparent", cursor: "pointer", color: "var(--light)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <MoreHorizontal size={18} />
          </button>
        )}

        {/* Admin/leader actions */}
        {isAdminOrLeader && (
          <>
            <button
              onClick={() => onPin(post.id, !post.isPinned)}
              title={post.isPinned ? "Unpin" : "Pin"}
              style={{ padding: "5px 7px", borderRadius: 20, border: "none", background: "transparent", cursor: "pointer", display: "flex", color: "var(--green)" }}
            >
              <Pin size={14} strokeWidth={post.isPinned ? 2.5 : 1.75} />
            </button>
            <button
              onClick={() => onDelete(post.id)}
              style={{ padding: "5px 7px", borderRadius: 20, border: "none", background: "transparent", cursor: "pointer", display: "flex", color: "var(--terra)" }}
            >
              <X size={14} />
            </button>
          </>
        )}
        {isOwn && !isAdminOrLeader && (
          <button
            onClick={() => onDelete(post.id)}
            style={{ padding: "5px 7px", borderRadius: 20, border: "none", background: "transparent", cursor: "pointer", display: "flex", color: "var(--light)" }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Report popover, anchored to "...". Portalled to <body> so the card's
          overflow:hidden (needed for its rounded coloured edge) can't clip it,
          and at z-index 300, above the bottom nav (100); computePopoverPos
          also keeps it out from under the nav. First render is invisible, to
          measure its height before placing it. A transparent layer behind it
          closes it on any tap outside. */}
      {showReport && createPortal(
        <>
          <div onClick={closeReport} style={{ position: "fixed", inset: 0, zIndex: 299 }} />
          <div
            ref={popoverRef}
            role="dialog"
            aria-labelledby={`report-title-${post.id}`}
            style={{
              position: "fixed", zIndex: 300,
              top: popPos?.top ?? 0, left: popPos?.left ?? 0, width: popPos?.width ?? POPOVER_MAX_WIDTH,
              maxHeight: popPos?.maxHeight, overflowY: "auto",
              visibility: popPos ? "visible" : "hidden",
              background: "var(--white)", borderRadius: 14, boxShadow: "var(--shadow-lg)",
              border: "1px solid var(--border)", padding: 8, fontFamily: "Nunito, sans-serif",
            }}
          >
            <div id={`report-title-${post.id}`} style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", padding: "4px 10px 2px" }}>
              Flag this post
            </div>
            <div style={{ fontSize: 12, color: "var(--mid)", padding: "0 10px 6px", lineHeight: 1.45 }}>
              Help us keep this space kind and safe.
            </div>

            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => handleReport(r)}
                disabled={reporting}
                style={{
                  display: "flex", alignItems: "center", width: "100%", minHeight: 44,
                  textAlign: "left", padding: "9px 10px", fontSize: 14, color: "var(--ink)",
                  lineHeight: 1.35, background: "none", border: "none", borderRadius: 8,
                  cursor: reporting ? "default" : "pointer", opacity: reporting ? 0.55 : 1,
                  fontFamily: "Nunito, sans-serif",
                }}
              >
                {r}
              </button>
            ))}

            {reporting && (
              <div style={{ fontSize: 12, color: "var(--mid)", padding: "6px 10px 2px" }}>Sending…</div>
            )}
            {reportError && (
              <div role="alert" style={{ fontSize: 12, color: "#c0392b", background: "#fdecea", borderRadius: 8, padding: "8px 10px", margin: "6px 2px 2px", lineHeight: 1.45 }}>
                {reportError}
              </div>
            )}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
