"use client";

import { useState, useRef } from "react";
import Avatar from "./Avatar";
import {
  Lightbulb, BookOpen, HandHeart, HelpCircle, Trophy, Users,
  Camera, ChevronLeft, ArrowRight, type LucideIcon,
} from "lucide-react";

type Category = "TIP" | "STORY" | "GRATITUDE" | "QUESTION" | "SMALL_WIN" | "SUPPORT";

interface Channel { id: string; name: string; emoji: string; }

interface Props {
  circleId: string;
  userAvatar: string | null;
  userName: string;
  channels?: Channel[];
  activeChannelId?: string | null;
  onPosted: () => void;
}

const CATEGORIES: {
  value: Category;
  label: string;
  prompt: string;
  color: string;
  bg: string;
  Icon: LucideIcon;
}[] = [
  {
    value: "TIP",
    label: "Tip",
    prompt: "Share something that helped you — others here will thank you for it.",
    color: "#d97706", bg: "#fef3c7",
    Icon: Lightbulb,
  },
  {
    value: "STORY",
    label: "Story",
    prompt: "Tell a moment from your journey. Honest stories build real connection.",
    color: "#7c3aed", bg: "#f5f3ff",
    Icon: BookOpen,
  },
  {
    value: "GRATITUDE",
    label: "Gratitude",
    prompt: "What are you grateful for right now? Big or small — it all counts.",
    color: "#1a7a5e", bg: "#e8f5f1",
    Icon: HandHeart,
  },
  {
    value: "QUESTION",
    label: "Question",
    prompt: "Ask the circle anything. You'll get answers from women who've been there.",
    color: "#2563eb", bg: "#eff6ff",
    Icon: HelpCircle,
  },
  {
    value: "SMALL_WIN",
    label: "Small Win",
    prompt: "Celebrate a moment, however tiny. You deserve to be cheered on.",
    color: "#0891b2", bg: "#ecfeff",
    Icon: Trophy,
  },
  {
    value: "SUPPORT",
    label: "Support",
    prompt: "Reach out when you need it. This circle is here for you.",
    color: "#db2777", bg: "#fdf2f8",
    Icon: Users,
  },
];

export default function CircleComposer({ circleId, userAvatar, userName, channels = [], activeChannelId, onPosted }: Props) {
  const [step, setStep] = useState<"collapsed" | "category" | "write">("collapsed");
  const [category, setCategory] = useState<Category | null>(null);
  const [content, setContent] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(activeChannelId ?? null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedCat = CATEGORIES.find((c) => c.value === category);

  const reset = () => {
    setStep("collapsed");
    setCategory(null);
    setContent("");
    setPhoto(null);
    setPhotoPreview(null);
    setError(null);
  };

  const handlePhoto = (file: File) => {
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handlePost = async () => {
    if (!content.trim() || !category) { setError("Write something first."); return; }
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

    reset();
  };

  if (successMsg) {
    return (
      <div style={{ background: "var(--white)", borderRadius: 16, padding: "20px 16px", marginBottom: 16, boxShadow: "var(--shadow)", textAlign: "center", border: "1px solid var(--border)" }}>
        <div style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.6 }}>{successMsg}</div>
        <button onClick={() => setSuccessMsg(null)} style={{ marginTop: 12, fontSize: 12, color: "var(--green)", background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: "Nunito, sans-serif" }}>Got it</button>
      </div>
    );
  }

  // ── Collapsed ──────────────────────────────────────────────────────────────
  if (step === "collapsed") {
    return (
      <div style={{ background: "var(--white)", borderRadius: 16, padding: "12px 14px", marginBottom: 16, boxShadow: "var(--shadow)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }} onClick={() => setStep("category")}>
          <Avatar src={userAvatar} name={userName} size={34} />
          <div style={{ flex: 1, padding: "9px 14px", borderRadius: 24, background: "var(--bg)", cursor: "text", fontSize: 13, color: "var(--light)" }}>
            Share a tip, story, or question with your circle…
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: choose category ────────────────────────────────────────────────
  if (step === "category") {
    return (
      <div style={{ background: "var(--white)", borderRadius: 16, padding: "14px 16px", marginBottom: 16, boxShadow: "var(--shadow)", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
            <ChevronLeft size={18} color="var(--mid)" />
          </button>
          <div style={{ fontWeight: 800, fontSize: 14, fontFamily: "Nunito, sans-serif" }}>What would you like to share?</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => { setCategory(c.value); setStep("write"); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 12px",
                borderRadius: 12, border: `1.5px solid ${c.bg}`,
                background: c.bg, cursor: "pointer", textAlign: "left",
                fontFamily: "Nunito, sans-serif",
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <c.Icon size={16} color={c.color} strokeWidth={2} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: c.color }}>{c.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Step 2: write post ─────────────────────────────────────────────────────
  return (
    <div style={{ background: "var(--white)", borderRadius: 16, padding: "14px 16px", marginBottom: 16, boxShadow: "var(--shadow)", border: `1.5px solid ${selectedCat?.bg ?? "var(--border)"}` }}>
      {/* Header with category indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setStep("category")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
          <ChevronLeft size={18} color="var(--mid)" />
        </button>
        <div style={{
          display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20,
          background: selectedCat?.bg, color: selectedCat?.color, fontSize: 12, fontWeight: 800,
        }}>
          {selectedCat && <selectedCat.Icon size={12} strokeWidth={2} />}
          {selectedCat?.label}
        </div>
        <Avatar src={userAvatar} name={userName} size={26} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{userName.split(" ")[0]}</span>
      </div>

      {/* Prompt */}
      {selectedCat && (
        <div style={{ fontSize: 12, color: "var(--mid)", marginBottom: 10, lineHeight: 1.5, fontStyle: "italic" }}>
          {selectedCat.prompt}
        </div>
      )}

      {/* Channel selector */}
      {channels.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setSelectedChannelId(selectedChannelId === ch.id ? null : ch.id)}
                style={{
                  padding: "4px 11px", borderRadius: 20, border: "1.5px solid",
                  borderColor: selectedChannelId === ch.id ? "var(--green)" : "var(--border)",
                  background: selectedChannelId === ch.id ? "var(--green-light)" : "transparent",
                  color: selectedChannelId === ch.id ? "var(--green)" : "var(--mid)",
                  fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif",
                }}
              >
                {ch.emoji} {ch.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Textarea */}
      <textarea
        autoFocus
        value={content}
        onChange={(e) => { setContent(e.target.value.slice(0, 500)); setError(null); }}
        placeholder="Reply with kindness…"
        rows={4}
        style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1.5px solid var(--border)", fontSize: 14, fontFamily: "Nunito, sans-serif", resize: "none", boxSizing: "border-box", outline: "none", lineHeight: 1.6 }}
      />
      <div style={{ fontSize: 11, color: content.length > 460 ? "var(--terra)" : "var(--light)", textAlign: "right", marginBottom: 8 }}>
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
        <div style={{ fontSize: 12, color: "var(--terra)", background: "#fef2f2", padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* Bottom bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
        <button onClick={() => fileRef.current?.click()}
          style={{ padding: "7px 10px", borderRadius: 20, border: "1.5px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex" }}>
          <Camera size={15} color="var(--mid)" />
        </button>
        <button onClick={reset}
          style={{ padding: "7px 14px", borderRadius: 20, border: "1.5px solid var(--border)", background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
          Cancel
        </button>
        <button onClick={handlePost} disabled={posting || !content.trim()}
          className="btn-primary"
          style={{ marginLeft: "auto", padding: "7px 20px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          {posting ? "Posting…" : <><span>Post</span><ArrowRight size={13} /></>}
        </button>
      </div>
    </div>
  );
}
