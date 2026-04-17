"use client";

import { useState } from "react";
import Avatar from "./Avatar";

type ReactionType = "HEART" | "HUG" | "CLAP";

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
  category: "TIP" | "STORY" | "GRATITUDE" | "QUESTION";
  photoUrl: string | null;
  isPinned: boolean;
  createdAt: string;
  channelName: string | null;
  channelEmoji: string | null;
  author: Author;
  reactions: Reactions;
  commentCount: number;
}

interface Props {
  post: Post;
  currentUserId: string;
  isAdminOrLeader: boolean;
  onOpenComments: (postId: string) => void;
  onDelete: (postId: string) => void;
  onPin: (postId: string, pin: boolean) => void;
}

const CATEGORY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  TIP:       { bg: "#e8f5f1", color: "#1a7a5e", label: "💡 Tip" },
  STORY:     { bg: "#fff8e6", color: "#b8860b", label: "📖 Story" },
  GRATITUDE: { bg: "#fdf0e8", color: "#c4622d", label: "🙏 Gratitude" },
  QUESTION:  { bg: "#f0f4ff", color: "#4a5fa8", label: "❓ Question" },
};

const REACTIONS: { type: ReactionType; emoji: string }[] = [
  { type: "HEART", emoji: "❤️" },
  { type: "HUG",   emoji: "🤗" },
  { type: "CLAP",  emoji: "👏" },
];

function rankFromScore(score: number): string {
  if (score >= 95) return "🏆";
  if (score >= 85) return "🌟";
  if (score >= 75) return "👼";
  if (score >= 65) return "🏛️";
  if (score >= 55) return "🤝";
  if (score >= 40) return "💛";
  return "🌱";
}

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
  const [showReportMenu, setShowReportMenu] = useState(false);
  const cat = CATEGORY_STYLE[post.category];

  const handleReact = async (type: ReactionType) => {
    const prev = reactions.myReaction;
    // Optimistic update
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
    }).catch(() => {
      // Revert on error
      setReactions(post.reactions);
    });
  };

  const handleReport = async (reason: string) => {
    setShowReportMenu(false);
    await fetch(`/api/circles/posts/${post.id}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    setReported(true);
  };

  const displayName = post.author.circleDisplayName?.trim() || post.author.name.split(" ")[0];
  const displayIdentity = post.author.circleContext
    ? `${post.author.circleContext} • ${displayName}`
    : displayName;
  const isOwn = post.author.id === currentUserId;

  if (reported) {
    return (
      <div style={{ background: "var(--white)", borderRadius: 16, padding: "20px", marginBottom: 12, textAlign: "center", color: "var(--mid)", fontSize: 13 }}>
        ✅ Thank you — this post has been reported and is under review.
      </div>
    );
  }

  return (
    <div style={{ background: "var(--white)", borderRadius: 16, padding: "16px", marginBottom: 12, boxShadow: "var(--shadow)", border: "1px solid var(--border)", position: "relative" }}>
      {/* Pin indicator */}
      {post.isPinned && (
        <div style={{ position: "absolute", top: 12, right: 12, fontSize: 12, color: "var(--green)", fontWeight: 700 }}>📌 Pinned</div>
      )}

      {/* Author row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Avatar src={post.author.avatar} name={post.author.name} size={36} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>{displayIdentity}</span>
            {post.author.isLeader && (
              <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 20, background: "var(--green)", color: "white" }}>
                ⭐ Leader
              </span>
            )}
            <span style={{ fontSize: 12 }}>{rankFromScore(post.author.trustScore)}</span>
            {post.channelName && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "var(--bg)", color: "var(--mid)" }}>
                {post.channelEmoji} {post.channelName}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--mid)" }}>
            {post.author.countryFlag && <span style={{ marginRight: 3 }}>{post.author.countryFlag}</span>}
            {post.author.city ?? ""}
            {post.author.city ? " · " : ""}{timeAgo(post.createdAt)}
          </div>
          {post.author.subTags?.length > 0 && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
              {post.author.subTags.map((tag) => (
                <span key={tag} style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "var(--green-light)", color: "var(--green)" }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* Category pill */}
        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: cat.bg, color: cat.color, flexShrink: 0 }}>
          {cat.label}
        </span>
      </div>

      {/* Content */}
      <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink)", margin: "0 0 12px", whiteSpace: "pre-wrap" }}>
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

      {/* Action bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        {REACTIONS.map(({ type, emoji }) => (
          <button
            key={type}
            onClick={() => handleReact(type)}
            style={{
              display: "flex", alignItems: "center", gap: 4, padding: "5px 10px",
              borderRadius: 20, border: "1.5px solid",
              borderColor: reactions.myReaction === type ? "var(--green)" : "var(--border)",
              background: reactions.myReaction === type ? "var(--green-light)" : "transparent",
              cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "Nunito, sans-serif",
              color: reactions.myReaction === type ? "var(--green)" : "var(--mid)",
            }}
          >
            <span>{emoji}</span>
            {reactions[type] > 0 && <span>{reactions[type]}</span>}
          </button>
        ))}

        <button
          onClick={() => onOpenComments(post.id)}
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 20, border: "1.5px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}
        >
          💬 {post.commentCount > 0 ? post.commentCount : "Reply"}
        </button>

        {/* Context menu */}
        {!isOwn && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowReportMenu((p) => !p)}
              style={{ padding: "5px 8px", borderRadius: 20, border: "none", background: "transparent", cursor: "pointer", fontSize: 14, color: "var(--light)" }}
            >
              ···
            </button>
            {showReportMenu && (
              <div style={{ position: "absolute", right: 0, bottom: 32, background: "var(--white)", borderRadius: 12, boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)", padding: 8, zIndex: 50, minWidth: 180 }}>
                <div style={{ fontSize: 11, color: "var(--mid)", padding: "4px 10px", fontWeight: 700 }}>Report this post</div>
                {["It's asking for items/donations", "It's spam or irrelevant", "It's offensive or harmful", "Other"].map((r) => (
                  <button key={r} onClick={() => handleReport(r)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", fontSize: 12, color: "var(--ink)", background: "none", border: "none", cursor: "pointer", borderRadius: 8, fontFamily: "Nunito, sans-serif" }}>
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
              style={{ padding: "5px 8px", borderRadius: 20, border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--green)", fontWeight: 700, fontFamily: "Nunito, sans-serif" }}
            >
              {post.isPinned ? "Unpin" : "📌"}
            </button>
            <button
              onClick={() => onDelete(post.id)}
              style={{ padding: "5px 8px", borderRadius: 20, border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--terra)", fontWeight: 700, fontFamily: "Nunito, sans-serif" }}
            >
              ✕
            </button>
          </>
        )}
        {isOwn && (
          <button
            onClick={() => onDelete(post.id)}
            style={{ padding: "5px 8px", borderRadius: 20, border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--light)", fontFamily: "Nunito, sans-serif" }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
