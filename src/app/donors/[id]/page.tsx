"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import Avatar from "@/components/Avatar";

const CAT_BG: Record<string, string> = {
  "Feeding": "#e8f5f1", "Diapering": "#fff3e0", "Maternity": "#f3e5f5",
  "Clothing": "#e3f2fd", "Hygiene": "#e8f5e9", "Other": "#f5f5f5",
};
const CAT_EMOJI: Record<string, string> = {
  "Feeding": "🍼", "Diapering": "👶", "Maternity": "🤱",
  "Clothing": "👗", "Hygiene": "🧴", "Other": "📦",
};

interface DonorUser {
  id: string;
  name: string;
  avatar: string | null;
  location: string | null;
  countryFlag: string | null;
  isPremium: boolean;
  trustRating: number;
  verificationLevel: number;
  createdAt: string;
  _count: { items: number };
  reviewsReceived: Array<{
    id: string;
    pickupRating: number;
    qualityRating: number;
    quantityRating: number;
    comment: string | null;
    createdAt: string;
    reviewer: { id: string; name: string; avatar: string | null };
  }>;
  items: Array<{
    id: string;
    title: string;
    category: string;
    condition: string;
    quantity: string;
    images: string[];
    urgent: boolean;
  }>;
}

export default function DonorProfilePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [donor, setDonor] = useState<DonorUser | null>(null);
  const [ratings, setRatings] = useState({ pickup: 0, quality: 0, quantity: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/users/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setDonor(d.user);
        if (d.ratings) setRatings(d.ratings);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;
  if (!donor) return (
    <div className="empty" style={{ minHeight: "100vh" }}>
      <div className="empty-icon">😕</div>
      <div className="empty-title">Donor not found</div>
    </div>
  );

  const memberYear = new Date(donor.createdAt).getFullYear();
  const fulfilRate = donor._count.items > 0 ? "98%" : "—";

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
    <div className="donor-desktop-wrap">
      <div className="profile-hero" style={{ position: "relative" }}>
        <button
          style={{ position: "absolute", top: 16, left: 16, width: 38, height: 38, background: "rgba(255,255,255,0.2)", borderRadius: "50%", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: "white" }}
          onClick={() => router.back()}
        >←</button>

        <div className="profile-av" style={{ overflow: "hidden" }}>
          <Avatar src={donor.avatar} name={donor.name} size={80} />
        </div>
        <div className="profile-name">
          {donor.countryFlag && <span style={{ marginRight: 6 }}>{donor.countryFlag}</span>}
          {donor.name}
        </div>
        <div className="profile-role-badge" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          Donor
          {donor.verificationLevel >= 1 && (
            <><span style={{ margin: "0 2px" }}>·</span><ShieldCheck size={16} color="#1a7a5e" strokeWidth={1.75} />Verified</>
          )}
          {donor.isPremium && <><span style={{ margin: "0 2px" }}>·</span>✨ Premium</>}
        </div>

        <div className="profile-stats-row">
          <div className="p-stat">
            <div className="p-stat-num">{donor._count.items}</div>
            <div className="p-stat-label">Donations</div>
          </div>
          {donor.verificationLevel >= 1 && (
            <div className="p-stat">
              <div className="p-stat-num" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                <ShieldCheck size={20} color="#1a7a5e" strokeWidth={1.75} />
              </div>
              <div className="p-stat-label">Verified</div>
            </div>
          )}
          <div className="p-stat">
            <div className="p-stat-num">{fulfilRate}</div>
            <div className="p-stat-label">Fulfilled</div>
          </div>
        </div>
      </div>

      <div className="profile-body">
        {/* Ratings */}
        {(ratings.pickup > 0 || donor.reviewsReceived.length > 0) && (
          <div className="profile-section">
            <div className="profile-section-title">Experience ratings</div>
            {[
              ["Pickup experience", ratings.pickup || 0],
              ["Item quality", ratings.quality || 0],
              ["Quantity accuracy", ratings.quantity || 0],
            ].map(([label, value]) => (
              <div key={label} className="rating-row">
                <div className="rating-label" style={{ width: 130 }}>{label}</div>
                <div className="rating-bar-wrap">
                  <div className="rating-bar" style={{ width: `${((value as number) / 5) * 100}%` }} />
                </div>
                <div className="rating-num">{(value as number).toFixed(1)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Reviews */}
        {donor.reviewsReceived.length > 0 && (
          <div className="profile-section">
            <div className="profile-section-title">Recent reviews</div>
            {donor.reviewsReceived.map((r) => {
              const avg = Math.round((r.pickupRating + r.qualityRating + r.quantityRating) / 3);
              const time = new Date(r.createdAt).toLocaleDateString([], { month: "short", day: "numeric" });
              return (
                <div key={r.id} className="review-item">
                  <div className="review-header">
                    <Avatar src={r.reviewer.avatar} name={r.reviewer.name} size={32} />
                    <div>
                      <div className="review-name">{r.reviewer.name}</div>
                      <div className="review-stars">{"⭐".repeat(avg)}</div>
                    </div>
                    <div className="review-time">{time}</div>
                  </div>
                  {r.comment && <div className="review-text">{r.comment}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* Active listings */}
        {donor.items.length > 0 && (
          <div className="profile-section">
            <div className="profile-section-title">Active listings</div>
            {donor.items.map((item) => (
              <div
                key={item.id}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onClick={() => router.push(`/items/${item.id}`)}
              >
                <div style={{ width: 44, height: 44, background: CAT_BG[item.category] ?? "#f5f5f5", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                  {CAT_EMOJI[item.category] ?? "📦"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600 }}>{item.quantity} · {item.condition}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--green)" }}>Free</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: 12, color: "var(--light)", paddingBottom: 20 }}>
          Member since {memberYear}
        </div>
      </div>
    </div>{/* end donor-desktop-wrap */}
    </div>
  );
}
