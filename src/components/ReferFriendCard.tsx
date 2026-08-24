"use client";

import { useState } from "react";
import { Share2, Check, HeartHandshake } from "lucide-react";

export default function ReferFriendCard() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/find-help`;
    const shareData = {
      title: "Kradel",
      text: "A friend thought Kradel could help. Here's how to get connected to support for you and your baby.",
      url,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share(shareData); return; } catch { /* dismissed — fall through */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div style={{ background: "white", borderRadius: 16, padding: "16px", marginBottom: 12, border: "1px solid var(--border)", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <HeartHandshake size={18} color="#1a7a5e" strokeWidth={1.75} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
          Know someone who could use Kradel?
        </div>
        <div style={{ fontSize: 12.5, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.55, marginBottom: 12 }}>
          Share a link that points a friend toward our community partners. They&apos;ll help her get connected.
        </div>
        <button
          onClick={handleShare}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--green)", border: "none", color: "white", borderRadius: 20, padding: "8px 16px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
        >
          {copied ? <><Check size={13} strokeWidth={2.5} /> Link copied</> : <><Share2 size={13} strokeWidth={2.25} /> Share Kradel</>}
        </button>
      </div>
    </div>
  );
}
