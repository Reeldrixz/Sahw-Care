"use client";

import { useState, useRef } from "react";
import Avatar from "./Avatar";

type Category = "TIP" | "STORY" | "GRATITUDE" | "QUESTION";

interface Channel { id: string; name: string; emoji: string; }

interface Props {
  circleId: string;
  userAvatar: string | null;
  userName: string;
  channels?: Channel[];
  activeChannelId?: string | null;
  onPosted: () => void;
}

const CATEGORIES: { value: Category; label: string; desc: string }[] = [
  { value: "TIP",       label: "💡 Tip",       desc: "Share something useful" },
  { value: "STORY",     label: "📖 Story",     desc: "Tell your experience" },
  { value: "GRATITUDE", label: "🙏 Gratitude", desc: "Share your thanks" },
  { value: "QUESTION",  label: "❓ Question",  desc: "Ask the circle" },
];

export default function CircleComposer({ circleId, userAvatar, userName, channels = [], activeChannelId, onPosted }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<Category>("STORY");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(activeChannelId ?? null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = (file: File) => {
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handlePost = async () => {
    if (!content.trim()) { setError("Write something first!"); return; }
    setPosting(true);
    setError(null);

    const fd = new FormData();
    fd.append("content", content.trim());
    fd.append("category", category);
    if (selectedChannelId) fd.append("channelId", selectedChannelId);
    if (photo) fd.append("photo", photo);

    const res = await fetch(`/api/circles/${circleId}/posts`, { method: "POST", body: fd });
    const data = await res.json();
    setPosting(false);

    if (!res.ok) { setError(data.error ?? "Failed to post"); return; }

    if (data.flagged) {
      setSuccessMsg(data.message);
    } else {
      onPosted();
    }

    setContent("");
    setCategory("STORY");
    setPhoto(null);
    setPhotoPreview(null);
    setExpanded(false);
  };

  if (successMsg) {
    return (
      <div style={{ background: "var(--white)", borderRadius: 16, padding: "16px", marginBottom: 16, boxShadow: "var(--shadow)", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
        <div style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.5 }}>{successMsg}</div>
        <button onClick={() => setSuccessMsg(null)} style={{ marginTop: 12, fontSize: 12, color: "var(--green)", background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: "Nunito, sans-serif" }}>Got it</button>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--white)", borderRadius: 16, padding: "14px 16px", marginBottom: 16, boxShadow: "var(--shadow)", border: "1px solid var(--border)" }}>
      {/* Collapsed state */}
      {!expanded ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }} onClick={() => setExpanded(true)}>
          <Avatar src={userAvatar} name={userName} size={36} />
          <div style={{ flex: 1, padding: "10px 14px", borderRadius: 24, background: "var(--bg)", cursor: "text", fontSize: 13, color: "var(--light)" }}>
            What's on your mind? Share a tip, story or gratitude…
          </div>
        </div>
      ) : (
        <>
          {/* Author row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Avatar src={userAvatar} name={userName} size={36} />
            <div style={{ fontSize: 13, fontWeight: 700 }}>{userName.split(" ")[0]}</div>
          </div>

          {/* Channel selector (cohort circles only) */}
          {channels.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--mid)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Post in</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {channels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedChannelId(selectedChannelId === ch.id ? null : ch.id)}
                    style={{
                      padding: "5px 12px", borderRadius: 20, border: "1.5px solid",
                      borderColor: selectedChannelId === ch.id ? "var(--green)" : "var(--border)",
                      background: selectedChannelId === ch.id ? "var(--green-light)" : "transparent",
                      color: selectedChannelId === ch.id ? "var(--green)" : "var(--mid)",
                      fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif",
                    }}
                  >
                    {ch.emoji} {ch.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category selector */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                style={{
                  padding: "5px 12px", borderRadius: 20, border: "1.5px solid",
                  borderColor: category === c.value ? "var(--green)" : "var(--border)",
                  background: category === c.value ? "var(--green-light)" : "transparent",
                  color: category === c.value ? "var(--green)" : "var(--mid)",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            autoFocus
            value={content}
            onChange={(e) => { setContent(e.target.value.slice(0, 500)); setError(null); }}
            placeholder={`Share a ${CATEGORIES.find(c => c.value === category)?.desc.toLowerCase()}…`}
            rows={4}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1.5px solid var(--border)", fontSize: 14, fontFamily: "Nunito, sans-serif", resize: "none", boxSizing: "border-box", outline: "none", lineHeight: 1.6 }}
          />
          <div style={{ fontSize: 11, color: content.length > 460 ? "var(--terra)" : "var(--light)", textAlign: "right", marginBottom: 10 }}>
            {content.length}/500
          </div>

          {/* Photo preview */}
          {photoPreview && (
            <div style={{ position: "relative", marginBottom: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoPreview} alt="Preview" style={{ width: "100%", borderRadius: 12, maxHeight: 200, objectFit: "cover" }} />
              <button onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", color: "white", width: 24, height: 24, cursor: "pointer", fontSize: 12 }}>
                ✕
              </button>
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: "var(--terra)", background: "var(--terra-light)", padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* Bottom bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()}
              style={{ padding: "8px 12px", borderRadius: 20, border: "1.5px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--mid)" }}>
              📷
            </button>
            <button onClick={() => { setExpanded(false); setContent(""); setPhoto(null); setPhotoPreview(null); setError(null); }}
              style={{ padding: "8px 14px", borderRadius: 20, border: "1.5px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
              Cancel
            </button>
            <button onClick={handlePost} disabled={posting || !content.trim()}
              className="btn-primary"
              style={{ marginLeft: "auto", padding: "8px 20px", fontSize: 13 }}>
              {posting ? "Posting…" : "Post →"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
