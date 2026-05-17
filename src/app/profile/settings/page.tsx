"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, User, Bell, Compass, Shield, HelpCircle, Info, LogOut, Trash2, ChevronRight, Bug } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import Toast from "@/components/Toast";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  const isAdmin = user.role === "ADMIN";

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/user/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      if (res.ok) { window.location.href = "/"; }
      else { const d = await res.json(); setToast(d.error ?? "Something went wrong"); setDeleting(false); }
    } catch { setToast("Something went wrong"); setDeleting(false); }
  };

  const sections = [
    {
      items: [
        { icon: User,    label: "Account details",       sub: "Phone, email & verification",         path: "/profile/account" },
        { icon: Bell,    label: "Notifications",          sub: "Manage your notification preferences", path: "/profile/notifications" },
        ...(!isAdmin ? [{ icon: Compass, label: "My Journey", sub: "Update your journey type", path: "/profile/journey" }] : []),
      ],
    },
    {
      items: [
        { icon: Shield,      label: "Privacy",         sub: "Data and privacy settings",    path: null },
        { icon: HelpCircle,  label: "Help & Support",  sub: "Get help or contact us",       path: null },
        { icon: Bug,         label: "Report a bug",    sub: "Something broken? Let us know", path: `/report-bug?from=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "/profile/settings")}` },
        { icon: Info,        label: "About Kradəl",    sub: "Version, terms & policies",    path: null },
      ],
    },
  ];

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "20px 16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}
          >
            <ArrowLeft size={16} strokeWidth={2} color="white" />
          </button>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "white" }}>Settings</div>
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {sections.map((section, si) => (
          <div key={si} style={{ background: "white", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 12 }}>
            {section.items.map(({ icon: Icon, label, sub, path }, i) => (
              <button
                key={label}
                onClick={() => path && router.push(path)}
                disabled={!path}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  width: "100%", padding: "14px 16px",
                  borderBottom: i < section.items.length - 1 ? "1px solid var(--border)" : "none",
                  background: "none", border: "none", borderTop: "none",
                  cursor: path ? "pointer" : "default", textAlign: "left",
                  opacity: path ? 1 : 0.5,
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={17} color="#1a7a5e" strokeWidth={1.75} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", fontFamily: "Nunito, sans-serif" }}>{label}</div>
                  <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>{sub}</div>
                </div>
                {path && <ChevronRight size={16} color="#9ca3af" />}
              </button>
            ))}
          </div>
        ))}

        {/* Sign out */}
        <button
          onClick={handleLogout}
          style={{ width: "100%", padding: "14px", borderRadius: 14, border: "1.5px solid var(--border)", background: "white", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}
        >
          <LogOut size={16} strokeWidth={2} />
          Sign out
        </button>

        {/* Delete account */}
        <button
          onClick={() => { setDeleteConfirmText(""); setShowDeleteModal(true); }}
          style={{ width: "100%", padding: "14px", borderRadius: 14, border: "1.5px solid #fca5a5", background: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Trash2 size={16} strokeWidth={2} />
          Delete account
        </button>
      </div>

      {/* Delete modal */}
      {showDeleteModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) setShowDeleteModal(false); }}>
          <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 400, padding: "28px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>⚠️</div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, textAlign: "center", marginBottom: 10 }}>Delete your account?</div>
            <p style={{ fontSize: 13, color: "var(--mid)", textAlign: "center", lineHeight: 1.6, marginBottom: 20 }}>
              This will permanently delete your profile, listings, and all your data. This cannot be undone.
            </p>
            <div style={{ background: "#fef2f2", borderRadius: 12, padding: "12px 14px", marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>Type <strong>DELETE</strong> to confirm</div>
              <input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE" disabled={deleting}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${deleteConfirmText === "DELETE" ? "#dc2626" : "var(--border)"}`, fontSize: 14, fontFamily: "Nunito, sans-serif", outline: "none", background: "white", boxSizing: "border-box", fontWeight: 700, letterSpacing: "1px" }}
                autoCapitalize="characters"
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1.5px solid var(--border)", background: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "var(--mid)" }}>Cancel</button>
              <button
                disabled={deleteConfirmText !== "DELETE" || deleting}
                onClick={handleDelete}
                style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: deleteConfirmText === "DELETE" && !deleting ? "#dc2626" : "#fca5a5", color: "white", fontSize: 14, fontWeight: 800, cursor: deleteConfirmText === "DELETE" && !deleting ? "pointer" : "not-allowed", fontFamily: "Nunito, sans-serif" }}
              >
                {deleting ? "Deleting…" : "Delete my account"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
