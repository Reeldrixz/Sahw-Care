"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface ImpactStats {
  donations: number;
  families: number;
  babiesFed: number;
  rank: { label: string; emoji: string; next: string | null; nextAt: number | null };
}

interface Props {
  onClose: () => void;
}

const APP_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL ?? "https://kradel.app";

export default function ShareImpactModal({ onClose }: Props) {
  const { user } = useAuth();
  const [stats, setStats] = useState<ImpactStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/user/impact")
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); });
  }, []);

  if (!user) return null;

  const cardUrl = `${APP_URL}/api/og/impact?userId=${user.id}&name=${encodeURIComponent(user.name)}`;
  const profileUrl = `${APP_URL}/donors/${user.id}`;
  const firstName = user.name.split(" ")[0];

  const shareText = stats?.donations
    ? `I've helped ${stats.families} ${stats.families === 1 ? "family" : "families"} through Kradəl 💛 ${stats.donations} donation${stats.donations !== 1 ? "s" : ""} and counting. Every baby deserves support. Join me:`
    : `I just joined Kradəl 💛 — a community helping mothers and babies get essentials they need. Join us:`;

  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(profileUrl);

  const platforms = [
    {
      id: "twitter",
      label: "Twitter / X",
      color: "#000",
      icon: "𝕏",
      action: () => window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, "_blank"),
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      color: "#25D366",
      icon: "💬",
      action: () => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + profileUrl)}`, "_blank"),
    },
    {
      id: "facebook",
      label: "Facebook",
      color: "#1877F2",
      icon: "f",
      action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`, "_blank"),
    },
    {
      id: "copy",
      label: copied ? "Copied!" : "Copy link",
      color: "var(--green)",
      icon: copied ? "✓" : "🔗",
      action: async () => {
        await navigator.clipboard.writeText(`${shareText} ${profileUrl}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      },
    },
  ];

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(cardUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kradel-impact-${firstName.toLowerCase()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // fallback: open in new tab
      window.open(cardUrl, "_blank");
    }
    setDownloading(false);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 400,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--white)", borderRadius: 20, width: "100%", maxWidth: 440,
        overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)",
          padding: "20px 20px 16px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ color: "#7ec8a4", fontSize: 12, fontWeight: 700, marginBottom: 2 }}>YOUR IMPACT</div>
            <div style={{ color: "white", fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700 }}>
              Share your story 💛
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.15)", border: "none", color: "white",
            width: 32, height: 32, borderRadius: "50%", fontSize: 16, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Nunito, sans-serif",
          }}>✕</button>
        </div>

        <div style={{ padding: "20px 20px 24px" }}>
          {/* Stats summary */}
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
              <div className="spinner" />
            </div>
          ) : stats && (
            <div style={{
              display: "flex", gap: 10, marginBottom: 20,
              background: "var(--bg)", borderRadius: 14, padding: "14px 16px",
            }}>
              {[
                { v: stats.donations, l: "donations" },
                { v: stats.families, l: "families" },
                { v: stats.babiesFed, l: "babies fed" },
              ].map(({ v, l }) => (
                <div key={l} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "var(--green)" }}>{v}</div>
                  <div style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600 }}>{l}</div>
                </div>
              ))}
            </div>
          )}

          {/* Card preview */}
          <div style={{ borderRadius: 14, overflow: "hidden", marginBottom: 20, boxShadow: "var(--shadow)", position: "relative", aspectRatio: "1 / 1", background: "#0d3d2e" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardUrl}
              alt="Your impact card"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>

          {/* Instagram note */}
          <div style={{
            background: "var(--green-light)", borderRadius: 10, padding: "10px 14px",
            fontSize: 12, color: "var(--green)", fontWeight: 600, marginBottom: 16,
          }}>
            📸 For Instagram Stories: download the card and share it from your camera roll.
          </div>

          {/* Share buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {platforms.map((p) => (
              <button
                key={p.id}
                onClick={p.action}
                style={{
                  padding: "12px 10px",
                  borderRadius: 12,
                  border: "none",
                  background: p.id === "copy" && copied ? "var(--green-light)" : p.id === "copy" ? "var(--bg)" : p.color,
                  color: p.id === "copy" ? (copied ? "var(--green)" : "var(--ink)") : "white",
                  fontSize: 13, fontWeight: 800, cursor: "pointer",
                  fontFamily: "Nunito, sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  transition: "opacity 0.15s",
                }}
              >
                <span style={{ fontSize: 16 }}>{p.icon}</span>
                {p.label}
              </button>
            ))}
          </div>

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{
              width: "100%", padding: "13px",
              borderRadius: 12, border: "1.5px solid var(--border)",
              background: "var(--white)", color: "var(--ink)",
              fontSize: 14, fontWeight: 800, cursor: "pointer",
              fontFamily: "Nunito, sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {downloading ? (
              <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Downloading…</>
            ) : (
              <>⬇ Download PNG (for Instagram / WhatsApp status)</>
            )}
          </button>

          {/* Next rank nudge */}
          {stats?.rank.next && stats.rank.nextAt !== null && (
            <div style={{
              marginTop: 14, fontSize: 12, color: "var(--mid)", textAlign: "center",
              fontWeight: 600, lineHeight: 1.5,
            }}>
              {stats.rank.nextAt - stats.donations === 1
                ? `1 more donation and you'll become a ${stats.rank.next} ${stats.donations >= 10 ? "🌟" : "💛"}`
                : `${stats.rank.nextAt - stats.donations} more donations to become a ${stats.rank.next}`
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
