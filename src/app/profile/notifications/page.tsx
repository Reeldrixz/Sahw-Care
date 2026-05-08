"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import Toast from "@/components/Toast";

interface NotifPrefs {
  notifyNewPosts: boolean;
  notifyReplies: boolean;
  notifyThreadReplies: boolean;
  notifyBundleUpdates: boolean;
  notifyVerification: boolean;
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button onClick={onToggle} aria-label={`Toggle ${label}`} style={{
      width: 44, height: 24, borderRadius: 12, border: "none",
      background: on ? "#1a7a5e" : "var(--border)",
      position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
    }}>
      <span style={{
        position: "absolute", top: 2,
        left: on ? 22 : 2, width: 20, height: 20, borderRadius: "50%",
        background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const [prefs,   setPrefs]   = useState<NotifPrefs | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/notifications/preferences")
      .then(r => r.json())
      .then(d => { setPrefs(d.prefs ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  const toggle = async (key: keyof NotifPrefs) => {
    if (!prefs) return;
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    setSaving(true);
    await fetch("/api/notifications/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: updated[key] }),
    });
    setSaving(false);
    setToast("Saved");
  };

  const isDonor = user?.journeyType === "donor";

  const allPrefs: { key: keyof NotifPrefs; label: string; desc: string; donorOnly?: boolean; recipientOnly?: boolean }[] = [
    { key: "notifyNewPosts",      label: "New posts in my circle",    desc: "When someone posts in your circle",            recipientOnly: true },
    { key: "notifyReplies",       label: "Replies to my posts",       desc: "When someone replies to your post"                                 },
    { key: "notifyThreadReplies", label: "Thread replies",            desc: "When someone replies in a thread you joined",  recipientOnly: true },
    { key: "notifyBundleUpdates", label: "Bundle updates",            desc: "When a bundle you contributed to is dispatched", donorOnly: true   },
    { key: "notifyVerification",  label: "Verification updates",      desc: "When your document review status changes",     recipientOnly: true },
  ];

  const visible = allPrefs.filter(p => {
    if (p.donorOnly    && !isDonor) return false;
    if (p.recipientOnly && isDonor) return false;
    return true;
  });

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 80 }}>
      <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "20px 16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}
          >
            <ArrowLeft size={16} strokeWidth={2} color="white" />
          </button>
          <div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "white" }}>Notifications</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>Manage your preferences</div>
          </div>
          {saving && <div style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.7)" }}>Saving…</div>}
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}><div className="spinner" /></div>
        ) : !prefs ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--mid)", fontSize: 13 }}>Could not load preferences.</div>
        ) : (
          <div style={{ background: "white", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)" }}>
            {visible.map(({ key, label, desc }, i) => (
              <div
                key={key}
                style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "16px",
                  borderBottom: i < visible.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", fontFamily: "Nunito, sans-serif" }}>{label}</div>
                  <div style={{ fontSize: 11, color: "var(--mid)", marginTop: 2 }}>{desc}</div>
                </div>
                <Toggle on={prefs[key]} onToggle={() => toggle(key)} label={label} />
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
