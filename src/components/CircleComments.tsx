"use client";

import { useEffect, useState, useRef } from "react";
import Avatar from "./Avatar";

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

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--white)", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 430, maxHeight: "80vh", display: "flex", flexDirection: "column", animation: "sheetUp 0.3s ease" }}>
        {/* Handle + header */}
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 4, margin: "0 auto 14px" }} />
          <div style={{ fontWeight: 800, fontSize: 16 }}>Replies</div>
        </div>

        {/* Comments list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--mid)" }}>Loading…</div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--mid)", fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
              No replies yet — be the first!
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <Avatar src={c.author.avatar} name={c.author.name} size={30} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: c.identityLabel ? 1 : 3 }}>
                    {c.author.countryFlag && <span style={{ fontSize: 13 }}>{c.author.countryFlag}</span>}
                    <span style={{ fontSize: 13, fontWeight: 800 }}>
                      {(() => {
                        const n = c.author.circleDisplayName?.trim() || c.author.name.split(" ")[0];
                        return c.author.circleContext ? `${c.author.circleContext} • ${n}` : n;
                      })()}
                    </span>
                    {c.author.city && <span style={{ fontSize: 11, color: "var(--mid)" }}>{c.author.city}</span>}
                    <span style={{ fontSize: 11, color: "var(--light)", marginLeft: "auto" }}>{timeAgo(c.createdAt)}</span>
                  </div>
                  {c.identityLabel && (
                    <div style={{ fontSize: 11, color: "var(--mid)", fontStyle: "italic", marginBottom: 4 }}>
                      {c.identityLabel}
                    </div>
                  )}
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink)", background: "var(--bg)", padding: "8px 12px", borderRadius: "4px 12px 12px 12px" }}>
                    {c.content}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Compose */}
        <div style={{ padding: "12px 16px 28px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, flexShrink: 0 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 300))}
            placeholder="Write a kind reply…"
            rows={2}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", resize: "none", outline: "none" }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          />
          <button
            onClick={handleSubmit}
            disabled={posting || !text.trim()}
            style={{ alignSelf: "flex-end", padding: "10px 16px", borderRadius: 12, border: "none", background: "var(--green)", color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif", opacity: !text.trim() ? 0.5 : 1 }}
          >
            {posting ? "…" : "→"}
          </button>
        </div>
      </div>
    </div>
  );
}
