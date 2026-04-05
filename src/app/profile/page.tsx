"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import BottomNav from "@/components/BottomNav";
import DonateModal from "@/components/DonateModal";
import Toast from "@/components/Toast";
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

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  if (!user) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;

  const initials = user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const memberYear = new Date(user.createdAt).getFullYear();

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="profile-hero">
        <div className="profile-av">
          {user.avatar ? (
            <Image src={user.avatar} alt={user.name} width={80} height={80} style={{ objectFit: "cover" }} />
          ) : initials}
        </div>
        <div className="profile-name">{user.name}</div>
        <div className="profile-role-badge">
          {user.role === "DONOR" ? "🎁 Donor" : "🤱 Recipient"} · ✓ Verified
          {user.isPremium ? " · ✨ Premium" : ""}
        </div>

        {/* Location */}
        <div style={{ marginTop: 10, fontSize: 13 }}>
          {editingLocation ? (
            <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
              <input
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
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
        </div>

        <div className="profile-stats-row">
          <div className="p-stat">
            <div className="p-stat-num">{user._count?.items ?? 0}</div>
            <div className="p-stat-label">Donated</div>
          </div>
          <div className="p-stat">
            <div className="p-stat-num">⭐{user.trustRating.toFixed(1)}</div>
            <div className="p-stat-label">Rating</div>
          </div>
          <div className="p-stat">
            <div className="p-stat-num">{user._count?.requests ?? 0}</div>
            <div className="p-stat-label">Requests</div>
          </div>
        </div>
      </div>

      <div className="profile-body">
        {/* Ratings */}
        {ratings.pickup > 0 && (
          <div className="profile-section">
            <div className="profile-section-title">My experience ratings</div>
            {[["Pickup", ratings.pickup], ["Quality", ratings.quality], ["Quantity", ratings.quantity]].map(([l, v]) => (
              <div key={l} className="rating-row">
                <div className="rating-label">{l}</div>
                <div className="rating-bar-wrap"><div className="rating-bar" style={{ width: `${((v as number) / 5) * 100}%` }} /></div>
                <div className="rating-num">{(v as number).toFixed(1)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <div className="profile-section">
            <div className="profile-section-title">Recent reviews about me</div>
            {reviews.slice(0, 5).map((r) => {
              const ri = r.reviewer.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
              const avg = Math.round((r.pickupRating + r.qualityRating + r.quantityRating) / 3);
              const time = new Date(r.createdAt).toLocaleDateString([], { month: "short", day: "numeric" });
              return (
                <div key={r.id} className="review-item">
                  <div className="review-header">
                    <div className="review-av">{ri}</div>
                    <div><div className="review-name">{r.reviewer.name}</div><div className="review-stars">{"⭐".repeat(avg)}</div></div>
                    <div className="review-time">{time}</div>
                  </div>
                  {r.comment && <div className="review-text">{r.comment}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* My listings */}
        {(user.role === "DONOR" || user.role === "ADMIN") && (
          <div className="profile-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="profile-section-title" style={{ marginBottom: 0 }}>My listings</div>
              <button
                onClick={() => setShowDonate(true)}
                style={{ background: "var(--green)", color: "white", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
              >
                + Add item
              </button>
            </div>
            {myItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "var(--mid)", fontSize: 13 }}>
                No items listed yet
              </div>
            ) : myItems.map((item) => (
              <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onClick={() => router.push(`/items/${item.id}`)}>
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
        )}

        {/* Settings */}
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

      <BottomNav />
      {showDonate && <DonateModal onClose={() => setShowDonate(false)} onSubmit={handleDonate} />}
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
