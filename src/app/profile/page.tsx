"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight, LayoutDashboard, Users, Flag, FileText, Package,
  ShieldCheck, Bell, Gift, Crown, TrendingUp, CheckCircle,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import Avatar from "@/components/Avatar";
import DonateModal from "@/components/DonateModal";
import Toast from "@/components/Toast";
import ShareImpactModal from "@/components/ShareImpactModal";
import VerificationBanner from "@/components/VerificationBanner";
import DocumentUploadSheet from "@/components/DocumentUploadSheet";
import { useAuth } from "@/contexts/AuthContext";
import { STAGE_META } from "@/lib/stage";
import CircleIdentityModal from "@/components/CircleIdentityModal";
import PhoneSetupSheet from "@/components/PhoneSetupSheet";
import TrustScoreBar from "@/components/TrustScoreBar";

const CAT_BG: Record<string, string> = {
  "Feeding": "#e8f5f1", "Diapering": "#fff3e0", "Maternity": "#f3e5f5",
  "Clothing": "#e3f2fd", "Hygiene": "#e8f5e9", "Other": "#f5f5f5",
};
const CAT_EMOJI: Record<string, string> = {
  "Feeding": "🍼", "Diapering": "👶", "Maternity": "🤱",
  "Clothing": "👗", "Hygiene": "🧴", "Other": "📦",
};

const DONOR_LEVEL_META: Record<string, { label: string; icon: string; color: string; next: number | null }> = {
  NEW_DONOR:      { label: "New Donor",      icon: "🌱", color: "#6b7280", next: 50  },
  ACTIVE_DONOR:   { label: "Active Donor",   icon: "💚", color: "#16a34a", next: 150 },
  TRUSTED_DONOR:  { label: "Trusted Donor",  icon: "⭐", color: "#ca8a04", next: 300 },
  IMPACT_PARTNER: { label: "Impact Partner", icon: "👑", color: "#7c3aed", next: null },
};

const TRUST_LABEL = (s: number) => s >= 70 ? "High trust" : s >= 40 ? "Building trust" : "Low trust";

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: "#fff8ed", color: "#d97706" },
  ACCEPTED:  { bg: "#e8f5f1", color: "#1a7a5e" },
  DECLINED:  { bg: "#fdecea", color: "#c0392b" },
  FULFILLED: { bg: "#e8f5f1", color: "#1a7a5e" },
  ACTIVE:    { bg: "#e8f5f1", color: "#1a7a5e" },
  CANCELLED: { bg: "#f5f5f5", color: "#9ca3af" },
};

interface MyItem {
  id: string; title: string; category: string;
  condition: string; quantity: string; images: string[];
  urgent: boolean; status: string;
}

interface MyRequest {
  id: string; status: string; createdAt: string; notes: string | null;
  item: { id: string; title: string; images: string[]; donor?: { name: string } | null } | null;
}

interface NotifPrefs {
  notifyNewPosts: boolean;
  notifyReplies: boolean;
  notifyThreadReplies: boolean;
  notifyBundleUpdates: boolean;
  notifyVerification: boolean;
}

interface Summary {
  role: string;
  // recipient
  requestsTotal?: number;
  requestsPending?: number;
  requestsFulfilled?: number;
  registersCount?: number;
  // donor
  itemsTotal?: number;
  itemsActive?: number;
  itemsFulfilled?: number;
  impactScore?: number;
  donorLevel?: string;
  totalFundedCents?: number;
  // admin
  totalUsers?: number;
  pendingReports?: number;
  activeItems?: number;
  pendingDocuments?: number;
  bundlesPending?: number;
}

function ImpactScoreSection() {
  const [data, setData] = useState<{ impactScore: number; donorLevel: string } | null>(null);

  useEffect(() => {
    fetch("/api/user/trust")
      .then(r => r.json())
      .then(d => setData({ impactScore: d.impactScore ?? 0, donorLevel: d.donorLevel ?? "NEW_DONOR" }))
      .catch(() => {});
  }, []);

  const score = data?.impactScore ?? 0;
  const level = data?.donorLevel ?? "NEW_DONOR";
  const meta  = DONOR_LEVEL_META[level] ?? DONOR_LEVEL_META.NEW_DONOR;
  const progress = meta.next ? Math.min(100, (score / meta.next) * 100) : 100;
  const pointsToNext = meta.next ? meta.next - score : 0;

  return (
    <div style={{ background: "white", borderRadius: 16, padding: "18px 16px", marginBottom: 12, border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 28 }}>{meta.icon}</span>
        <div>
          <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: meta.color, lineHeight: 1 }}>{meta.label}</div>
          <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>Impact score: {score}</div>
        </div>
      </div>
      <div style={{ background: "#f3f4f6", borderRadius: 8, height: 8, marginBottom: 8, overflow: "hidden" }}>
        <div style={{ width: `${progress}%`, height: "100%", background: meta.color, borderRadius: 8, transition: "width 0.6s ease" }} />
      </div>
      {meta.next ? (
        <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
          <strong style={{ color: "var(--ink)" }}>{pointsToNext} more points</strong> to next level
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#7c3aed", fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>Highest level reached!</div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {Object.entries(DONOR_LEVEL_META).map(([key, m]) => (
          <span key={key} style={{
            fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
            fontFamily: "Nunito, sans-serif",
            background: level === key ? "#f3f4f6" : "var(--bg)",
            color: level === key ? m.color : "var(--mid)",
            border: `1.5px solid ${level === key ? m.color : "var(--border)"}`,
          }}>{m.icon} {m.label}</span>
        ))}
      </div>
    </div>
  );
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={onToggle}
      aria-label={`Toggle ${label}`}
      style={{
        width: 44, height: 24, borderRadius: 12, border: "none",
        background: on ? "#1a7a5e" : "var(--border)",
        position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 2,
        left: on ? 22 : 2, width: 20, height: 20, borderRadius: "50%",
        background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();

  // ── shared state ───────────────────────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // ── recipient state ────────────────────────────────────────────────────────
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [reqTab, setReqTab] = useState<"all" | "pending" | "fulfilled">("all");
  const [reqLoading, setReqLoading] = useState(false);

  // ── donor state ────────────────────────────────────────────────────────────
  const [myItems, setMyItems] = useState<MyItem[]>([]);
  const [itemTab, setItemTab] = useState<"active" | "all">("active");
  const [showDonate, setShowDonate] = useState(false);
  const [showShareImpact, setShowShareImpact] = useState(false);

  // ── verification / modals ─────────────────────────────────────────────────
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [showPhoneSetup, setShowPhoneSetup] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [switchingRole, setSwitchingRole] = useState(false);

  // ── OTP state ──────────────────────────────────────────────────────────────
  const [showVerify, setShowVerify] = useState(false);
  const [verifyType, setVerifyType] = useState<"PHONE" | "EMAIL">("PHONE");
  const [otpStep, setOtpStep] = useState<"send" | "confirm">("send");
  const [otpCode, setOtpCode] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // ── delete state ───────────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) router.push("/auth");
  }, [user, router]);

  // ── data fetch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetch("/api/profile/summary").then(r => r.json()).then(d => setSummary(d)).catch(() => {});
    fetch("/api/notifications/preferences").then(r => r.json()).then(d => setNotifPrefs(d.prefs ?? null)).catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchItems = useCallback(async () => {
    if (!user) return;
    const r = await fetch(`/api/items?donorId=${user.id}`);
    if (r.ok) { const d = await r.json(); setMyItems(d.items ?? []); }
  }, [user]);

  const fetchRequests = useCallback(async () => {
    setReqLoading(true);
    const r = await fetch("/api/requests");
    if (r.ok) { const d = await r.json(); setRequests(d.requests ?? []); }
    setReqLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.journeyType === "donor") fetchItems();
    else fetchRequests();
  }, [user, fetchItems, fetchRequests]);

  // ── handlers ───────────────────────────────────────────────────────────────
  const togglePref = async (key: keyof NotifPrefs) => {
    if (!notifPrefs) return;
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    setSavingPrefs(true);
    await fetch("/api/notifications/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: updated[key] }),
    });
    setSavingPrefs(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/user/avatar", { method: "POST", body: fd });
    if (res.ok) { await refreshUser(); setToast("Profile photo updated!"); }
    else { const d = await res.json(); setToast(d.error ?? "Upload failed"); }
    setUploadingAvatar(false);
    e.target.value = "";
  };

  const saveLocation = async () => {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: locationInput }),
    });
    if (res.ok) { await refreshUser(); setEditingLocation(false); setToast("Location updated!"); }
  };

  const switchRole = async (newRole: "DONOR" | "RECIPIENT") => {
    setSwitchingRole(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) { await refreshUser(); setToast("Role updated!"); }
    setSwitchingRole(false);
  };

  const sendOtp = async () => {
    setVerifyLoading(true);
    const res = await fetch("/api/verify/send-otp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: verifyType }),
    });
    const d = await res.json();
    if (!res.ok) { setToast(d.error); setVerifyLoading(false); return; }
    setOtpStep("confirm");
    if (d.devCode) setDevOtp(d.devCode);
    setVerifyLoading(false);
  };

  const confirmOtp = async () => {
    if (!otpCode.trim()) return;
    setVerifyLoading(true);
    const res = await fetch("/api/verify/confirm-otp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: verifyType, code: otpCode }),
    });
    const d = await res.json();
    if (!res.ok) { setToast(d.error); setVerifyLoading(false); return; }
    await refreshUser();
    setShowVerify(false); setOtpStep("send"); setOtpCode(""); setDevOtp(null);
    setToast(`✅ ${verifyType === "PHONE" ? "Phone" : "Email"} verified! Trust score updated.`);
    setVerifyLoading(false);
  };

  const handleDonate = async (formData: FormData) => {
    let imageUrl: string | undefined;
    const file = formData.get("file") as File | null;
    if (file && file.size > 0) {
      const fd = new FormData(); fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      if (up.ok) { const { url } = await up.json(); imageUrl = url; }
    }
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formData.get("title"), category: formData.get("category"),
        condition: formData.get("condition"), quantity: formData.get("quantity"),
        location: formData.get("location"), description: formData.get("description"),
        urgent: formData.get("urgent") === "true", images: imageUrl ? [imageUrl] : [],
      }),
    });
    if (res.ok) { setShowDonate(false); setToast("Listed! Appears after review."); fetchItems(); }
    else { const d = await res.json(); setToast(d.error ?? "Failed"); }
  };

  const handleLogout = async () => { await logout(); router.push("/"); };

  if (!user) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;

  const isAdmin  = user.role === "ADMIN";
  const isDonor  = user.journeyType === "donor";
  const memberYear = new Date(user.createdAt).getFullYear();

  // ── filtered lists ─────────────────────────────────────────────────────────
  const visibleRequests = reqTab === "all" ? requests
    : requests.filter(r => r.status.toLowerCase() === reqTab);
  const visibleItems = itemTab === "active"
    ? myItems.filter(i => i.status === "ACTIVE")
    : myItems;

  // ── hero stats data ────────────────────────────────────────────────────────
  const heroStats = isAdmin
    ? [
        { num: summary?.totalUsers ?? "—", label: "Users" },
        { num: summary?.pendingReports ?? "—", label: "Reports" },
        { num: summary?.activeItems ?? "—", label: "Items" },
      ]
    : isDonor
    ? [
        { num: summary?.itemsActive ?? user._count?.items ?? "—", label: "Active" },
        { num: summary?.impactScore ?? 0, label: "Impact" },
        { num: summary?.totalFundedCents != null ? `₦${Math.round(summary.totalFundedCents / 100).toLocaleString()}` : "—", label: "Funded" },
      ]
    : [
        { num: summary?.requestsTotal ?? user._count?.requests ?? "—", label: "Requests" },
        { num: user.trustScore, label: TRUST_LABEL(user.trustScore) },
        { num: summary?.registersCount ?? "—", label: "Registers" },
      ];

  // ── role badge ─────────────────────────────────────────────────────────────
  const roleBadge = isAdmin ? "🛡️ Admin" : isDonor ? "🎁 Donor" : "🤱 Recipient";

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
    <div className="profile-desktop-wrap">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <div className="profile-hero">
        <label htmlFor="avatar-upload" style={{ cursor: "pointer", position: "relative", display: "inline-block" }}>
          <div className="profile-av" style={{ overflow: "hidden", position: "relative" }}>
            <Avatar src={user.avatar} name={user.name} size={80} />
            <div
              style={{
                position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: "50%", opacity: uploadingAvatar ? 1 : 0, transition: "opacity 0.2s",
              }}
              className="avatar-overlay"
            >
              {uploadingAvatar
                ? <div style={{ width: 18, height: 18, border: "2px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                : <span style={{ fontSize: 20 }}>📷</span>
              }
            </div>
          </div>
          <input id="avatar-upload" type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handleAvatarUpload} disabled={uploadingAvatar} />
        </label>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 4, fontWeight: 600 }}>Tap to change photo</div>
        <div className="profile-name">{user.name}</div>
        <div className="profile-role-badge">{roleBadge}</div>

        {/* Location (non-admin) */}
        {!isAdmin && (
          <div style={{ marginTop: 10, fontSize: 13 }}>
            {editingLocation ? (
              <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={locationInput} onChange={(e) => setLocationInput(e.target.value)}
                  placeholder="e.g. Ikeja, Lagos"
                  style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.15)", color: "white", fontSize: 13, outline: "none", fontFamily: "Nunito, sans-serif" }}
                />
                <button onClick={saveLocation} style={{ padding: "4px 12px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.25)", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Save</button>
                <button onClick={() => setEditingLocation(false)} style={{ padding: "4px 10px", borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 12 }}>Cancel</button>
              </div>
            ) : (
              <span onClick={() => { setLocationInput(user.location ?? ""); setEditingLocation(true); }} style={{ cursor: "pointer", opacity: 0.8 }}>
                📍 {user.location ?? "Add your location"}
              </span>
            )}
            {user.currentStage && STAGE_META[user.currentStage as keyof typeof STAGE_META] && (
              <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", background: "rgba(255,255,255,0.15)", borderRadius: 20, padding: "5px 14px" }}>
                <span style={{ fontSize: 12, color: "white", fontWeight: 700 }}>{STAGE_META[user.currentStage as keyof typeof STAGE_META].label}</span>
              </div>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="profile-stats-row">
          {heroStats.map((s, i) => (
            <div key={i} className="p-stat">
              <div className="p-stat-num">{s.num}</div>
              <div className="p-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Share impact (donor only) */}
        {isDonor && (summary?.itemsTotal ?? 0) > 0 && (
          <button
            onClick={() => setShowShareImpact(true)}
            style={{ marginTop: 16, padding: "10px 24px", borderRadius: 20, border: "none", background: "rgba(255,255,255,0.18)", color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
          >
            ✨ Share your impact
          </button>
        )}
      </div>

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div className="profile-body">

        {/* ════════════ ADMIN VIEW ════════════════════════════════════════ */}
        {isAdmin && (
          <>
            {/* Dashboard card */}
            <div
              onClick={() => router.push("/admin")}
              style={{
                background: "linear-gradient(135deg, #1a7a5e 0%, #22a37c 100%)",
                borderRadius: 16, padding: "20px 20px", marginBottom: 16,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 16,
                boxShadow: "0 4px 20px rgba(26,122,94,0.25)",
              }}
            >
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <LayoutDashboard size={26} color="white" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "white" }}>Admin Dashboard</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontFamily: "Nunito, sans-serif" }}>Manage users, items, reports & bundles</div>
              </div>
              <ChevronRight size={20} color="rgba(255,255,255,0.75)" />
            </div>

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { icon: Users, label: "Active Users", val: summary?.totalUsers, color: "#1a7a5e", bg: "#e8f5f1" },
                { icon: Flag, label: "Pending Reports", val: summary?.pendingReports, color: "#c0392b", bg: "#fdecea" },
                { icon: FileText, label: "Pending Docs", val: summary?.pendingDocuments, color: "#d97706", bg: "#fff8ed" },
                { icon: Package, label: "Bundles Pending", val: summary?.bundlesPending, color: "#6366f1", bg: "#eef2ff" },
              ].map(({ icon: Icon, label, val, color, bg }) => (
                <div key={label} style={{ background: "white", borderRadius: 14, padding: "16px 14px", border: "1px solid var(--border)" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <Icon size={18} color={color} />
                  </div>
                  <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: "#1a1a1a" }}>{val ?? "—"}</div>
                  <div style={{ fontSize: 12, color: "#555", fontFamily: "Nunito, sans-serif", marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div style={{ background: "white", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 16 }}>
              <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>Quick actions</span>
              </div>
              {[
                { icon: FileText,  label: "Review Documents",  sub: "Pending verifications", path: "/admin/verification" },
                { icon: Flag,      label: "Review Reports",    sub: "Flagged content",       path: "/admin/reports"      },
                { icon: Package,   label: "Manage Bundles",    sub: "Care bundle dispatch",  path: "/admin/bundles"      },
                { icon: Users,     label: "Manage Users",      sub: "User trust & access",   path: "/admin/users"        },
                { icon: ShieldCheck, label: "Trust & Abuse",   sub: "Flags & restrictions",  path: "/admin/trust"        },
              ].map(({ icon: Icon, label, sub, path }) => (
                <button key={path} onClick={() => router.push(path)} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  width: "100%", padding: "13px 16px",
                  borderBottom: "1px solid var(--border)", background: "none", border: "none",
                  borderTop: "none", cursor: "pointer", textAlign: "left",
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={17} color="#1a7a5e" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", fontFamily: "Nunito, sans-serif" }}>{label}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "Nunito, sans-serif" }}>{sub}</div>
                  </div>
                  <ChevronRight size={16} color="#9ca3af" />
                </button>
              ))}
            </div>
          </>
        )}

        {/* ════════════ RECIPIENT VIEW ═════════════════════════════════════ */}
        {!isAdmin && !isDonor && (
          <>
            <VerificationBanner
              onUploadDocument={() => setShowDocUpload(true)}
              onVerifyPhone={() => { setVerifyType("PHONE"); setOtpStep("send"); setOtpCode(""); setDevOtp(null); setShowVerify(true); }}
              onVerifyEmail={() => { setVerifyType("EMAIL"); setOtpStep("send"); setOtpCode(""); setDevOtp(null); setShowVerify(true); }}
            />

            {/* Doc status cards */}
            {user.docStatus === "PENDING" && (
              <div style={{ background: "var(--yellow-light)", borderRadius: 14, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 22 }}>⏳</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#b8860b", marginBottom: 3 }}>Document under review</div>
                  <div style={{ fontSize: 12, color: "#7a5500", lineHeight: 1.5 }}>Your {user.documentType} is being reviewed by our team. This usually takes less than 24 hours.</div>
                </div>
              </div>
            )}
            {user.docStatus === "REJECTED" && (
              <div style={{ background: "var(--terra-light)", borderRadius: 14, padding: "14px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 22 }}>💌</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--terra)", marginBottom: 3 }}>Document needs resubmission</div>
                  <div style={{ fontSize: 12, color: "var(--terra)", lineHeight: 1.5, marginBottom: 10 }}>{user.documentNote ?? "Please upload a clearer version."}</div>
                  <button onClick={() => setShowDocUpload(true)} style={{ fontSize: 12, fontWeight: 800, background: "var(--terra)", color: "white", border: "none", padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Upload new document</button>
                </div>
              </div>
            )}
            {user.docStatus === "VERIFIED" && (
              <div style={{ background: "var(--green-light)", borderRadius: 14, padding: "12px 16px", marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 22 }}>✅</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--green)" }}>Motherhood verified</div>
                  <div style={{ fontSize: 12, color: "var(--green)", opacity: 0.8 }}>{user.documentNote ?? "You can now create your Register of Needs."}</div>
                </div>
              </div>
            )}

            <TrustScoreBar currentScore={user.trustScore} />

            {/* Registers shortcut */}
            <div className="profile-section" style={{ cursor: "pointer" }} onClick={() => router.push("/registers/my")}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div className="profile-section-title" style={{ marginBottom: 2 }}>📋 My Registers</div>
                  <div style={{ fontSize: 12, color: "var(--mid)" }}>{summary?.registersCount ?? 0} register{(summary?.registersCount ?? 0) !== 1 ? "s" : ""} · track your needs &amp; commitments</div>
                </div>
                <ChevronRight size={20} color="#9ca3af" />
              </div>
            </div>

            {/* Requests section */}
            <div className="profile-section">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div className="profile-section-title" style={{ marginBottom: 0 }}>My Requests</div>
                <span style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>{summary?.requestsTotal ?? 0} total</span>
              </div>
              {/* Tabs */}
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {(["all", "pending", "fulfilled"] as const).map(t => (
                  <button key={t} onClick={() => setReqTab(t)} style={{
                    padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                    border: "1.5px solid", fontFamily: "Nunito, sans-serif", cursor: "pointer",
                    borderColor: reqTab === t ? "#1a7a5e" : "var(--border)",
                    background: reqTab === t ? "#e8f5f1" : "white",
                    color: reqTab === t ? "#1a7a5e" : "var(--mid)",
                    transition: "all 0.15s",
                  }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                    {t === "pending" && (summary?.requestsPending ?? 0) > 0 && (
                      <span style={{ marginLeft: 4, background: "#d97706", color: "white", fontSize: 10, borderRadius: 20, padding: "1px 5px" }}>{summary?.requestsPending}</span>
                    )}
                  </button>
                ))}
              </div>

              {reqLoading ? (
                <div style={{ padding: "20px 0", textAlign: "center" }}><div className="spinner" style={{ margin: "0 auto" }} /></div>
              ) : visibleRequests.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "var(--mid)", fontSize: 13, fontFamily: "Nunito, sans-serif" }}>
                  {reqTab === "all" ? "No requests yet. Browse the discover page to find items." : `No ${reqTab} requests.`}
                </div>
              ) : visibleRequests.map(req => {
                const sc = STATUS_COLORS[req.status] ?? STATUS_COLORS.PENDING;
                return (
                  <div key={req.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ width: 40, height: 40, background: "var(--bg)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>📦</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {req.item?.title ?? "Item removed"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                        {new Date(req.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                        {req.item?.donor ? ` · from ${req.item.donor.name}` : ""}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: sc.bg, color: sc.color, flexShrink: 0, fontFamily: "Nunito, sans-serif" }}>
                      {req.status.charAt(0) + req.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Circle Identity */}
            {user.journeyType && (
              <div className="profile-section">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div className="profile-section-title" style={{ marginBottom: 0 }}>💛 Circle identity</div>
                  <button onClick={() => setShowIdentityModal(true)} style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", background: "var(--green-light)", border: "none", padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                    {user.circleIdentitySet ? "Edit" : "Set up"}
                  </button>
                </div>
                <p style={{ fontSize: 12, color: "var(--mid)", lineHeight: 1.6, marginBottom: 10 }}>How you appear to other moms in your circle.</p>
                <div style={{ background: "var(--bg)", borderRadius: 12, padding: "12px 14px", border: "1.5px solid var(--border)" }}>
                  {user.circleIdentitySet ? (
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                      {user.circleContext ? `${user.circleContext} • ` : ""}{user.circleDisplayName?.trim() || user.name.split(" ")[0]}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: "var(--mid)", fontStyle: "italic" }}>Not set — your first name is shown by default</div>
                  )}
                </div>
              </div>
            )}

            {/* Notification prefs (recipient) */}
            {notifPrefs && (
              <div className="profile-section">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div className="profile-section-title" style={{ marginBottom: 0 }}>Notification preferences</div>
                  {savingPrefs && <span style={{ fontSize: 11, color: "var(--mid)" }}>Saving…</span>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {([
                    { key: "notifyNewPosts"     as const, label: "New posts in my circle",       desc: "When someone posts in your circle"          },
                    { key: "notifyReplies"       as const, label: "Replies to my posts",           desc: "When someone replies to your post"          },
                    { key: "notifyThreadReplies" as const, label: "Thread replies",               desc: "When someone replies in a thread you joined" },
                    { key: "notifyVerification"  as const, label: "Verification updates",         desc: "When your document review status changes"    },
                  ]).map(({ key, label, desc }) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--bg)", borderRadius: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 11, color: "var(--mid)" }}>{desc}</div>
                      </div>
                      <Toggle on={notifPrefs[key]} onToggle={() => togglePref(key)} label={label} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════ DONOR VIEW ════════════════════════════════════════ */}
        {!isAdmin && isDonor && (
          <>
            <ImpactScoreSection />

            {/* My Items */}
            <div className="profile-section">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div className="profile-section-title" style={{ marginBottom: 0 }}>My Items</div>
                <button onClick={() => setShowDonate(true)} style={{ background: "var(--green)", color: "white", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>+ List item</button>
              </div>
              {/* Tabs */}
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {(["active", "all"] as const).map(t => (
                  <button key={t} onClick={() => setItemTab(t)} style={{
                    padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                    border: "1.5px solid", fontFamily: "Nunito, sans-serif", cursor: "pointer",
                    borderColor: itemTab === t ? "#1a7a5e" : "var(--border)",
                    background: itemTab === t ? "#e8f5f1" : "white",
                    color: itemTab === t ? "#1a7a5e" : "var(--mid)",
                    transition: "all 0.15s",
                  }}>
                    {t === "active" ? `Active (${summary?.itemsActive ?? 0})` : `All (${summary?.itemsTotal ?? myItems.length})`}
                  </button>
                ))}
              </div>

              {visibleItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "var(--mid)", fontSize: 13, fontFamily: "Nunito, sans-serif" }}>
                  {itemTab === "active" ? "No active listings." : "No items listed yet."}
                </div>
              ) : visibleItems.map(item => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={() => router.push(`/items/${item.id}`)}>
                  <div style={{ width: 44, height: 44, background: CAT_BG[item.category] ?? "#f5f5f5", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                    {CAT_EMOJI[item.category] ?? "📦"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600 }}>{item.quantity} · {item.condition}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: item.status === "ACTIVE" ? "var(--green-light)" : "var(--bg)", color: item.status === "ACTIVE" ? "var(--green)" : "var(--mid)", flexShrink: 0 }}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Quick links */}
            {[
              { icon: Gift, label: "My Favourites", sub: "Items you've saved", path: "/favourites" },
              { icon: Crown, label: "Bundle Contributions", sub: "Care bundles you've supported", path: "/bundles/contributions" },
            ].map(({ icon: Icon, label, sub, path }) => (
              <div key={path} className="profile-section" style={{ cursor: "pointer" }} onClick={() => router.push(path)}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={19} color="#1a7a5e" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="profile-section-title" style={{ marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "var(--mid)" }}>{sub}</div>
                  </div>
                  <ChevronRight size={20} color="#9ca3af" />
                </div>
              </div>
            ))}

            {/* Notification prefs (donor) */}
            {notifPrefs && (
              <div className="profile-section">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div className="profile-section-title" style={{ marginBottom: 0 }}>Notification preferences</div>
                  {savingPrefs && <span style={{ fontSize: 11, color: "var(--mid)" }}>Saving…</span>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {([
                    { key: "notifyBundleUpdates" as const, label: "Bundle updates",   desc: "When a bundle you contributed to is dispatched" },
                    { key: "notifyReplies"        as const, label: "Circle replies",   desc: "When someone replies to your circle posts"      },
                  ]).map(({ key, label, desc }) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--bg)", borderRadius: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 11, color: "var(--mid)" }}>{desc}</div>
                      </div>
                      <Toggle on={notifPrefs[key]} onToggle={() => togglePref(key)} label={label} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════ SHARED ACCOUNT SECTION ════════════════════════════ */}

        {/* Account verification (non-admin) */}
        {!isAdmin && (
          <div className="profile-section">
            <div className="profile-section-title">🛡️ Account verification</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Phone */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg)", borderRadius: 10 }}>
                <span style={{ fontSize: 20 }}>📱</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Phone number</div>
                  <div style={{ fontSize: 12, color: "var(--mid)" }}>
                    {user.phone ? user.phone.slice(0, -4).replace(/\d/g, "•") + user.phone.slice(-4) : "Not added"}
                  </div>
                </div>
                {user.phoneVerified ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", background: "var(--green-light)", padding: "3px 10px", borderRadius: 20 }}>✓ Verified</span>
                    <button onClick={() => setShowPhoneSetup(true)} style={{ fontSize: 11, fontWeight: 700, color: "var(--mid)", background: "none", border: "1.5px solid var(--border)", padding: "3px 10px", borderRadius: 20, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Change</button>
                  </div>
                ) : user.phone ? (
                  <button onClick={() => setShowPhoneSetup(true)} style={{ fontSize: 12, fontWeight: 700, background: "var(--green)", color: "white", border: "none", padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Verify</button>
                ) : (
                  <button onClick={() => setShowPhoneSetup(true)} style={{ fontSize: 12, fontWeight: 700, background: "var(--green)", color: "white", border: "none", padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>+ Add</button>
                )}
              </div>
              {/* Email */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg)", borderRadius: 10 }}>
                <span style={{ fontSize: 20 }}>📧</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Email address</div>
                  <div style={{ fontSize: 12, color: "var(--mid)" }}>{user.email ?? "Not added"}</div>
                </div>
                {user.emailVerified ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", background: "var(--green-light)", padding: "3px 10px", borderRadius: 20 }}>✓ Verified</span>
                ) : user.email ? (
                  <button onClick={() => { setVerifyType("EMAIL"); setOtpStep("send"); setOtpCode(""); setDevOtp(null); setShowVerify(true); }} style={{ fontSize: 12, fontWeight: 700, background: "var(--green)", color: "white", border: "none", padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Verify</button>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--light)" }}>Add email first</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mode switcher (non-admin, non-donor) */}
        {user.role !== "ADMIN" && (
          <div className="profile-section">
            <div className="profile-section-title">My mode</div>
            <p style={{ fontSize: 12, color: "var(--mid)", marginBottom: 12 }}>You can both donate and receive — switch your primary mode here.</p>
            <div style={{ display: "flex", gap: 8 }}>
              {(["DONOR", "RECIPIENT"] as const).map((r) => (
                <button key={r} disabled={switchingRole} onClick={() => switchRole(r)} style={{
                  flex: 1, padding: "10px 0", borderRadius: 10, border: "2px solid",
                  borderColor: user.role === r ? "var(--green)" : "var(--border)",
                  background: user.role === r ? "var(--green-light)" : "var(--white)",
                  color: user.role === r ? "var(--green)" : "var(--mid)",
                  fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", transition: "all 0.2s",
                }}>
                  {r === "DONOR" ? "🎁 Donor" : "🤱 Recipient"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Account section */}
        <div className="profile-section">
          <div className="profile-section-title">Account</div>
          <div style={{ fontSize: 13, color: "var(--mid)", marginBottom: 12 }}>
            {user.email ?? user.phone} · Member since {memberYear}
          </div>

          {/* Journey type (non-admin) */}
          {!isAdmin && user.onboardingComplete && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--mid)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>My Journey</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { value: "pregnant",   emoji: "🤰", label: "I'm pregnant"           },
                  { value: "postpartum", emoji: "🤱", label: "I'm a mother"            },
                  { value: "donor",      emoji: "🎁", label: "I'm a supporter / donor" },
                ].map(({ value, emoji, label }) => (
                  <button
                    key={value}
                    onClick={async () => {
                      if (user.journeyType === value) return;
                      if (!confirm(`Switch your journey to "${label}"? Your circle assignment will reset.`)) return;
                      const res = await fetch("/api/user/onboarding", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ journeyType: value, subTags: user.subTags ?? [] }),
                      });
                      if (res.ok) { refreshUser(); setToast("Journey updated!"); }
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", borderRadius: 12,
                      border: `1.5px solid ${user.journeyType === value ? "var(--green)" : "var(--border)"}`,
                      background: user.journeyType === value ? "var(--green-light)" : "var(--white)",
                      color: user.journeyType === value ? "var(--green)" : "var(--ink)",
                      fontSize: 13, fontWeight: 700, cursor: user.journeyType === value ? "default" : "pointer",
                      fontFamily: "Nunito, sans-serif", textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{emoji}</span>
                    <span>{label}</span>
                    {user.journeyType === value && <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--green)" }}>Current</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={handleLogout} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--white)", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "var(--ink)" }}>
            Sign out
          </button>
        </div>

        {/* Delete account */}
        <div style={{ padding: "0 16px 40px" }}>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
            <button
              onClick={() => { setDeleteConfirmText(""); setShowDeleteModal(true); }}
              style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1.5px solid #fca5a5", background: "var(--white)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "#dc2626" }}
            >
              Delete account
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* ── DELETE MODAL ──────────────────────────────────────────────────────── */}
    {showDeleteModal && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        onClick={(e) => { if (e.target === e.currentTarget && !deleting) setShowDeleteModal(false); }}>
        <div style={{ background: "var(--white)", borderRadius: 20, width: "100%", maxWidth: 400, padding: "28px 24px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
          <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>⚠️</div>
          <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, textAlign: "center", marginBottom: 10 }}>Delete your account?</div>
          <p style={{ fontSize: 13, color: "var(--mid)", textAlign: "center", lineHeight: 1.6, marginBottom: 20 }}>
            This will permanently delete your profile, listings, and all your data. This cannot be undone.
          </p>
          <div style={{ background: "#fef2f2", borderRadius: 12, padding: "12px 14px", marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>Type <strong>DELETE</strong> to confirm</div>
            <input
              value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE" disabled={deleting}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${deleteConfirmText === "DELETE" ? "#dc2626" : "var(--border)"}`, fontSize: 14, fontFamily: "Nunito, sans-serif", outline: "none", background: "var(--white)", boxSizing: "border-box", fontWeight: 700, letterSpacing: "1px" }}
              autoCapitalize="characters"
            />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowDeleteModal(false)} disabled={deleting} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--white)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "var(--mid)" }}>Cancel</button>
            <button
              disabled={deleteConfirmText !== "DELETE" || deleting}
              onClick={async () => {
                setDeleting(true);
                try {
                  const res = await fetch("/api/user/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "DELETE" }) });
                  if (res.ok) { window.location.href = "/"; }
                  else { const d = await res.json(); setToast(d.error ?? "Something went wrong"); setDeleting(false); }
                } catch { setToast("Something went wrong"); setDeleting(false); }
              }}
              style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: deleteConfirmText === "DELETE" && !deleting ? "#dc2626" : "#fca5a5", color: "white", fontSize: 14, fontWeight: 800, cursor: deleteConfirmText === "DELETE" && !deleting ? "pointer" : "not-allowed", fontFamily: "Nunito, sans-serif", transition: "background 0.15s" }}
            >
              {deleting ? "Deleting…" : "Delete my account"}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── OTP SHEET ─────────────────────────────────────────────────────────── */}
    {showVerify && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        onClick={(e) => { if (e.target === e.currentTarget) setShowVerify(false); }}>
        <div style={{ background: "var(--white)", borderRadius: "24px 24px 0 0", padding: "24px 20px 48px", width: "100%", maxWidth: 430, animation: "sheetUp 0.3s ease" }}>
          <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 4, margin: "0 auto 20px" }} />
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
            Verify your {verifyType === "PHONE" ? "phone" : "email"}
          </div>
          {otpStep === "send" ? (
            <>
              <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 20, lineHeight: 1.6 }}>
                We&apos;ll send a 6-digit code to <strong>{verifyType === "PHONE" ? (user.phone ?? "") : (user.email ?? "")}</strong>.
              </p>
              <button className="btn-primary" onClick={sendOtp} disabled={verifyLoading}>{verifyLoading ? "Sending..." : "Send code"}</button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 16, lineHeight: 1.6 }}>
                Enter the 6-digit code sent to <strong>{verifyType === "PHONE" ? (user.phone ?? "") : (user.email ?? "")}</strong>.
              </p>
              {devOtp && (
                <div style={{ background: "var(--yellow-light)", borderRadius: 10, padding: "8px 14px", marginBottom: 14, fontSize: 13, color: "#b8860b", fontWeight: 700 }}>
                  🛠️ Dev mode — code: <strong>{devOtp}</strong>
                </div>
              )}
              <div className="form-group">
                <input className="form-input" placeholder="000000" value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && confirmOtp()}
                  style={{ letterSpacing: 6, fontSize: 22, textAlign: "center", fontWeight: 800 }}
                  maxLength={6} inputMode="numeric"
                />
              </div>
              <button className="btn-primary" onClick={confirmOtp} disabled={verifyLoading || otpCode.length < 6}>{verifyLoading ? "Verifying..." : "Confirm"}</button>
              <button style={{ background: "none", border: "none", color: "var(--mid)", fontSize: 13, display: "block", margin: "12px auto 0", cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                onClick={() => { setOtpStep("send"); setDevOtp(null); setOtpCode(""); }}>
                ← Resend code
              </button>
            </>
          )}
        </div>
      </div>
    )}

    <BottomNav />
    {showDonate && <DonateModal onClose={() => setShowDonate(false)} onSubmit={handleDonate} />}
    {showShareImpact && <ShareImpactModal onClose={() => setShowShareImpact(false)} />}
    {showIdentityModal && <CircleIdentityModal onDone={() => { setShowIdentityModal(false); refreshUser(); }} />}
    {showPhoneSetup && (
      <PhoneSetupSheet
        existingPhone={user.phone}
        onClose={() => setShowPhoneSetup(false)}
        onSuccess={async () => { setShowPhoneSetup(false); await refreshUser(); setToast("Phone number verified ✓"); }}
      />
    )}
    {showDocUpload && (
      <DocumentUploadSheet
        onClose={() => setShowDocUpload(false)}
        onSuccess={() => { setShowDocUpload(false); setToast("Document submitted! We'll review it within 24 hours 💛"); }}
      />
    )}
    <Toast message={toast} onClose={() => setToast(null)} />
  </div>
  );
}
