"use client";

import { useState, useEffect, useRef } from "react";
import { Camera, Check, Download, Leaf, Link, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ImpactCard, { type ImpactVariant, type ImpactStats } from "./ImpactCard";

interface ImpactData {
  variant:  ImpactVariant;
  stats:    ImpactStats;
  location: string | null;
  month:    string;
}

interface Props {
  onClose: () => void;
}

const SHARE_TEXT: Record<ImpactVariant, (name: string, s: ImpactStats) => string> = {
  discover: (n, s) => `I've shared essentials with ${s.mothersSupported} ${s.mothersSupported === 1 ? "mother" : "mothers"} through Kradəl Discover 💛 Every mother deserves support. Join me:`,
  register: (n, s) => `I've helped meet ${s.needsMet} essential ${s.needsMet === 1 ? "need" : "needs"} for mothers through Kradəl Register 💛 Join me:`,
  combined: (n, s) => `I've supported ${s.mothersSupported} mothers through Kradəl 💛 — ${s.essentialsShared} essentials shared across Discover and Register. Join me:`,
  none:     ()     => `I just joined Kradəl 💛 — a community helping mothers get the essentials they need. Join us:`,
};

const VARIANT_LABEL: Record<ImpactVariant, string> = {
  discover: "Discover impact card",
  register: "Register impact card",
  combined: "Discover & Register impact card",
  none:     "",
};

export default function ShareImpactModal({ onClose }: Props) {
  const { user } = useAuth();
  const cardRef  = useRef<HTMLDivElement>(null);

  const [data,        setData]        = useState<ImpactData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [copied,      setCopied]      = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch("/api/profile/impact-share")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!user) return null;

  const profileUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/donors/${user.id}`;
  const firstName  = user.name.split(" ")[0];
  const showCard   = data !== null && data.variant !== "none";

  const shareText = data
    ? SHARE_TEXT[data.variant](firstName, data.stats)
    : `I'm supporting mothers through Kradel 💛 Join us:`;

  const platforms = [
    {
      id:     "twitter",
      label:  "Twitter / X",
      color:  "#000",
      icon:   <span style={{ fontFamily: "serif", fontWeight: 900, fontSize: 13 }}>𝕏</span>,
      action: () => window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(profileUrl)}`,
        "_blank",
      ),
    },
    {
      id:     "whatsapp",
      label:  "WhatsApp",
      color:  "#25D366",
      icon:   <MessageCircle size={15} />,
      action: () => window.open(
        `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + profileUrl)}`,
        "_blank",
      ),
    },
    {
      id:     "facebook",
      label:  "Facebook",
      color:  "#1877F2",
      icon:   <span style={{ fontWeight: 800, fontSize: 15 }}>f</span>,
      action: () => window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}&quote=${encodeURIComponent(shareText)}`,
        "_blank",
      ),
    },
    {
      id:     "copy",
      label:  copied ? "Copied!" : "Copy link",
      color:  "var(--green)",
      icon:   copied ? <Check size={15} /> : <Link size={15} />,
      action: async () => {
        await navigator.clipboard.writeText(`${shareText} ${profileUrl}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      },
    },
  ];

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const { toPng } = await import("html-to-image");
      // Two-pass: warms the font cache so Lora/Nunito render on the second capture
      await toPng(cardRef.current, { pixelRatio: 3 });
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 3 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `kradel-impact-${firstName.toLowerCase()}.png`;
      a.click();
    } catch {
      // fallback: nothing — card preview is still visible
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 400,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--white)", borderRadius: 24, width: "100%", maxWidth: 420,
        overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
        maxHeight: "92vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)",
          padding: "18px 20px 16px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ color: "#7ec8a4", fontSize: 11, fontWeight: 800, letterSpacing: "1px", marginBottom: 3 }}>
              YOUR IMPACT
            </div>
            <div style={{ color: "white", fontFamily: "Lora, serif", fontSize: 19, fontWeight: 700, lineHeight: 1.2 }}>
              Share your care story
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.15)", border: "none", color: "white",
            width: 32, height: 32, borderRadius: "50%", fontSize: 16, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>

        <div style={{ padding: "20px 20px 28px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <div className="spinner" />
            </div>
          ) : !showCard ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
                <Leaf size={36} color="var(--mid)" />
              </div>
              <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
                Your card is almost ready
              </div>
              <div style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.65 }}>
                Complete your first Discover listing or Register commitment to unlock your personalised impact card.
              </div>
            </div>
          ) : (
            <>
              {/* Variant badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "var(--bg)", borderRadius: 20, padding: "4px 12px",
                fontSize: 11, fontWeight: 800, color: "var(--mid)",
                marginBottom: 14,
              }}>
                {VARIANT_LABEL[data.variant]}
              </div>

              {/* Card preview */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
                <ImpactCard
                  ref={cardRef}
                  variant={data.variant}
                  stats={data.stats}
                  name={user.name}
                  location={data.location}
                  month={data.month}
                />
              </div>

              {/* Camera-roll note */}
              <div style={{
                background: "var(--green-light)", borderRadius: 10, padding: "9px 13px",
                fontSize: 12, color: "var(--green)", fontWeight: 600, marginBottom: 16,
                display: "flex", alignItems: "center", gap: 7,
              }}>
                <Camera size={13} style={{ flexShrink: 0 }} />
                Download and share directly from your camera roll — works on Instagram, WhatsApp, and Facebook.
              </div>

              {/* Social share buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                {platforms.map(p => (
                  <button
                    key={p.id}
                    onClick={p.action}
                    style={{
                      padding: "11px 10px", borderRadius: 12, border: "none",
                      background:
                        p.id === "copy" && copied ? "var(--green-light)"
                        : p.id === "copy"          ? "var(--bg)"
                        : p.color,
                      color: p.id === "copy" ? (copied ? "var(--green)" : "var(--ink)") : "white",
                      fontSize: 13, fontWeight: 800, cursor: "pointer",
                      fontFamily: "Nunito, sans-serif",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      transition: "opacity 0.15s",
                    }}
                  >
                    {p.icon}
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Download button */}
              <button
                onClick={handleDownload}
                disabled={downloading}
                style={{
                  width: "100%", padding: "12px", borderRadius: 12,
                  border: "1.5px solid var(--border)", background: "var(--white)",
                  color: "var(--ink)", fontSize: 14, fontWeight: 800, cursor: "pointer",
                  fontFamily: "Nunito, sans-serif",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  opacity: downloading ? 0.7 : 1,
                }}
              >
                {downloading
                  ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Downloading…</>
                  : <><Download size={16} /> Download (1080×1080)</>
                }
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
