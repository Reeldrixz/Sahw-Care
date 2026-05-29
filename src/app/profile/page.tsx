"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight, Settings, ShieldCheck, FileText, Clock, CheckCircle, XCircle,
  Heart, Users, LayoutDashboard, Flag, Package, Gift, Crown, Calendar,
  type LucideIcon,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import Avatar from "@/components/Avatar";
import DonateModal from "@/components/DonateModal";
import Toast from "@/components/Toast";
import ShareImpactModal from "@/components/ShareImpactModal";
import VerificationBanner from "@/components/VerificationBanner";
import { useAuth } from "@/contexts/AuthContext";
import { STAGE_META } from "@/lib/stage";
import CircleIdentityModal from "@/components/CircleIdentityModal";
import PhoneSetupSheet from "@/components/PhoneSetupSheet";
import StageTransitionModal from "@/components/StageTransitionModal";
import StageRefinementBanner from "@/components/StageRefinementBanner";


const CAT_BG: Record<string, string> = {
  "Feeding": "#e8f5f1", "Diapering": "#fff3e0", "Maternity": "#f3e5f5",
  "Clothing": "#e3f2fd", "Hygiene": "#e8f5e9", "Other": "#f5f5f5",
};
const CAT_EMOJI: Record<string, string> = {
  "Feeding": "🍼", "Diapering": "👶", "Maternity": "🤱",
  "Clothing": "👗", "Hygiene": "🧴", "Other": "📦",
};

function MissionCard() {
  const router = useRouter();
  const [membership, setMembership] = useState<{
    mission: { name: string; goalBlocks: number };
    team: { totalBlocks: number; members: Array<{ name: string; isMe: boolean }> };
  } | null | undefined>(undefined);

  useEffect(() => {
    fetch("/api/missions/my")
      .then(r => r.json())
      .then(d => setMembership(d.membership ?? null))
      .catch(() => setMembership(null));
  }, []);

  if (membership === undefined) return null;

  if (!membership) {
    return (
      <div
        onClick={() => router.push("/missions")}
        style={{ background: "#e8f5f1", borderRadius: 16, padding: "16px", marginBottom: 12, border: "1px solid #b7dfd1", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 28 }}>🤝</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "#1a7a5e", marginBottom: 2 }}>Join a mission</div>
            <div style={{ fontSize: 12, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", opacity: 0.85 }}>
              Team up with 5 donors. Fill 40 blocks. Fund real outcomes for mothers.
            </div>
          </div>
          <ChevronRight size={20} color="#9ca3af" />
        </div>
      </div>
    );
  }

  const { mission, team } = membership;
  const pct = Math.min(100, Math.round((team.totalBlocks / mission.goalBlocks) * 100));
  const displayMembers = [...team.members.slice(0, 5)];
  while (displayMembers.length < 5) displayMembers.push(null as unknown as { name: string; isMe: boolean });

  return (
    <div
      onClick={() => router.push("/missions/my")}
      style={{ background: "var(--white)", borderRadius: 16, padding: "16px", marginBottom: 12, border: "1px solid var(--border)", cursor: "pointer" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>{mission.name}</div>
          <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
            {team.totalBlocks}/{mission.goalBlocks} blocks · {pct}%
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: "#e8f5f1", color: "#1a7a5e" }}>Active</span>
          <ChevronRight size={20} color="#9ca3af" />
        </div>
      </div>
      <div style={{ background: "#e8e4de", borderRadius: 6, height: 6, marginBottom: 10, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#1a7a5e", borderRadius: 6, transition: "width 0.4s ease" }} />
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {displayMembers.map((m, i) => (
          <div key={i} style={{
            width: 30, height: 30, borderRadius: "50%",
            background: m === null ? "#e8e4de" : (m as { name: string; isMe: boolean }).isMe ? "#1a7a5e" : "#7bc4a4",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 800, fontFamily: "Nunito, sans-serif",
            color: m === null ? "#a0a0a0" : "white",
          }}>
            {m === null ? "?" : (m as { name: string; isMe: boolean }).name.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}

function ContributorCard() {
  const router = useRouter();
  const [hasMembership, setHasMembership] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    fetch("/api/profile/contributor")
      .then(r => r.json())
      .then(d => setHasMembership(d.hasMembership ?? false))
      .catch(() => setHasMembership(false));
  }, []);

  if (hasMembership === undefined) return null;

  return (
    <div
      onClick={hasMembership ? () => router.push("/profile/contributor") : undefined}
      style={{
        background: "linear-gradient(to right, #f5f3ff, #ede9ff)",
        borderRadius: 16, padding: "14px 16px", marginBottom: 12,
        border: "1px solid #d4cdf0",
        cursor: hasMembership ? "pointer" : "default",
        display: "flex", alignItems: "center", gap: 12,
        opacity: hasMembership ? 1 : 0.55,
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(109,90,205,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🤝</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "#5a47b8", marginBottom: 2 }}>Care Contributor Profile</div>
        <div style={{ fontSize: 12, color: "#6d5acd", fontFamily: "Nunito, sans-serif", opacity: 0.85 }}>
          {hasMembership ? "See your mission history & impact" : "Join a mission to unlock your contributor profile."}
        </div>
      </div>
      {hasMembership && <ChevronRight size={20} color="#9ca3af" />}
    </div>
  );
}

function DonorStatusCard() {
  const { user } = useAuth();

  const verified      = (user?.verificationLevel ?? 0) >= 1;
  const fullyVerified = (user?.verificationLevel ?? 0) >= 2;
  const label         = verified ? "Verified Donor" : "Donor";

  return (
    <div style={{ background: "white", borderRadius: 16, padding: "18px 16px", marginBottom: 12, border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Heart size={20} color="#1a7a5e" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "#1a1a1a" }}>{label}</div>
          <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginTop: 2 }}>
            {fullyVerified ? "Fully verified donor" : verified ? "Verified donor" : "Unverified — complete verification to unlock more"}
          </div>
        </div>
        {verified && (
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 16 }}>✓</span>
          </div>
        )}
      </div>
    </div>
  );
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

// ── Types ──────────────────────────────────────────────────────────────────────

interface MyItem {
  id: string; title: string; category: string;
  condition: string; quantity: string; images: string[];
  urgent: boolean; status: string;
}

interface Summary {
  role: string;
  requestsTotal?: number;
  requestsPending?: number;
  requestsFulfilled?: number;
  requestsCancelled?: number;
  registersCount?: number;
  itemsTotal?: number;
  itemsActive?: number;
  itemsFulfilled?: number;
  impactScore?: number;
  donorLevel?: string;
  totalFundedCents?: number;
  totalUsers?: number;
  pendingReports?: number;
  activeItems?: number;
  pendingDocuments?: number;
  bundlesPending?: number;
}

interface NotifPrefs {
  notifyNewPosts: boolean;
  notifyReplies: boolean;
  notifyThreadReplies: boolean;
  notifyBundleUpdates: boolean;
  notifyVerification: boolean;
}

// ── Manual Review Status Card ──────────────────────────────────────────────────

function ManualReviewStatusCard({ onSubmitSuccess }: { onSubmitSuccess: () => void }) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  if (!user || user.role !== "RECIPIENT") return null;

  const { manualReviewStatus: status, manualReviewRejectionReason: reason } = user;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res  = await fetch("/api/verify/manual-review/submit", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong. Please try again."); return; }
      onSubmitSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  // APPROVED — quiet success, no action needed
  if (status === "APPROVED") {
    return (
      <div style={{ background: "white", borderRadius: 16, padding: "16px", marginBottom: 12, border: "1.5px solid #bbf0db", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <ShieldCheck size={20} color="#1a7a5e" strokeWidth={1.75} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "#1a7a5e", marginBottom: 2 }}>Profile verified</div>
          <div style={{ fontSize: 12, color: "var(--mid)", lineHeight: 1.5 }}>Your profile has been confirmed by our team.</div>
        </div>
        <CheckCircle size={16} color="#1a7a5e" strokeWidth={2} style={{ flexShrink: 0 }} />
      </div>
    );
  }

  // PENDING — under review, no action
  if (status === "PENDING") {
    return (
      <div style={{ background: "var(--yellow-light)", borderRadius: 14, padding: "14px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Clock size={20} color="#b8860b" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#b8860b", marginBottom: 2 }}>Under review</div>
          <div style={{ fontSize: 12, color: "#7a5500", lineHeight: 1.5 }}>Your profile is being reviewed by our team. We'll notify you as soon as it's confirmed — this usually takes a short while.</div>
        </div>
      </div>
    );
  }

  // REJECTED — invite to resubmit, kind copy
  if (status === "REJECTED") {
    return (
      <div style={{ background: "var(--terra-light)", borderRadius: 14, padding: "14px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>💌</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--terra)", marginBottom: 3 }}>Needs another look</div>
          <div style={{ fontSize: 12, color: "var(--terra)", lineHeight: 1.5, marginBottom: 10 }}>
            {reason ?? "We'd love to take another look — please make sure your contact is verified and your photo is clear, then resubmit."}
          </div>
          {error && <div style={{ fontSize: 12, color: "var(--terra)", fontWeight: 700, marginBottom: 8 }}>{error}</div>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ fontSize: 12, fontWeight: 800, background: "var(--terra)", color: "white", border: "none", padding: "7px 16px", borderRadius: 20, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "Nunito, sans-serif", opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? "Submitting…" : "Resubmit for review"}
          </button>
        </div>
      </div>
    );
  }

  // NONE — not started, offer submission
  return (
    <div style={{ background: "var(--bg)", borderRadius: 14, padding: "14px 16px", marginBottom: 12, border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <ShieldCheck size={16} color="var(--mid)" strokeWidth={1.75} />
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>Get your profile verified</div>
      </div>
      <div style={{ fontSize: 12, color: "var(--mid)", lineHeight: 1.55, marginBottom: 12 }}>
        A quick review by our team confirms you're part of the community. You'll need a verified phone or email and a profile photo first.
      </div>
      {error && <div style={{ fontSize: 12, color: "var(--terra)", fontWeight: 700, marginBottom: 8 }}>{error}</div>}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        style={{ fontSize: 12, fontWeight: 800, background: "var(--green)", color: "white", border: "none", padding: "7px 16px", borderRadius: 20, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "Nunito, sans-serif", opacity: submitting ? 0.7 : 1 }}
      >
        {submitting ? "Submitting…" : "Submit for review"}
      </button>
    </div>
  );
}

// ── Identity Verification Card ─────────────────────────────────────────────────

function IdentityVerificationCard() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  if (!user || user.role !== "RECIPIENT") return null;

  const launch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/verify/persona/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong. Please try again."); return; }
      if (data.alreadyVerified) { await refreshUser(); return; }
      window.location.href = data.hostedUrl;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (user.identityVerified) {
    return (
      <div style={{ background: "white", borderRadius: 16, padding: "16px", marginBottom: 12, border: "1.5px solid #bbf0db", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <ShieldCheck size={20} color="#1a7a5e" strokeWidth={1.75} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "#1a7a5e", marginBottom: 2 }}>Identity verified</div>
          <div style={{ fontSize: 12, color: "var(--mid)", lineHeight: 1.5 }}>Your identity has been confirmed. You can receive shipments and apply for bundles.</div>
        </div>
        <CheckCircle size={16} color="#1a7a5e" strokeWidth={2} style={{ flexShrink: 0 }} />
      </div>
    );
  }

  if (user.personaStatus === "pending") {
    return (
      <div style={{ background: "var(--yellow-light)", borderRadius: 14, padding: "14px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Clock size={20} color="#b8860b" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#b8860b", marginBottom: 2 }}>Verification in progress</div>
          <div style={{ fontSize: 12, color: "#7a5500", lineHeight: 1.5 }}>We&apos;re reviewing your submission — this usually only takes a few minutes. You&apos;ll receive a notification once it&apos;s confirmed.</div>
        </div>
      </div>
    );
  }

  const needsRetry = user.personaStatus === "declined" || user.personaStatus === "failed" || user.personaStatus === "expired";

  if (needsRetry) {
    return (
      <div style={{ background: "var(--terra-light)", borderRadius: 14, padding: "14px 16px", marginBottom: 12, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <XCircle size={20} color="var(--terra)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--terra)", marginBottom: 3 }}>Needs another try</div>
          <div style={{ fontSize: 12, color: "var(--terra)", lineHeight: 1.5, marginBottom: 10 }}>
            We weren&apos;t able to complete your identity verification. Please try again — it only takes a few minutes.
          </div>
          {error && <div style={{ fontSize: 12, color: "var(--terra)", fontWeight: 700, marginBottom: 8 }}>{error}</div>}
          <button
            onClick={launch}
            disabled={loading}
            style={{ fontSize: 12, fontWeight: 800, background: "var(--terra)", color: "white", border: "none", padding: "7px 16px", borderRadius: 20, cursor: loading ? "not-allowed" : "pointer", fontFamily: "Nunito, sans-serif", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Starting…" : "Try again"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg)", borderRadius: 14, padding: "14px 16px", marginBottom: 12, border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <ShieldCheck size={16} color="var(--mid)" strokeWidth={1.75} />
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>Verify your identity</div>
      </div>
      <div style={{ fontSize: 12, color: "var(--mid)", lineHeight: 1.55, marginBottom: 12 }}>
        Identity verification unlocks shipment confirmations, bundle applications, and repeat item requests. It takes just a few minutes.
      </div>
      {error && <div style={{ fontSize: 12, color: "var(--terra)", fontWeight: 700, marginBottom: 8 }}>{error}</div>}
      <button
        onClick={launch}
        disabled={loading}
        style={{ fontSize: 12, fontWeight: 800, background: "var(--green)", color: "white", border: "none", padding: "7px 16px", borderRadius: 20, cursor: loading ? "not-allowed" : "pointer", fontFamily: "Nunito, sans-serif", opacity: loading ? 0.7 : 1 }}
      >
        {loading ? "Starting…" : "Verify your identity →"}
      </button>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();

  const [toast,           setToast]           = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [summary,         setSummary]         = useState<Summary | null>(null);
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationInput,   setLocationInput]   = useState("");

  // Modals
  const [showPhoneSetup,    setShowPhoneSetup]    = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);

  // OTP (for email verification from VerificationBanner)
  const [showVerify,    setShowVerify]    = useState(false);
  const [verifyType,    setVerifyType]    = useState<"PHONE" | "EMAIL">("PHONE");
  const [otpStep,       setOtpStep]       = useState<"send" | "confirm">("send");
  const [otpCode,       setOtpCode]       = useState("");
  const [devOtp,        setDevOtp]        = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Donor-only
  const [myItems,         setMyItems]         = useState<MyItem[]>([]);
  const [itemTab,         setItemTab]         = useState<"active" | "all">("active");
  const [showDonate,      setShowDonate]      = useState(false);
  const [showShareImpact, setShowShareImpact] = useState(false);
  const [notifPrefs,      setNotifPrefs]      = useState<NotifPrefs | null>(null);
  const [savingPrefs,     setSavingPrefs]     = useState(false);

  // Stage transition countdown
  const [transitionStatus, setTransitionStatus] = useState<null | {
    applicable: boolean; daysUntil: number | null; nextStageKey: string | null;
    nextStageName: string | null; currentStageKey: string | null;
    transitionDate: string | null; hasSeenTransitionModal: boolean;
    showSurveyBanner: boolean; journeyType: "pregnant" | "postpartum";
    currentStageName: string | null; currentStageDesc: string | null;
    nextStageDesc: string | null;
  }>(null);
  const [showTransitionModal, setShowTransitionModal] = useState(false);

  useEffect(() => {
    if (!user) router.push("/auth");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/profile/summary").then(r => r.json()).then(d => setSummary(d)).catch(() => {});
    if (user.journeyType === "donor") {
      fetch("/api/notifications/preferences").then(r => r.json()).then(d => setNotifPrefs(d.prefs ?? null)).catch(() => {});
    }
    if (user.journeyType && user.journeyType !== "donor" && user.onboardingComplete) {
      fetch("/api/user/transition-status")
        .then(r => r.json())
        .then(d => { if (d.applicable) setTransitionStatus(d); })
        .catch(() => {});
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchItems = useCallback(async () => {
    if (!user) return;
    const r = await fetch(`/api/items?donorId=${user.id}`);
    if (r.ok) { const d = await r.json(); setMyItems(d.items ?? []); }
  }, [user]);

  useEffect(() => {
    if (!user || user.journeyType !== "donor") return;
    fetchItems();
  }, [user, fetchItems]);

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
    setToast(`${verifyType === "PHONE" ? "Phone" : "Email"} verified.`);
    setVerifyLoading(false);
  };

  if (!user) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;

  const isAdmin  = user.role === "ADMIN";
  const isDonor  = user.journeyType === "donor";
  const memberYear = new Date(user.createdAt).getFullYear();

  const visibleItems = itemTab === "active" ? myItems.filter(i => i.status === "ACTIVE") : myItems;

  const headerLabel = isAdmin ? "Admin" : isDonor ? "Supporter" : "Community Member";

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
    <div className="profile-desktop-wrap">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <div className="profile-hero" style={{ position: "relative" }}>
        {/* Settings gear */}
        <button
          onClick={() => router.push("/profile/settings")}
          style={{
            position: "absolute", top: 14, right: 14,
            background: "rgba(255,255,255,0.18)", border: "none", borderRadius: 10,
            padding: "8px", cursor: "pointer", display: "flex", alignItems: "center",
          }}
        >
          <Settings size={18} color="white" />
        </button>

        {/* Avatar */}
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
        <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.75)", marginTop: 4, letterSpacing: "0.3px" }}>
          {headerLabel}
        </div>

        {/* Location + stage pill (non-admin) */}
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
                {user.location ?? "Add your location"}
              </span>
            )}
            {user.currentStage && STAGE_META[user.currentStage as keyof typeof STAGE_META] && (
              <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", background: "rgba(255,255,255,0.15)", borderRadius: 20, padding: "5px 14px" }}>
                <span style={{ fontSize: 12, color: "white", fontWeight: 700 }}>{STAGE_META[user.currentStage as keyof typeof STAGE_META].label}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div className="profile-body">

        {/* ════════════ ADMIN VIEW ════════════════════════════════════════ */}
        {isAdmin && (
          <>
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              {([
                { icon: Users,       label: "Active Users",     val: summary?.totalUsers,       color: "#1a7a5e", bg: "#e8f5f1" },
                { icon: Flag,        label: "Pending Reports",  val: summary?.pendingReports,   color: "#c0392b", bg: "#fdecea" },
                { icon: FileText,    label: "Pending Docs",     val: summary?.pendingDocuments, color: "#d97706", bg: "#fff8ed" },
                { icon: Package,     label: "Bundles Pending",  val: summary?.bundlesPending,   color: "#6366f1", bg: "#eef2ff" },
              ] as { icon: LucideIcon; label: string; val: number | undefined; color: string; bg: string }[]).map(({ icon: Icon, label, val, color, bg }) => (
                <div key={label} style={{ background: "white", borderRadius: 14, padding: "16px 14px", border: "1px solid var(--border)" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <Icon size={18} color={color} />
                  </div>
                  <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: "#1a1a1a" }}>{val ?? "—"}</div>
                  <div style={{ fontSize: 12, color: "#555", fontFamily: "Nunito, sans-serif", marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "white", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 16 }}>
              <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>Quick actions</span>
              </div>
              {([
                { icon: FileText,    label: "Review Documents", sub: "Pending verifications", path: "/admin/verification" },
                { icon: Flag,        label: "Review Reports",   sub: "Flagged content",       path: "/admin/reports"      },
                { icon: Package,     label: "Manage Bundles",   sub: "Care bundle dispatch",  path: "/admin/bundles"      },
                { icon: Users,       label: "Manage Users",     sub: "User trust & access",   path: "/admin/users"        },
              ] as { icon: LucideIcon; label: string; sub: string; path: string }[]).map(({ icon: Icon, label, sub, path }) => (
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

            <MissionCard />
          </>
        )}

        {/* ════════════ DONOR VIEW ════════════════════════════════════════ */}
        {!isAdmin && isDonor && (
          <>
            <DonorStatusCard />
            <MissionCard />
            <ContributorCard />

            {/* Monthly Impact card */}
            <div
              onClick={() => router.push("/profile/impact")}
              style={{ background: "linear-gradient(135deg, #faf8f3 0%, #e8f5f1 100%)", borderRadius: 16, padding: "14px 16px", marginBottom: 12, border: "1px solid #b7dfd1", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(26,122,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🛡️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>Your monthly impact</div>
                <div style={{ fontSize: 12, color: "#5a9a72", fontFamily: "Nunito, sans-serif" }}>See how Kradel turned care into action this month</div>
              </div>
              <ChevronRight size={20} color="#9ca3af" />
            </div>

            {(summary?.itemsTotal ?? 0) > 0 && (
              <button
                onClick={() => setShowShareImpact(true)}
                style={{ width: "100%", marginBottom: 12, padding: "12px 24px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #1a7a5e, #22a37c)", color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
              >
                ✨ Share your impact
              </button>
            )}

            {/* My Items */}
            <div className="profile-section">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div className="profile-section-title" style={{ marginBottom: 0 }}>My Items</div>
                <button onClick={() => setShowDonate(true)} style={{ background: "var(--green)", color: "white", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>+ List item</button>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {(["active", "all"] as const).map(t => (
                  <button key={t} onClick={() => setItemTab(t)} style={{
                    padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                    border: "1.5px solid", fontFamily: "Nunito, sans-serif", cursor: "pointer",
                    borderColor: itemTab === t ? "#1a7a5e" : "var(--border)",
                    background: itemTab === t ? "#e8f5f1" : "white",
                    color: itemTab === t ? "#1a7a5e" : "var(--mid)",
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

            {[
              { icon: Gift,  label: "My Favourites",          sub: "Items you've saved",              path: "/favourites"           },
              { icon: Crown, label: "Bundle Contributions",   sub: "Care bundles you've supported",  path: "/bundles/contributions" },
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

            {notifPrefs && (
              <div className="profile-section">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div className="profile-section-title" style={{ marginBottom: 0 }}>Notification preferences</div>
                  {savingPrefs && <span style={{ fontSize: 11, color: "var(--mid)" }}>Saving…</span>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {([
                    { key: "notifyBundleUpdates" as const, label: "Bundle updates", desc: "When a bundle you contributed to is dispatched" },
                    { key: "notifyReplies"        as const, label: "Circle replies", desc: "When someone replies to your circle posts"      },
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

            <div style={{ background: "var(--white)", borderRadius: 16, border: "1px solid #e0e0e0", padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <Heart size={20} color="#1a7a5e" strokeWidth={1.75} />
                <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>Support Kradəl</div>
              </div>
              <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: "var(--mid)", marginBottom: 14, lineHeight: 1.5 }}>
                Help keep the platform running for mothers who need it.
              </div>
              <button onClick={() => router.push("/support")} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "none", background: "#1a7a5e", color: "#fff", fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                Contribute to operations →
              </button>
            </div>
          </>
        )}

        {/* ════════════ RECIPIENT VIEW ═════════════════════════════════════ */}
        {!isAdmin && !isDonor && (
          <>
            {/* Stage countdown card — compact status indicator */}
            {transitionStatus?.daysUntil !== null && transitionStatus?.daysUntil !== undefined &&
             transitionStatus.daysUntil >= 0 && transitionStatus.daysUntil <= 30 &&
             transitionStatus.nextStageKey && (
              <div
                onClick={() => setShowTransitionModal(true)}
                style={{
                  background: "#e8f5f1", borderRadius: 14, padding: "12px 14px",
                  marginBottom: 14, display: "flex", alignItems: "center", gap: 12,
                  border: "1.5px solid #b7dfd1", cursor: "pointer",
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: "#b7dfd1",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Calendar size={17} color="#1a7a5e" strokeWidth={1.75} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 800, color: "#1a7a5e",
                    fontFamily: "Nunito, sans-serif", lineHeight: 1.2,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {transitionStatus.daysUntil} {transitionStatus.daysUntil === 1 ? "day" : "days"} to {transitionStatus.nextStageName}
                  </div>
                  <div style={{ fontSize: 11, color: "#1a7a5e", opacity: 0.65, fontFamily: "Nunito, sans-serif", marginTop: 2 }}>
                    Transition on {transitionStatus.transitionDate
                      ? new Date(transitionStatus.transitionDate).toLocaleDateString("en", { month: "short", day: "numeric" })
                      : "—"}
                  </div>
                </div>
                <ChevronRight size={16} color="#1a7a5e" style={{ flexShrink: 0 }} />
              </div>
            )}

            {/* Day-7 refinement survey banner */}
            {transitionStatus?.showSurveyBanner && (
              <StageRefinementBanner
                journeyType={transitionStatus.journeyType}
                onCompleted={() => setTransitionStatus(prev => prev ? { ...prev, showSurveyBanner: false, surveyCompleted: true } : prev)}
              />
            )}

            <VerificationBanner
              onVerifyPhone={() => { setVerifyType("PHONE"); setOtpStep("send"); setOtpCode(""); setDevOtp(null); setShowVerify(true); }}
              onVerifyEmail={() => { setVerifyType("EMAIL"); setOtpStep("send"); setOtpCode(""); setDevOtp(null); setShowVerify(true); }}
            />

            {user.accountHold && (
              <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 14, padding: "14px 16px", marginBottom: 12, display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ fontSize: 18, lineHeight: 1 }}>ℹ️</div>
                <div>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 14, color: "#92400e", marginBottom: 4 }}>Account review in progress</div>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: "#78350f", lineHeight: 1.55 }}>
                    We need to confirm a few details before you can receive items or apply for bundles. Our team will be in touch — thank you for your patience.
                  </div>
                </div>
              </div>
            )}

            <ManualReviewStatusCard onSubmitSuccess={refreshUser} />

            <IdentityVerificationCard />

            {/* My Requests summary card */}
            <div style={{ background: "white", borderRadius: 16, padding: "16px", marginBottom: 12, border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>My Requests</div>
                <button
                  onClick={() => router.push("/profile/requests")}
                  style={{ fontSize: 12, fontWeight: 800, color: "#1a7a5e", background: "none", border: "none", cursor: "pointer", fontFamily: "Nunito, sans-serif", display: "flex", alignItems: "center", gap: 2 }}
                >
                  View all <ChevronRight size={13} strokeWidth={2.5} />
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {([
                  { label: "All",       count: summary?.requestsTotal     ?? 0, Icon: FileText,    color: "#1a7a5e", bg: "#e8f5f1" },
                  { label: "Pending",   count: summary?.requestsPending   ?? 0, Icon: Clock,       color: "#d97706", bg: "#fff8ed" },
                  { label: "Fulfilled", count: summary?.requestsFulfilled ?? 0, Icon: CheckCircle, color: "#16a34a", bg: "#f0fdf4" },
                  { label: "Cancelled", count: summary?.requestsCancelled ?? 0, Icon: XCircle,     color: "#9ca3af", bg: "#f5f5f5" },
                ] as { label: string; count: number; Icon: LucideIcon; color: string; bg: string }[]).map(({ label, count, Icon, color, bg }) => (
                  <div key={label} style={{ background: bg, borderRadius: 12, padding: "10px 6px", textAlign: "center" }}>
                    <Icon size={15} color={color} strokeWidth={1.75} style={{ marginBottom: 4 }} />
                    <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{count}</div>
                    <div style={{ fontSize: 10, color, fontWeight: 700, fontFamily: "Nunito, sans-serif", marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Circle identity */}
            {user.journeyType && (
              <div style={{ background: "white", borderRadius: 16, padding: "16px", marginBottom: 12, border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--mid)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10 }}>Circle identity</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {user.circleIdentitySet ? (
                    <div style={{
                      display: "inline-flex", alignItems: "center",
                      background: "#e8f5f1", border: "1.5px solid #a7d9c8",
                      borderRadius: 20, padding: "6px 14px",
                      fontSize: 13, fontWeight: 700, color: "#1a7a5e",
                    }}>
                      {user.circleContext ? `${user.circleContext} · ` : ""}{user.circleDisplayName?.trim() || user.name.split(" ")[0]}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: "var(--mid)", fontStyle: "italic" }}>Not set — your first name is shown by default</div>
                  )}
                  <button
                    onClick={() => setShowIdentityModal(true)}
                    style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: "var(--green)", background: "var(--green-light)", border: "none", padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "Nunito, sans-serif", flexShrink: 0 }}
                  >
                    {user.circleIdentitySet ? "Edit" : "Set up"}
                  </button>
                </div>
              </div>
            )}

            {/* Your support journey */}
            <div
              onClick={() => router.push("/journey")}
              style={{ background: "white", borderRadius: 16, padding: "16px", marginBottom: 12, border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Heart size={20} color="#7c3aed" strokeWidth={1.75} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>Your support journey</div>
                <div style={{ fontSize: 12, color: "var(--mid)" }}>You&apos;re not alone. We&apos;re here with you every step of the way.</div>
              </div>
              <ChevronRight size={18} color="#9ca3af" />
            </div>

            {/* Circle connection */}
            <div
              onClick={() => router.push(user.currentCircleId ? `/circles/${user.currentCircleId}` : "/circles")}
              style={{ background: "white", borderRadius: 16, padding: "16px", marginBottom: 12, border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Users size={20} color="#ea580c" strokeWidth={1.75} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>Circle connection</div>
                <div style={{ fontSize: 12, color: "var(--mid)" }}>You&apos;re part of a safe space to share, learn, and grow together.</div>
              </div>
              <ChevronRight size={18} color="#9ca3af" />
            </div>

            {/* Need help */}
            <div style={{ background: "white", borderRadius: 16, padding: "16px", marginBottom: 12, border: "1px solid var(--border)" }}>
              <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Need help or have questions?</div>
              <div style={{ fontSize: 12, color: "var(--mid)", marginBottom: 14, lineHeight: 1.5 }}>Our support team is here for you. We usually respond within 24 hours.</div>
              <a
                href="mailto:support@kradel.com"
                style={{ display: "block", width: "100%", padding: "12px", borderRadius: 12, border: "1.5px solid #1a7a5e", background: "white", color: "#1a7a5e", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif", textAlign: "center", textDecoration: "none" }}
              >
                Contact Support
              </a>
            </div>
          </>
        )}

        {/* Spacer for bottom nav */}
        <div style={{ height: 24 }} />
      </div>
    </div>

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
                  Dev mode — code: <strong>{devOtp}</strong>
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
    {showDonate      && <DonateModal onClose={() => setShowDonate(false)} onSubmit={handleDonate} />}
    {showShareImpact && <ShareImpactModal onClose={() => setShowShareImpact(false)} />}
    {showIdentityModal && <CircleIdentityModal onDone={() => { setShowIdentityModal(false); refreshUser(); }} />}
    {showTransitionModal && transitionStatus && transitionStatus.daysUntil !== null && transitionStatus.nextStageKey && transitionStatus.currentStageKey && user.currentCircleId && (
      <StageTransitionModal
        status={{
          currentStageKey:  transitionStatus.currentStageKey,
          currentStageName: transitionStatus.currentStageName ?? "",
          currentStageDesc: transitionStatus.currentStageDesc ?? "",
          nextStageKey:     transitionStatus.nextStageKey,
          nextStageName:    transitionStatus.nextStageName ?? "",
          nextStageDesc:    transitionStatus.nextStageDesc ?? "",
          daysUntil:        transitionStatus.daysUntil,
          transitionDate:   transitionStatus.transitionDate ?? "",
        }}
        circleId={user.currentCircleId}
        onDismiss={() => {
          setShowTransitionModal(false);
          setTransitionStatus(prev => prev ? { ...prev, hasSeenTransitionModal: true } : prev);
        }}
      />
    )}
    {showPhoneSetup && (
      <PhoneSetupSheet
        existingPhone={user.phone}
        onClose={() => setShowPhoneSetup(false)}
        onSuccess={async () => { setShowPhoneSetup(false); await refreshUser(); setToast("Phone number verified ✓"); }}
      />
    )}
    <Toast message={toast} onClose={() => setToast(null)} />
  </div>
  );
}
