"use client";

import { ShieldCheck, Package, Lock, ExternalLink, Heart } from "lucide-react";
import Link from "next/link";

const COLUMNS = [
  {
    icon: ShieldCheck,
    title: "Verified Mothers",
    desc: "Every mother is personally verified before her register is published.",
  },
  {
    icon: Package,
    title: "Kradel Delivers",
    desc: "We handle purchasing and delivery. Givers never share addresses.",
  },
  {
    icon: Lock,
    title: "Secure Payments",
    desc: "Your payment is safe and encrypted. We never store your card details.",
  },
];

// Only rendered on register surfaces (/registers and /registers/[id]).
// The "donors never share addresses" copy is accurate there because Kradel
// handles all purchasing and delivery. Do NOT add this component to Discover
// surfaces where donors arrange their own delivery — the copy would be wrong.
export default function TrustAndSafety() {
  return (
    <div style={{ margin: "0 16px", padding: "24px", background: "var(--white)", borderRadius: 16, border: "1px solid #e0e0e0" }}>
      <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, marginBottom: 20, color: "var(--ink)" }}>
        Trust &amp; Safety
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        {COLUMNS.map(({ icon: Icon, title, desc }) => (
          <div key={title} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <Icon size={24} color="#1a7a5e" strokeWidth={1.75} />
            </div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "#1a7a5e", marginBottom: 4 }}>
              {title}
            </div>
            <div style={{ fontSize: 12, color: "#555555", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>
              {desc}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <Link
          href="/privacy"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontFamily: "Nunito, sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: "#1a7a5e",
            textDecoration: "none",
          }}
        >
          Read our full Privacy Policy
          <ExternalLink size={14} strokeWidth={1.75} />
        </Link>
        <Link
          href="/support"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontFamily: "Nunito, sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: "#1a7a5e",
            textDecoration: "none",
          }}
        >
          <Heart size={14} strokeWidth={1.75} />
          Support Kradel →
        </Link>
      </div>
    </div>
  );
}
