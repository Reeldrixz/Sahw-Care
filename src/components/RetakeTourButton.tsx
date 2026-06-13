"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Compass } from "lucide-react";

// Re-launches the register guided tour: finds the mother's register and
// navigates to it with ?tour=1, which forces the tour to run again.
export default function RetakeTourButton() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!user) return null;

  const handle = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/registers?creatorId=${user.id}`);
      const d = await res.json();
      const regs = d.registers ?? [];
      if (!regs.length) {
        setMsg("Create your register first — then you can take the tour.");
        setLoading(false);
        return;
      }
      router.push(`/registers/${regs[0].id}?tour=1`);
    } catch {
      setMsg("Couldn't start the tour just now. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "white", borderRadius: 16, padding: "16px", marginBottom: 12, border: "1px solid var(--border)" }}>
      <button
        onClick={handle}
        disabled={loading}
        style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0, opacity: loading ? 0.6 : 1 }}
      >
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Compass size={18} color="#1a7a5e" strokeWidth={1.75} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
            {loading ? "Starting the tour…" : "Take the tour again"}
          </div>
          <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginTop: 2 }}>
            A gentle walkthrough of your register.
          </div>
        </div>
      </button>
      {msg && (
        <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginTop: 10, lineHeight: 1.5 }}>{msg}</div>
      )}
    </div>
  );
}
