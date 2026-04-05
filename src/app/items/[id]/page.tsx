"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import Toast from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";

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
  donor: { id: string; name: string; avatar: string | null; trustRating: number; location: string | null };
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
  "Baby Milk": "#e8f5f1", "Diapers": "#fff3e0", "Maternity": "#f3e5f5",
  "Clothing": "#e3f2fd", "Accessories": "#e8f5e9", "Other": "#f5f5f5",
};
const CAT_EMOJI: Record<string, string> = {
  "Baby Milk": "🍼", "Diapers": "👶", "Maternity": "🤱",
  "Clothing": "👗", "Accessories": "🧸", "Other": "📦",
};

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

export default function ItemDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<Item | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRatings, setAvgRatings] = useState({ pickup: 0, quality: 0, quantity: 0 });
  const [fav, setFav] = useState(false);
  const [requested, setRequested] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/items/${id}`)
      .then((r) => r.json())
      .then((d) => { setItem(d.item); setLoading(false); });
  }, [id]);

  // Load donor reviews once item loads
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
    if (!user) { router.push("/auth"); return; }
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

  if (loading) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;
  if (!item) return (
    <div className="empty" style={{ minHeight: "100vh" }}>
      <div className="empty-icon">😕</div>
      <div className="empty-title">Item not found</div>
      <button style={{ marginTop: 16, color: "var(--green)", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }} onClick={() => router.back()}>Go back</button>
    </div>
  );

  const bg = CAT_BG[item.category] ?? "#f5f5f5";
  const donorInitials = item.donor.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="detail">
      {/* Mobile layout */}
      <div className="detail-mobile-view">
      <div className="detail-hero" style={{ background: bg }}>
        <button className="detail-back" onClick={() => router.back()}>←</button>
        <button className="detail-share" onClick={() => setToast("Link copied!")}>⬆</button>
        <button className="detail-fav" onClick={() => setFav((f) => !f)}>{fav ? "❤️" : "🤍"}</button>
        {item.urgent && <div className="detail-qty-badge">⚡ Urgent</div>}
        {item.images[0] ? (
          <Image src={item.images[0]} alt={item.title} fill style={{ objectFit: "cover" }} sizes="430px" />
        ) : (
          <span style={{ fontSize: 80 }}>{CAT_EMOJI[item.category] ?? "📦"}</span>
        )}
      </div>
      <div style={{ overflowY: "auto", height: "calc(100vh - 260px)", paddingBottom: 100 }}>
        <div className="detail-body">
          <span className="detail-cat">{item.category}</span>
          <div className="detail-title">{item.title}</div>
          <div className="detail-meta-row">📦 <strong>{item.quantity}</strong> available · <strong>{item.condition}</strong></div>
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
            <div className="donor-avatar-lg">
              {item.donor.avatar ? (
                <Image src={item.donor.avatar} alt={item.donor.name} width={48} height={48} style={{ objectFit: "cover" }} />
              ) : donorInitials}
            </div>
            <div className="donor-info">
              <div className="donor-name-lg">{item.donor.name}</div>
              <div className="donor-stats">
                <div className="donor-stat">⭐ {item.donor.trustRating.toFixed(1)}</div>
                <div className="donor-stat">📍 {item.donor.location ?? item.location}</div>
              </div>
            </div>
            <span className="donor-verified">✓ Verified</span>
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
                const initials = r.reviewer.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                const time = new Date(r.createdAt).toLocaleDateString([], { month: "short", day: "numeric" });
                return (
                  <div key={r.id} className="review-item">
                    <div className="review-header">
                      <div className="review-av">{initials}</div>
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
        </div>
      </div>

      {/* Mobile reserve bar */}
      {user?.id !== item.donor.id && (
        <div className="reserve-bar">
          <button className={`btn-big ${requested ? "done" : ""}`} onClick={handleRequest} disabled={requested}>
            {requested ? "✓ Request Sent — Awaiting donor" : "Request this item — Free"}
          </button>
        </div>
      )}
      </div>{/* end detail-mobile-view */}

      {/* Desktop 2-column layout */}
      <div className="detail-desktop-view">
        <div className="detail-desktop-wrap">
          {/* Left: hero image */}
          <div>
            <button className="detail-back" style={{ position: "relative", top: "auto", left: "auto", marginBottom: 12, display: "flex" }} onClick={() => router.back()}>←</button>
            <div className="detail-hero" style={{ background: bg, position: "relative" }}>
              <button className="detail-share" onClick={() => setToast("Link copied!")}>⬆</button>
              <button className="detail-fav" onClick={() => setFav((f) => !f)}>{fav ? "❤️" : "🤍"}</button>
              {item.urgent && <div className="detail-qty-badge">⚡ Urgent</div>}
              {item.images[0] ? (
                <Image src={item.images[0]} alt={item.title} fill style={{ objectFit: "cover" }} sizes="500px" />
              ) : (
                <span style={{ fontSize: 80 }}>{CAT_EMOJI[item.category] ?? "📦"}</span>
              )}
            </div>
          </div>

          {/* Right: details */}
          <div>
            <div className="detail-body">
              <span className="detail-cat">{item.category}</span>
              <div className="detail-title">{item.title}</div>
              <div className="detail-meta-row">📦 <strong>{item.quantity}</strong> available · <strong>{item.condition}</strong></div>
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
                <div className="donor-avatar-lg">
                  {item.donor.avatar ? (
                    <Image src={item.donor.avatar} alt={item.donor.name} width={48} height={48} style={{ objectFit: "cover" }} />
                  ) : donorInitials}
                </div>
                <div className="donor-info">
                  <div className="donor-name-lg">{item.donor.name}</div>
                  <div className="donor-stats">
                    <div className="donor-stat">⭐ {item.donor.trustRating.toFixed(1)}</div>
                    <div className="donor-stat">📍 {item.donor.location ?? item.location}</div>
                  </div>
                </div>
                <span className="donor-verified">✓ Verified</span>
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

              {user?.id !== item.donor.id && (
                <div className="reserve-bar">
                  <button className={`btn-big ${requested ? "done" : ""}`} onClick={handleRequest} disabled={requested}>
                    {requested ? "✓ Request Sent — Awaiting donor" : "Request this item — Free"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
