"use client";

import { useEffect, useState, useRef } from "react";
import Avatar from "./Avatar";
import { Send, MessageCircle } from "lucide-react";

interface Comment {
  id: string;
  content: string;
  identityLabel: string | null;
  createdAt: string;
  author: { id: string; name: string; avatar: string | null; city: string | null; countryFlag: string | null; circleContext: string | null; circleDisplayName: string | null };
}

interface Props {
  postId: string;
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function CircleComments({ postId, onClose }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/circles/posts/${postId}/comments`)
      .then((r) => r.json())
      .then((d) => { setComments(d.comments ?? []); setLoading(false); });
  }, [postId]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setPosting(true);
    const res = await fetch(`/api/circles/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text.trim() }),
    });
    if (res.ok) {
      const d = await res.json();
      setComments((p) => [...p, d.comment]);
      setText("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
    setPosting(false);
  };

  const handleTextChange = (val: string) => {
    setText(val.slice(0, 300));
    // Nudge to be kind if reply is getting long
    setShowNudge(val.length > 60 && val.length <= 62);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--white)", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 430, maxHeight: "82vh", display: "flex", flexDirection: "column", animation: "sheetUp 0.3s ease" }}>
        {/* Handle + header */}
        <div style={{ padding: "14px 20px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: "var(--border)", borderRadius: 4, margin: "0 auto 12px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <MessageCircle size={16} color="var(--green)" strokeWidth={2} />
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              {loading ? "Replies" : `${comments.length === 0 ? "No" : comments.length} ${comments.length === 1 ? "reply" : "replies"}`}
            </div>
          </div>
        </div>

        {/* Comments list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--mid)" }}>Loading…</div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 20px", color: "var(--mid)" }}>
              <div style={{ fontSize: 13, marginBottom: 6, fontWeight: 700 }}>Be the first to reply</div>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>A kind word can mean more than you know.</div>
            </div>
          ) : (
            comments.map((c) => {
              const name = c.author.circleDisplayName?.trim() || c.author.name.split(" ")[0];
              const identity = c.author.circleContext ? `${c.author.circleContext} · ${name}` : name;
              return (
                <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                  <Avatar src={c.author.avatar} name={c.author.name} size={28} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                      {c.author.countryFlag && <span style={{ fontSize: 12 }}>{c.author.countryFlag}</span>}
                      <span style={{ fontSize: 13, fontWeight: 800 }}>{identity}</span>
                      {c.author.city && <span style={{ fontSize: 11, color: "var(--mid)" }}>{c.author.city}</span>}
                      <span style={{ fontSize: 11, color: "var(--light)", marginLeft: "auto" }}>{timeAgo(c.createdAt)}</span>
                    </div>
                    {c.identityLabel && (
                      <div style={{ fontSize: 11, color: "var(--mid)", fontStyle: "italic", marginBottom: 4 }}>
                        {c.identityLabel}
                      </div>
                    )}
                    <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ink)", background: "var(--bg)", padding: "9px 12px", borderRadius: "4px 14px 14px 14px" }}>
                      {c.content}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Advice nudge */}
        {showNudge && (
          <div style={{ padding: "8px 16px", background: "#e8f5f1", fontSize: 12, color: "#1a7a5e", lineHeight: 1.5 }}>
            Advice is most helpful when it comes with warmth. You've got this.
          </div>
        )}

        {/* Compose */}
        <div style={{ padding: "10px 14px 28px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "flex-end", flexShrink: 0 }}>
          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Reply with kindness…"
            rows={2}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 14, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", resize: "none", outline: "none", lineHeight: 1.5 }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          />
          <button
            onClick={handleSubmit}
            disabled={posting || !text.trim()}
            style={{ padding: "10px", borderRadius: 12, border: "none", background: "var(--green)", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: !text.trim() ? 0.5 : 1, flexShrink: 0 }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
