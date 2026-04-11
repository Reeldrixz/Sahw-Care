"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import Avatar from "@/components/Avatar";
import DonateModal from "@/components/DonateModal";
import Toast from "@/components/Toast";
import ShareImpactModal from "@/components/ShareImpactModal";
import VerificationBanner from "@/components/VerificationBanner";
import DocumentUploadSheet from "@/components/DocumentUploadSheet";
import { useAuth } from "@/contexts/AuthContext";

const CAT_BG: Record<string, string> = {
  "Baby Milk": "#e8f5f1", "Diapers": "#fff3e0", "Maternity": "#f3e5f5",
  "Clothing": "#e3f2fd", "Accessories": "#e8f5e9", "Other": "#f5f5f5",
};
const CAT_EMOJI: Record<string, string> = {
  "Baby Milk": "🍼", "Diapers": "👶", "Maternity": "🤱",
  "Clothing": "👗", "Accessories": "🧸", "Other": "📦",
};

interface MyItem {
  id: string; title: string; category: string;
  condition: string; quantity: string; images: string[];
  urgent: boolean; status: string;
}

interface Review {
  id: string; pickupRating: number; qualityRating: number; quantityRating: number;
  comment: string | null; createdAt: string;
  reviewer: { id: string; name: string; avatar: string | null };
}

const TRUST_COLOR = (s: number) => s >= 70 ? "var(--green)" : s >= 40 ? "#b8860b" : "var(--terra)";
const TRUST_LABEL = (s: number) => s >= 70 ? "High trust" : s >= 40 ? "Building trust" : "Low trust";

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [myItems, setMyItems] = useState<MyItem[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ratings, setRatings] = useState({ pickup: 0, quality: 0, quantity: 0 });
  const [showDonate, setShowDonate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [switchingRole, setSwitchingRole] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showShareImpact, setShowShareImpact] = useState(false);
  const [showDocUpload, setShowDocUpload] = useState(false);

  // OTP verification state
  const [showVerify, setShowVerify] = useState(false);
  const [verifyType, setVerifyType] = useState<"PHONE" | "EMAIL">("PHONE");
  const [otpStep, setOtpStep] = useState<"send" | "confirm">("send");
  const [otpCode, setOtpCode] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  useEffect(() => {
    if (!user) router.push("/auth");
  }, [user, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [itemsRes, profileRes] = await Promise.all([
      fetch(`/api/items?donorId=${user.id}`),
      fetch(`/api/users/${user.id}`),
    ]);
    if (itemsRes.ok) { const d = await itemsRes.json(); setMyItems(d.items ?? []); }
    if (profileRes.ok) {
      const d = await profileRes.json();
      if (d.user?.reviewsReceived) setReviews(d.user.reviewsReceived);
      if (d.ratings) setRatings(d.ratings);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    if (res.ok) { setShowDonate(false); setToast("Listed! 🎉 Appears after review."); fetchData(); }
    else { const d = await res.json(); setToast(d.error ?? "Failed"); }
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: verifyType }),
    });
    const d = await res.json();
    if (!res.ok) { setToast(d.error); setVerifyLoading(false); return; }
    setOtpStep("confirm");
    if (d.devCode) setDevOtp(d.devCode); // dev mode only
    setVerifyLoading(false);
  };

  const confirmOtp = async () => {
    if (!otpCode.trim()) return;
    setVerifyLoading(true);
    const res = await fetch("/api/verify/confirm-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: verifyType, code: otpCode }),
    });
    const d = await res.json();
    if (!res.ok) { setToast(d.error); setVerifyLoading(false); return; }
    await refreshUser();
    setShowVerify(false); setOtpStep("send"); setOtpCode(""); setDevOtp(null);
    setToast(`✅ ${verifyType === "PHONE" ? "Phone" : "Email"} verified! Trust score updated.`);
    setVerifyLoading(false);
  };

  const openVerify = (type: "PHONE" | "EMAIL") => {
    setVerifyType(type); setOtpStep("send"); setOtpCode(""); setDevOtp(null); setShowVerify(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/user/avatar", { method: "POST", body: fd });
    if (res.ok) { await refreshUser(); setToast("Profile photo updated!"); }
    else { const d = await res.json(); setToast(d.error ?? "Upload failed"); }
    setUploadingAvatar(false);
    e.target.value = "";
  };

  const handleLogout = async () => { await logout(); router.push("/"); };

  if (!user) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;

  const memberYear = new Date(user.createdAt).getFullYear();
  const trustColor = TRUST_COLOR(user.trustScore);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
    <div className="profile-desktop-wrap">
      <div className="profile-hero">
        <label htmlFor="avatar-upload" style={{ cursor: "pointer", position: "relative", display: "inline-block" }}>
          <div className="profile-av" style={{ overflow: "hidden", position: "relative" }}>
            <Avatar src={user.avatar} name={user.name} size={80} />
            <div style={{
              position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
              borderRadius: "50%", opacity: uploadingAvatar ? 1 : 0,
              transition: "opacity 0.2s",
            }}
              className="avatar-overlay"
            >
              {uploadingAvatar ? (
                <div style={{ width: 18, height: 18, border: "2px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              ) : (
                <span style={{ fontSize: 20 }}>📷</span>
              )}
            </div>
          </div>
          <input id="avatar-upload" type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handleAvatarUpload} disabled={uploadingAvatar} />
        </label>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 4, fontWeight: 600 }}>Tap to change photo</div>
        <div className="profile-name">{user.name}</div>
        <div className="profile-role-badge">
          {user.role === "DONOR" ? "🎁 Donor" : "🤱 Recipient"} · ✓ Verified
          {user.isPremium ? " · ✨ Premium" : ""}
        </div>

        {/* Location */}
        <div style={{ marginTop: 10, fontSize: 13 }}>
          {editingLocation ? (
            <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
              <input value={locationInput} onChange={(e) => setLocationInput(e.target.value)} placeholder="e.g. Ikeja, Lagos"
                style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.15)", color: "white", fontSize: 13, outline: "none", fontFamily: "Nunito, sans-serif" }} />
              <button onClick={saveLocation} style={{ padding: "4px 12px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.25)", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Save</button>
              <button onClick={() => setEditingLocation(false)} style={{ padding: "4px 10px", borderRadius: 8, border: "none", background: "transparent", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 12 }}>Cancel</button>
            </div>
          ) : (
            <span onClick={() => { setLocationInput(user.location ?? ""); setEditingLocation(true); }} style={{ cursor: "pointer", opacity: 0.8 }}>
              📍 {user.location ?? "Add your location"}
            </span>
          )}
        </div>

        <div className="profile-stats-row">
          <div className="p-stat"><div className="p-stat-num">{user._count?.items ?? 0}</div><div className="p-stat-label">Donated</div></div>
          <div className="p-stat">
            <div className="p-stat-num" style={{ color: "white", fontSize: 16 }}>
              <span style={{ fontSize: 12, opacity: 0.8 }}>Trust </span>{user.trustScore}
            </div>
            <div className="p-stat-label">{TRUST_LABEL(user.trustScore)}</div>
          </div>
          <div className="p-stat"><div className="p-stat-num">{user._count?.requests ?? 0}</div><div className="p-stat-label">Requests</div></div>
        </div>

        {(user._count?.items ?? 0) > 0 && (
          <button
            onClick={() => setShowShareImpact(true)}
            style={{
              marginTop: 16, padding: "10px 24px", borderRadius: 20,
              border: "none", background: "rgba(255,255,255,0.18)", color: "white",
              fontSize: 13, fontWeight: 800, cursor: "pointer",
              fontFamily: "Nunito, sans-serif",
            }}
          >
            ✨ Share your impact
          </button>
        )}
      </div>

      <div className="profile-body">

        {/* ── Verification progress banner ─────────────────────────── */}
        <VerificationBanner
          onUploadDocument={() => setShowDocUpload(true)}
          onVerifyPhone={() => { setVerifyType("PHONE"); setOtpStep("send"); setOtpCode(""); setDevOtp(null); setShowVerify(true); }}
          onVerifyEmail={() => { setVerifyType("EMAIL"); setOtpStep("send"); setOtpCode(""); setDevOtp(null); setShowVerify(true); }}
        />

        {/* Pending doc status card */}
        {user.docStatus === "PENDING" && (
          <div style={{ background: "var(--yellow-light)", borderRadius: 14, padding: "14px 16px", marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 22 }}>⏳</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#b8860b", marginBottom: 3 }}>Document under review</div>
              <div style={{ fontSize: 12, color: "#7a5500", lineHeight: 1.5 }}>Your {user.documentType} is being reviewed by our team. This usually takes less than 24 hours. We'll notify you once it's confirmed!</div>
            </div>
          </div>
        )}

        {/* Rejected doc status card */}
        {user.docStatus === "REJECTED" && (
          <div style={{ background: "var(--terra-light)", borderRadius: 14, padding: "14px 16px", marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 22 }}>💌</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--terra)", marginBottom: 3 }}>Document needs resubmission</div>
              <div style={{ fontSize: 12, color: "var(--terra)", lineHeight: 1.5, marginBottom: 10 }}>{user.documentNote ?? "Please upload a clearer version of your document."}</div>
              <button onClick={() => setShowDocUpload(true)} style={{ fontSize: 12, fontWeight: 800, background: "var(--terra)", color: "white", border: "none", padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                Upload new document
              </button>
            </div>
          </div>
        )}

        {/* Approved verification badge */}
        {user.docStatus === "VERIFIED" && (
          <div style={{ background: "var(--green-light)", borderRadius: 14, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--green)" }}>Motherhood verified</div>
              <div style={{ fontSize: 12, color: "var(--green)", opacity: 0.8 }}>{user.documentNote ?? "Welcome to Krad\u0259l! You can now create your Register of Needs. 💛"}</div>
            </div>
          </div>
        )}

        {/* ── Verification section ─────────────────────────────────── */}
        <div className="profile-section">
          <div className="profile-section-title">🛡️ Account verification</div>
          <p style={{ fontSize: 12, color: "var(--mid)", marginBottom: 14, lineHeight: 1.6 }}>
            Verifying your phone and email increases your trust score and unlocks more visibility for your register.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Phone */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg)", borderRadius: 10 }}>
              <span style={{ fontSize: 20 }}>📱</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Phone number</div>
                <div style={{ fontSize: 12, color: "var(--mid)" }}>{user.phone ?? "Not added"}</div>
              </div>
              {user.phoneVerified ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", background: "var(--green-light)", padding: "3px 10px", borderRadius: 20 }}>✓ Verified</span>
              ) : user.phone ? (
                <button onClick={() => openVerify("PHONE")} style={{ fontSize: 12, fontWeight: 700, background: "var(--green)", color: "white", border: "none", padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Verify</button>
              ) : (
                <span style={{ fontSize: 11, color: "var(--light)" }}>Add phone first</span>
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
                <button onClick={() => openVerify("EMAIL")} style={{ fontSize: 12, fontWeight: 700, background: "var(--green)", color: "white", border: "none", padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Verify</button>
              ) : (
                <span style={{ fontSize: 11, color: "var(--light)" }}>Add email first</span>
              )}
            </div>
          </div>
          {/* Trust score bar */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5, fontWeight: 600 }}>
              <span style={{ color: "var(--mid)" }}>Trust score</span>
              <span style={{ color: trustColor, fontWeight: 700 }}>{user.trustScore}/100 — {TRUST_LABEL(user.trustScore)}</span>
            </div>
            <div style={{ background: "var(--border)", borderRadius: 6, height: 8 }}>
              <div style={{ width: `${user.trustScore}%`, height: "100%", background: trustColor, borderRadius: 6, transition: "width 0.5s" }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--mid)", marginTop: 5, lineHeight: 1.5 }}>
              Level {user.verificationLevel} · {user.phoneVerified ? "Phone ✓" : "Phone ✗"} · {user.emailVerified ? "Email ✓" : "Email ✗"}
            </div>
          </div>
        </div>

        {/* ── Mode switcher ────────────────────────────────────────── */}
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

        {/* ── Ratings ──────────────────────────────────────────────── */}
        {ratings.pickup > 0 && (
          <div className="profile-section">
            <div className="profile-section-title">My experience ratings</div>
            {[["Pickup", ratings.pickup], ["Quality", ratings.quality], ["Quantity", ratings.quantity]].map(([l, v]) => (
              <div key={l as string} className="rating-row">
                <div className="rating-label">{l}</div>
                <div className="rating-bar-wrap"><div className="rating-bar" style={{ width: `${((v as number) / 5) * 100}%` }} /></div>
                <div className="rating-num">{(v as number).toFixed(1)}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Reviews ──────────────────────────────────────────────── */}
        {reviews.length > 0 && (
          <div className="profile-section">
            <div className="profile-section-title">Recent reviews about me</div>
            {reviews.slice(0, 5).map((r) => {
              const avg = Math.round((r.pickupRating + r.qualityRating + r.quantityRating) / 3);
              const time = new Date(r.createdAt).toLocaleDateString([], { month: "short", day: "numeric" });
              return (
                <div key={r.id} className="review-item">
                  <div className="review-header">
                    <Avatar src={r.reviewer.avatar} name={r.reviewer.name} size={32} />
                    <div><div className="review-name">{r.reviewer.name}</div><div className="review-stars">{"⭐".repeat(avg)}</div></div>
                    <div className="review-time">{time}</div>
                  </div>
                  {r.comment && <div className="review-text">{r.comment}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* ── My listings ──────────────────────────────────────────── */}
        <div className="profile-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="profile-section-title" style={{ marginBottom: 0 }}>My listings</div>
            <button onClick={() => setShowDonate(true)} style={{ background: "var(--green)", color: "white", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>+ Add item</button>
          </div>
          {myItems.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "var(--mid)", fontSize: 13 }}>No items listed yet</div>
          ) : myItems.map((item) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={() => router.push(`/items/${item.id}`)}>
              <div style={{ width: 44, height: 44, background: CAT_BG[item.category] ?? "#f5f5f5", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                {CAT_EMOJI[item.category] ?? "📦"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600 }}>{item.quantity} · {item.condition}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: item.status === "ACTIVE" ? "var(--green-light)" : "var(--bg)", color: item.status === "ACTIVE" ? "var(--green)" : "var(--mid)" }}>
                {item.status}
              </span>
            </div>
          ))}
        </div>

        {/* ── My Registers shortcut ────────────────────────────────── */}
        <div className="profile-section" style={{ cursor: "pointer" }} onClick={() => router.push("/registers/my")}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div className="profile-section-title" style={{ marginBottom: 2 }}>📋 My Registers</div>
              <div style={{ fontSize: 12, color: "var(--mid)" }}>Manage your needs register & commitments</div>
            </div>
            <span style={{ fontSize: 18, color: "var(--mid)" }}>›</span>
          </div>
        </div>

        {/* ── Account ──────────────────────────────────────────────── */}
        <div className="profile-section">
          <div className="profile-section-title">Account</div>
          <div style={{ fontSize: 13, color: "var(--mid)", marginBottom: 8 }}>
            {user.email ?? user.phone} · Member since {memberYear}
          </div>
          <button onClick={handleLogout} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--white)", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "var(--ink)" }}>
            Sign out
          </button>
        </div>
      </div>
    </div>

    {/* ── OTP Verification Sheet ─────────────────────────────────────── */}
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
                We&apos;ll send a 6-digit code to{" "}
                <strong>{verifyType === "PHONE" ? (user.phone ?? "") : (user.email ?? "")}</strong>.
              </p>
              <button className="btn-primary" onClick={sendOtp} disabled={verifyLoading}>
                {verifyLoading ? "Sending..." : "Send code"}
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 16, lineHeight: 1.6 }}>
                Enter the 6-digit code sent to{" "}
                <strong>{verifyType === "PHONE" ? (user.phone ?? "") : (user.email ?? "")}</strong>.
              </p>
              {devOtp && (
                <div style={{ background: "var(--yellow-light)", borderRadius: 10, padding: "8px 14px", marginBottom: 14, fontSize: 13, color: "#b8860b", fontWeight: 700 }}>
                  🛠️ Dev mode — code: <strong>{devOtp}</strong>
                </div>
              )}
              <div className="form-group">
                <input
                  className="form-input"
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(e) => e.key === "Enter" && confirmOtp()}
                  style={{ letterSpacing: 6, fontSize: 22, textAlign: "center", fontWeight: 800 }}
                  maxLength={6}
                  inputMode="numeric"
                />
              </div>
              <button className="btn-primary" onClick={confirmOtp} disabled={verifyLoading || otpCode.length < 6}>
                {verifyLoading ? "Verifying..." : "Confirm"}
              </button>
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
