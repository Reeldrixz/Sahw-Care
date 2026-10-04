"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

export default function CirclePostCard({ post, currentUserId, isAdminOrLeader, onOpenComments, onDelete, onPin }: Props) {
  const [reactions, setReactions] = useState(post.reactions);
  const [reported, setReported] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // While the report sheet is open: Escape closes it, and the page behind
  // doesn't scroll.
  useEffect(() => {
    if (!showReport) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !reporting) setShowReport(false); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [showReport, reporting]);

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
            her own post: she can't report it, and her own post has ✕ delete. */}
        {!isOwn && (
          <button
            onClick={() => { setReportError(null); setShowReport(true); }}
            aria-label="Flag this post"
            aria-haspopup="dialog"
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

      {/* Report sheet. Portalled to <body> so the card's overflow:hidden
          (needed for its rounded coloured edge) can't clip it, and fixed above
          the bottom nav (z-index 100) like the app's other sheets. Bottom
          padding clears the home indicator on notched phones. */}
      {showReport && createPortal(
        <div
          onClick={() => { if (!reporting) setShowReport(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`report-title-${post.id}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--white)", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 460,
              maxHeight: "85vh", overflowY: "auto", animation: "sheetRise 0.25s ease",
              padding: "10px 16px calc(16px + env(safe-area-inset-bottom))",
              fontFamily: "Nunito, sans-serif",
            }}
          >
            <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 4, margin: "0 auto 14px" }} />
            <div id={`report-title-${post.id}`} style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>
              Flag this post
            </div>
            <div style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.5, marginBottom: 14 }}>
              Help us keep this space kind and safe. It&apos;s hidden while our team reviews it.
            </div>

            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => handleReport(r)}
                disabled={reporting}
                style={{
                  display: "flex", alignItems: "center", width: "100%", minHeight: 52,
                  textAlign: "left", padding: "12px 14px", marginBottom: 8,
                  fontSize: 15, fontWeight: 600, color: "var(--ink)", lineHeight: 1.35,
                  background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12,
                  cursor: reporting ? "default" : "pointer", opacity: reporting ? 0.6 : 1,
                  fontFamily: "Nunito, sans-serif",
                }}
              >
                {r}
              </button>
            ))}

            {reportError && (
              <div role="alert" style={{ fontSize: 13, color: "#c0392b", background: "#fdecea", borderRadius: 10, padding: "10px 12px", margin: "4px 0 8px", lineHeight: 1.5 }}>
                {reportError}
              </div>
            )}

            <button
              onClick={() => setShowReport(false)}
              disabled={reporting}
              style={{
                width: "100%", minHeight: 48, marginTop: 4, fontSize: 15, fontWeight: 700,
                color: "var(--mid)", background: "transparent", border: "none", borderRadius: 12,
                cursor: "pointer", fontFamily: "Nunito, sans-serif",
              }}
            >
              {reporting ? "Sending…" : "Cancel"}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
