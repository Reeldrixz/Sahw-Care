"use client";

import { useState } from "react";
import Avatar from "./Avatar";
import {
  Heart, HeartHandshake, Sparkles, MessageCircle,
  MoreHorizontal, Pin, X, Shield, Lightbulb, BookOpen,
  HandHeart, HelpCircle, Trophy, Users, type LucideIcon,
} from "lucide-react";

type ReactionType = "HEART" | "HUG" | "CLAP";
type PostCategory = "TIP" | "STORY" | "GRATITUDE" | "QUESTION" | "SMALL_WIN" | "SUPPORT";

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
  SUPPORT:   { color: "#db2777", bg: "#fdf2f8", label: "Support",   Icon: Users      },
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
  const [showMenu, setShowMenu] = useState(false);
  const [showReportFlow, setShowReportFlow] = useState(false);

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

  const handleReport = async (reason: string) => {
    setShowReportFlow(false);
    setShowMenu(false);
    await fetch(`/api/circles/posts/${post.id}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setReported(true);
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

        {/* Content */}
        <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--ink)", margin: "0 0 12px", whiteSpace: "pre-wrap" }}>
          {post.content}
        </p>

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

        {/* Context menu for other people's posts */}
        {!isOwn && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => { setShowMenu((p) => !p); setShowReportFlow(false); }}
              style={{ padding: "5px 7px", borderRadius: 20, border: "none", background: "transparent", cursor: "pointer", color: "var(--light)", display: "flex" }}
            >
              <MoreHorizontal size={16} />
            </button>
            {showMenu && !showReportFlow && (
              <div style={{ position: "absolute", right: 0, bottom: 34, background: "var(--white)", borderRadius: 14, boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)", padding: "8px", zIndex: 50, minWidth: 200 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)", padding: "4px 10px 8px" }}>Flag this post</div>
                <div style={{ fontSize: 11, color: "var(--mid)", padding: "0 10px 8px", lineHeight: 1.5 }}>
                  Help us keep this space kind and safe.
                </div>
                {REPORT_REASONS.map((r) => (
                  <button key={r} onClick={() => handleReport(r)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", fontSize: 12, color: "var(--ink)", background: "none", border: "none", cursor: "pointer", borderRadius: 8, fontFamily: "Nunito, sans-serif", lineHeight: 1.4 }}>
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
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
    </div>
  );
}
