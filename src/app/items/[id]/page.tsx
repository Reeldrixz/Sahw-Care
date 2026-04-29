"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import Toast from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/Avatar";
import {
  ArrowLeft, Heart, Share2, MoreVertical, ShieldCheck,
  Eye, EyeOff, Trash2, Snowflake, ScrollText,
  Pencil, Flag, CheckCircle, X,
} from "lucide-react";

interface Item {
  id: string;
  title: string;
  category: string;
  condition: string;
  quantity: string;
  location: string;
  description: string | null;
  images: string[];
  urgent: boolean;
  status: string;
  adminBlurred: boolean;
  donorId: string;
  donor: { id: string; name: string; avatar: string | null; trustRating: number; location: string | null; verificationLevel?: number };
  _count: { requests: number };
}

interface Review {
  id: string;
  pickupRating: number;
  qualityRating: number;
  quantityRating: number;
  comment: string | null;
  createdAt: string;
  reviewer: { id: string; name: string; avatar: string | null };
}

const CAT_BG: Record<string, string> = {
  "Feeding": "#e8f5f1", "Diapering": "#fff3e0", "Maternity": "#f3e5f5",
  "Clothing": "#e3f2fd", "Hygiene": "#e8f5e9", "Recovery": "#fdf2f8",
  "Travel": "#f0f9ff", "Other": "#f5f5f5",
};

const CONDITIONS: Record<string, string> = {
  "NEW": "New", "SEALED": "Sealed", "GENTLY_USED": "Gently used",
  "OPENED_SAFE": "Opened but safe",
  "New (unopened)": "New", "Slightly used": "Gently used",
};

function conditionLabel(c: string): string {
  return CONDITIONS[c] ?? c;
}

function RatingBar({ label, value, wide }: { label: string; value: number; wide?: boolean }) {
  return (
    <div className="rating-row">
      <div className="rating-label" style={wide ? { width: 130 } : {}}>{label}</div>
      <div className="rating-bar-wrap">
        <div className="rating-bar" style={{ width: `${(value / 5) * 100}%` }} />
      </div>
      <div className="rating-num">{value.toFixed(1)}</div>
    </div>
  );
}

const FIELD: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 12,
  background: "#f5f5f5", border: "1.5px solid transparent",
  fontSize: 14, fontFamily: "Nunito, sans-serif", color: "#1a1a1a",
  outline: "none", boxSizing: "border-box",
};
const EDIT_CATEGORIES = ["Feeding", "Hygiene", "Clothing", "Recovery", "Travel", "Maternity", "Diapering"];
const EDIT_CONDITIONS = [
  { value: "NEW", label: "New" }, { value: "SEALED", label: "Sealed" },
  { value: "GENTLY_USED", label: "Gently used" }, { value: "OPENED_SAFE", label: "Opened but safe" },
];

export default function ItemDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<Item | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRatings, setAvgRatings] = useState({ pickup: 0, quality: 0, quantity: 0 });
  const [fav, setFav] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [requested, setRequested] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Sheets
  const [showVerifSheet, setShowVerifSheet] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({ title: "", category: "", condition: "", quantity: "", location: "", description: "" });
  const [editLoading, setEditLoading] = useState(false);

  const isOwnItem = !!user && item?.donorId === user.id;
  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    fetch(`/api/items/${id}`)
      .then((r) => r.json())
      .then((d) => { setItem(d.item); setLoading(false); });
  }, [id]);

  // Load fav state
  useEffect(() => {
    if (!user || !item) return;
    fetch("/api/favourites")
      .then((r) => r.json())
      .then((d) => { if (d.itemIds?.includes(item.id)) setFav(true); });
  }, [user, item]);

  // Load donor reviews
  useEffect(() => {
    if (!item) return;
    fetch(`/api/users/${item.donor.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.reviewsReceived) setReviews(d.user.reviewsReceived);
        if (d.ratings) setAvgRatings(d.ratings);
      });
  }, [item]);

  const handleRequest = async () => {
    if (!user) { router.push(`/auth?next=/items/${id}`); return; }
    if (!item) return;
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id }),
    });
    if (res.ok) {
      setRequested(true);
      setToast("Request sent! Donor will review and reach out 🎉");
    } else {
      const d = await res.json();
      setToast(d.error ?? "Something went wrong");
    }
  };

  const handleFav = useCallback(async () => {
    if (!user) { router.push(`/auth?next=/items/${id}`); return; }
    if (favLoading) return;
    setFav((f) => !f); // optimistic
    setFavLoading(true);
    try {
      const res = await fetch(`/api/items/${id}/favourite`, { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        setFav(d.favourited);
        setToast(d.favourited ? "Saved to your list" : "Removed from saved");
      } else {
        setFav((f) => !f); // revert
      }
    } finally {
      setFavLoading(false);
    }
  }, [user, id, favLoading, router]);

  const handleShare = async () => {
    const url = `${window.location.origin}/items/${id}`;
    if (navigator.share) {
      await navigator.share({ title: item?.title, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      setToast("Link copied!");
    }
  };

  const handleMarkUnavailable = async () => {
    if (!item) return;
    const res = await fetch(`/api/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REMOVED" }),
    });
    if (res.ok) setToast("Listing marked as unavailable.");
    setShowMenu(false);
  };

  const handleAdminAction = async (action: "blur" | "remove" | "freeze") => {
    if (!item) return;
    setShowMenu(false);
    let body: Record<string, unknown> = {};
    if (action === "blur")   body = { adminBlurred: true };
    if (action === "remove") body = { status: "REMOVED" };
    if (action === "freeze") body = { status: "FROZEN" };
    const res = await fetch(`/api/admin/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const d = await res.json();
      setItem((prev) => prev ? { ...prev, ...d.item } : prev);
      setToast(action === "blur" ? "Item blurred — under review" : action === "freeze" ? "Listing frozen" : "Listing removed");
    }
  };

  const openEdit = () => {
    if (!item) return;
    setEditForm({
      title: item.title,
      category: item.category,
      condition: item.condition,
      quantity: item.quantity,
      location: item.location,
      description: item.description ?? "",
    });
    setShowMenu(false);
    setShowEditSheet(true);
  };

  const handleEditSubmit = async () => {
    if (!item || editLoading) return;
    setEditLoading(true);
    const res = await fetch(`/api/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      const d = await res.json();
      setItem((prev) => prev ? { ...prev, ...d.item } : prev);
      setShowEditSheet(false);
      setToast("Listing updated!");
    } else {
      const d = await res.json();
      setToast(d.error ?? "Update failed");
    }
    setEditLoading(false);
  };

  const handleHide = () => {
    if (!item) return;
    const hidden: string[] = JSON.parse(localStorage.getItem("kradel_hidden_items") ?? "[]");
    if (!hidden.includes(item.id)) {
      localStorage.setItem("kradel_hidden_items", JSON.stringify([...hidden, item.id]));
    }
    setShowMenu(false);
    setToast("This item won't appear in your feed.");
  };

  const handleDeleteItem = async () => {
    if (!item || !confirm("Delete this listing? This cannot be undone.")) return;
    const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    if (res.ok) { router.push("/"); }
    else setToast("Delete failed");
    setShowMenu(false);
  };

  if (loading) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;
  if (!item) return (
    <div className="empty" style={{ minHeight: "100vh" }}>
      <div className="empty-icon">😕</div>
      <div className="empty-title">Item not found</div>
      <button style={{ marginTop: 16, color: "var(--green)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }} onClick={() => router.back()}>Go back</button>
    </div>
  );

  const bg = CAT_BG[item.category] ?? "#f5f5f5";
  const isVerified = (item.donor.verificationLevel ?? 0) >= 1;

  // ── Bottom bar content ────────────────────────────────────────────────────
  const BottomBar = ({ desktop }: { desktop?: boolean }) => {
    if (isOwnItem && !isAdmin) {
      return (
        <div className={desktop ? "reserve-bar" : "reserve-bar"} style={{ display: "flex", gap: 10 }}>
          <button
            onClick={openEdit}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", background: "#f5f5f5", border: "none", borderRadius: 12, fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 14, color: "#1a1a1a", cursor: "pointer" }}
          >
            <Pencil size={16} />
            Edit listing
          </button>
          <button
            onClick={handleMarkUnavailable}
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", background: "#fff8ed", border: "1.5px solid #f59e0b", borderRadius: 12, fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 14, color: "#d97706", cursor: "pointer" }}
          >
            <EyeOff size={16} />
            Mark unavailable
          </button>
        </div>
      );
    }
    return (
      <div className="reserve-bar">
        <button className={`btn-big ${requested ? "done" : ""}`} onClick={handleRequest} disabled={requested}>
          {requested ? "✓ Request Sent — Awaiting donor" : "Request this item — Free"}
        </button>
      </div>
    );
  };

  // ── Shared detail body ────────────────────────────────────────────────────
  const DetailBody = ({ desktop }: { desktop?: boolean }) => (
    <div className="detail-body">
      <span className="detail-cat">{item.category}</span>
      <div className="detail-title">{item.title}</div>
      <div className="detail-meta-row">📦 <strong>{item.quantity}</strong> available · <strong>{conditionLabel(item.condition)}</strong></div>
      <div className="detail-meta-row">👥 <strong>{item._count.requests}</strong> people interested</div>

      <div className="detail-divider" />
      <div className="detail-section-title">What you&apos;ll get</div>
      <div className="detail-desc">{item.description ?? "No description provided."}</div>

      <div className="detail-divider" />
      <div className="detail-section-title">Pickup location</div>
      <div className="detail-location-row" onClick={() => setToast("Exact location shared after approval")}>
        <div className="detail-location-icon">📍</div>
        <div className="detail-location-text">
          <div className="detail-location-main">{item.location}</div>
          <div className="detail-location-sub">Exact address shared after approval</div>
        </div>
        <div className="detail-location-arrow">›</div>
      </div>

      <div className="detail-divider" />
      <div className="detail-section-title">About the donor</div>
      <div className="donor-card" onClick={() => router.push(`/donors/${item.donor.id}`)}>
        <div className="donor-avatar-lg" style={{ overflow: "hidden" }}>
          <Avatar src={item.donor.avatar} name={item.donor.name} size={48} />
        </div>
        <div className="donor-info">
          <div className="donor-name-lg">{item.donor.name}</div>
          <div className="donor-stats">
            <div className="donor-stat">⭐ {item.donor.trustRating.toFixed(1)}</div>
            <div className="donor-stat">📍 {item.donor.location ?? item.location}</div>
          </div>
        </div>
        {isVerified && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowVerifSheet(true); }}
            style={{ background: "#e8f5f1", border: "none", borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 800, color: "#1a7a5e", cursor: "pointer", fontFamily: "Nunito, sans-serif", flexShrink: 0 }}
          >
            ✓ Kradəl verified
          </button>
        )}
        <div className="donor-arrow">›</div>
      </div>

      {(avgRatings.pickup > 0 || avgRatings.quality > 0) && (
        <>
          <div className="detail-divider" />
          <div className="detail-section-title">Experience ratings</div>
          <RatingBar label="Pickup" value={avgRatings.pickup} />
          <RatingBar label="Quality" value={avgRatings.quality} />
          <RatingBar label="Quantity" value={avgRatings.quantity} />
        </>
      )}

      {reviews.length > 0 && (
        <>
          <div className="detail-divider" />
          <div className="detail-section-title">Reviews</div>
          {reviews.slice(0, 3).map((r) => {
            const avg = ((r.pickupRating + r.qualityRating + r.quantityRating) / 3).toFixed(1);
            const time = new Date(r.createdAt).toLocaleDateString([], { month: "short", day: "numeric" });
            return (
              <div key={r.id} className="review-item">
                <div className="review-header">
                  <Avatar src={r.reviewer.avatar} name={r.reviewer.name} size={32} />
                  <div>
                    <div className="review-name">{r.reviewer.name}</div>
                    <div className="review-stars">{"⭐".repeat(Math.round(parseFloat(avg)))}</div>
                  </div>
                  <div className="review-time">{time}</div>
                </div>
                {r.comment && <div className="review-text">{r.comment}</div>}
              </div>
            );
          })}
        </>
      )}

      {desktop && <BottomBar desktop />}
    </div>
  );

  return (
    <div className="detail">
      {/* ── Mobile layout ─────────────────────────────────────────────────── */}
      <div className="detail-mobile-view">
        <div className="detail-hero" style={{ background: bg }}>
          <button className="detail-back" onClick={() => router.back()}><ArrowLeft size={18} /></button>
          <button className="detail-share" onClick={handleShare} style={{ right: 100 }}><Share2 size={18} /></button>
          <button className="detail-fav" style={{ right: 56 }} onClick={handleFav}>
            <Heart size={18} fill={fav ? "#e11d48" : "none"} color={fav ? "#e11d48" : "white"} strokeWidth={2} />
          </button>
          <button
            onClick={() => setShowMenu(true)}
            style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.35)", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10 }}
          >
            <MoreVertical size={18} color="white" />
          </button>
          {item.urgent && <div className="detail-qty-badge">⚡ Urgent</div>}
          {item.images[0] ? (
            <Image
              src={item.images[0]} alt={item.title} fill
              style={{ objectFit: "cover", filter: item.adminBlurred ? "blur(8px)" : undefined }}
              sizes="430px"
            />
          ) : (
            <span style={{ fontSize: 80 }}>📦</span>
          )}
          {item.adminBlurred && (
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "#d97706", color: "white", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 800, fontFamily: "Nunito, sans-serif" }}>
              Under review
            </div>
          )}
        </div>

        <div style={{ overflowY: "auto", height: "calc(100vh - 260px)", paddingBottom: 100 }}>
          <DetailBody />
        </div>
        <BottomBar />
      </div>

      {/* ── Desktop layout ─────────────────────────────────────────────────── */}
      <div className="detail-desktop-view">
        <div className="detail-desktop-wrap">
          <div>
            <button className="detail-back" style={{ position: "relative", top: "auto", left: "auto", marginBottom: 12, display: "flex" }} onClick={() => router.back()}><ArrowLeft size={18} /></button>
            <div className="detail-hero" style={{ background: bg, position: "relative" }}>
              <button className="detail-share" onClick={handleShare} style={{ right: 100 }}><Share2 size={18} /></button>
              <button className="detail-fav" style={{ right: 56 }} onClick={handleFav}>
                <Heart size={18} fill={fav ? "#e11d48" : "none"} color={fav ? "#e11d48" : "white"} strokeWidth={2} />
              </button>
              <button
                onClick={() => setShowMenu(true)}
                style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.35)", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10 }}
              >
                <MoreVertical size={18} color="white" />
              </button>
              {item.urgent && <div className="detail-qty-badge">⚡ Urgent</div>}
              {item.images[0] ? (
                <Image
                  src={item.images[0]} alt={item.title} fill
                  style={{ objectFit: "cover", filter: item.adminBlurred ? "blur(8px)" : undefined }}
                  sizes="500px"
                />
              ) : (
                <span style={{ fontSize: 80 }}>📦</span>
              )}
              {item.adminBlurred && (
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "#d97706", color: "white", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 800, fontFamily: "Nunito, sans-serif" }}>
                  Under review
                </div>
              )}
            </div>
          </div>
          <div>
            <DetailBody desktop />
          </div>
        </div>
      </div>

      {/* ── Verification sheet ──────────────────────────────────────────────── */}
      {showVerifSheet && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowVerifSheet(false)}>
          <div style={{ background: "white", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, padding: "24px 20px 44px", animation: "sheetUp 0.25s ease" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "#e5e7eb", borderRadius: 4, margin: "0 auto 20px" }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
              <ShieldCheck size={32} color="#1a7a5e" strokeWidth={1.5} style={{ marginBottom: 10 }} />
              <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "#1a1a1a", textAlign: "center" }}>What does verified mean?</div>
            </div>
            {[
              "This donor's identity has been reviewed by the Kradəl team.",
              "They have completed phone and email verification.",
              "Their listing has passed our basic review process.",
            ].map((text, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
                <CheckCircle size={16} color="#1a7a5e" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
            <div style={{ fontSize: 12, color: "#9ca3af", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, marginTop: 8 }}>
              Verification does not guarantee item condition. Always confirm details in chat before arranging pickup.
            </div>
            <button onClick={() => setShowVerifSheet(false)} style={{ marginTop: 20, width: "100%", padding: "12px", background: "#f5f5f5", border: "none", borderRadius: 12, fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 14, color: "#1a1a1a", cursor: "pointer" }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── 3-dot menu sheet ────────────────────────────────────────────────── */}
      {showMenu && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowMenu(false)}>
          <div style={{ background: "white", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, padding: "20px 0 40px", animation: "sheetUp 0.25s ease" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "#e5e7eb", borderRadius: 4, margin: "0 auto 16px" }} />

            {/* Common actions */}
            {[
              { icon: Flag, label: "Report this listing", color: "#ef4444", action: () => { setShowMenu(false); setShowReportSheet(true); } },
              { icon: Share2, label: "Share", color: "#555555", action: () => { setShowMenu(false); handleShare(); } },
              { icon: EyeOff, label: "Hide this item", color: "#555555", action: handleHide },
            ].map(({ icon: Icon, label, color, action }) => (
              <button key={label} onClick={action} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "14px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                <Icon size={18} color={color} strokeWidth={1.5} />
                <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, color: "#1a1a1a" }}>{label}</span>
              </button>
            ))}

            {/* Owner-only actions */}
            {isOwnItem && !isAdmin && (
              <>
                <div style={{ height: 1, background: "#f3f4f6", margin: "4px 0" }} />
                <div style={{ padding: "8px 20px 4px", fontSize: 11, fontWeight: 700, color: "#9ca3af", fontFamily: "Nunito, sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>Your listing</div>
                {[
                  { icon: Pencil, label: "Edit listing", color: "#1a7a5e", action: openEdit },
                  { icon: EyeOff, label: "Mark unavailable", color: "#d97706", action: handleMarkUnavailable },
                  { icon: Trash2, label: "Delete listing", color: "#ef4444", action: handleDeleteItem },
                ].map(({ icon: Icon, label, color, action }) => (
                  <button key={label} onClick={action} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "14px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                    <Icon size={18} color={color} strokeWidth={1.5} />
                    <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, color: "#1a1a1a" }}>{label}</span>
                  </button>
                ))}
              </>
            )}

            {/* Admin-only actions */}
            {isAdmin && (
              <>
                <div style={{ height: 1, background: "#f3f4f6", margin: "4px 0" }} />
                <div style={{ padding: "8px 20px 4px", fontSize: 11, fontWeight: 700, color: "#9ca3af", fontFamily: "Nunito, sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>Admin</div>
                {[
                  { icon: Eye, label: "Review item", color: "#6366f1", action: () => { setShowMenu(false); router.push(`/admin?item=${item.id}`); } },
                  { icon: EyeOff, label: "Blur pending review", color: "#d97706", action: () => handleAdminAction("blur") },
                  { icon: Trash2, label: "Remove listing", color: "#ef4444", action: () => handleAdminAction("remove") },
                  { icon: Snowflake, label: "Freeze listing", color: "#0ea5e9", action: () => handleAdminAction("freeze") },
                  { icon: ScrollText, label: "View audit log", color: "#6366f1", action: () => { setShowMenu(false); router.push(`/admin`); } },
                ].map(({ icon: Icon, label, color, action }) => (
                  <button key={label} onClick={action} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "14px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                    <Icon size={18} color={color} strokeWidth={1.5} />
                    <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, color: "#1a1a1a" }}>{label}</span>
                  </button>
                ))}
              </>
            )}

            <button onClick={() => setShowMenu(false)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "calc(100% - 40px)", margin: "16px 20px 0", padding: "12px", background: "#f5f5f5", border: "none", borderRadius: 12, fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 14, color: "#1a1a1a", cursor: "pointer" }}>
              <X size={16} style={{ marginRight: 6 }} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Edit item sheet ──────────────────────────────────────────────────── */}
      {showEditSheet && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowEditSheet(false)}>
          <div style={{ background: "white", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 430, maxHeight: "90vh", display: "flex", flexDirection: "column", animation: "sheetUp 0.3s ease" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 4, margin: "12px auto 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 0" }}>
              <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "#1a1a1a" }}>Edit Listing</div>
              <button onClick={() => setShowEditSheet(false)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X size={20} color="#333" /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 6, display: "block", fontFamily: "Nunito, sans-serif" }}>Title</label>
                <input style={FIELD} value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 6, display: "block", fontFamily: "Nunito, sans-serif" }}>Category</label>
                  <select style={{ ...FIELD, appearance: "none" as never, cursor: "pointer" }} value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}>
                    {EDIT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 6, display: "block", fontFamily: "Nunito, sans-serif" }}>Condition</label>
                  <select style={{ ...FIELD, appearance: "none" as never, cursor: "pointer" }} value={editForm.condition} onChange={(e) => setEditForm((f) => ({ ...f, condition: e.target.value }))}>
                    {EDIT_CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 6, display: "block", fontFamily: "Nunito, sans-serif" }}>Quantity</label>
                  <input style={FIELD} value={editForm.quantity} onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 6, display: "block", fontFamily: "Nunito, sans-serif" }}>Location</label>
                  <input style={FIELD} value={editForm.location} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 6, display: "block", fontFamily: "Nunito, sans-serif" }}>Description</label>
                <textarea style={{ ...FIELD, resize: "none", minHeight: 72 }} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div style={{ padding: "12px 16px 32px", borderTop: "1px solid #eee" }}>
              <button onClick={handleEditSubmit} disabled={editLoading} style={{ width: "100%", padding: "13px", background: editLoading ? "#aaa" : "#1a7a5e", color: "white", border: "none", borderRadius: 12, fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 15, cursor: editLoading ? "not-allowed" : "pointer" }}>
                {editLoading ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Report sheet ────────────────────────────────────────────────────── */}
      {showReportSheet && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => { setShowReportSheet(false); setReportReason(""); setReportSubmitted(false); }}>
          <div style={{ background: "white", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, padding: "20px 20px 44px", animation: "sheetUp 0.25s ease" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "#e5e7eb", borderRadius: 4, margin: "0 auto 20px" }} />
            {reportSubmitted ? (
              <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
                <CheckCircle size={32} color="#1a7a5e" style={{ marginBottom: 10 }} />
                <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 15, color: "#1a1a1a", marginBottom: 6 }}>Thank you</div>
                <div style={{ fontSize: 13, color: "#555555", lineHeight: 1.5, fontFamily: "Nunito, sans-serif" }}>Our team will review this listing.</div>
                <button onClick={() => { setShowReportSheet(false); setReportSubmitted(false); setReportReason(""); }} style={{ marginTop: 16, fontSize: 13, color: "#1a7a5e", background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: "Nunito, sans-serif" }}>
                  Close
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 15, color: "#1a1a1a" }}>Something wrong with this listing?</div>
                  <button onClick={() => { setShowReportSheet(false); setReportReason(""); }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                    <X size={18} color="#9ca3af" />
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 18, fontFamily: "Nunito, sans-serif" }}>What&apos;s wrong with this listing?</div>
                {["This item doesn't seem genuine", "Duplicate listing", "Inappropriate content", "Other"].map((r) => (
                  <label key={r} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #f5f5f5", cursor: "pointer" }}>
                    <input type="radio" name="report-reason-detail" value={r} checked={reportReason === r} onChange={() => setReportReason(r)} style={{ accentColor: "#1a7a5e", width: 16, height: 16 }} />
                    <span style={{ fontSize: 13, fontFamily: "Nunito, sans-serif", color: "#1a1a1a" }}>{r}</span>
                  </label>
                ))}
                <button
                  disabled={!reportReason || reportLoading}
                  onClick={async () => {
                    if (!reportReason || !item) return;
                    setReportLoading(true);
                    await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: item.id, reason: reportReason }) }).catch(() => {});
                    setReportLoading(false);
                    setReportSubmitted(true);
                  }}
                  style={{ marginTop: 20, width: "100%", padding: "12px", borderRadius: 12, border: "1.5px solid #e5e7eb", background: "white", color: reportReason ? "#1a7a5e" : "#9ca3af", fontSize: 13, fontWeight: 700, cursor: reportReason ? "pointer" : "default", fontFamily: "Nunito, sans-serif" }}
                >
                  {reportLoading ? "Submitting…" : "Submit report"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
