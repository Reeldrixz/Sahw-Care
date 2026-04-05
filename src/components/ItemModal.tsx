"use client";

import Image from "next/image";
import { useState } from "react";
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
  donor: { id: string; name: string; avatar: string | null; trustRating: number };
}

interface ItemModalProps {
  item: Item;
  onClose: () => void;
  onRequest: (note: string) => Promise<void>;
  requested?: boolean;
}

const CATEGORY_EMOJI: Record<string, string> = {
  "Baby Milk": "🍼",
  Diapers: "👶",
  Maternity: "🤱",
  Clothing: "👗",
  Accessories: "🧸",
  Other: "📦",
};

export default function ItemModal({ item, onClose, onRequest, requested }: ItemModalProps) {
  const { user } = useAuth();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onRequest(note);
    } finally {
      setLoading(false);
    }
  };

  const initials = item.donor.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{item.title}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-img" style={{ position: "relative" }}>
            {item.images[0] ? (
              <Image
                src={item.images[0]}
                alt={item.title}
                fill
                style={{ objectFit: "cover", borderRadius: 12 }}
                sizes="520px"
              />
            ) : (
              <span style={{ fontSize: 64 }}>{CATEGORY_EMOJI[item.category] ?? "📦"}</span>
            )}
          </div>

          <div className="item-badges" style={{ marginBottom: 16 }}>
            <span className="badge badge-category">{item.category}</span>
            <span className={`badge ${item.condition.includes("New") ? "badge-new" : "badge-used"}`}>
              {item.condition}
            </span>
            {item.urgent && <span className="badge badge-urgent">⚡ Urgent</span>}
          </div>

          {item.description && (
            <p style={{ fontSize: 14, color: "var(--mid)", lineHeight: 1.6, marginBottom: 16 }}>
              {item.description}
            </p>
          )}

          {[
            ["Quantity", item.quantity],
            ["Location", item.location],
            ["Donor", item.donor.name],
            ["Trust Rating", `⭐ ${item.donor.trustRating.toFixed(1)}`],
            ["Category", item.category],
          ].map(([label, value]) => (
            <div key={label} className="detail-row">
              <span className="detail-label">{label}</span>
              <span className="detail-value">{value}</span>
            </div>
          ))}

          {user && user.id !== item.donor.id && (
            <>
              <textarea
                className="request-note"
                rows={3}
                placeholder="Add a note to the donor (optional) — e.g. tell them about your situation..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                className="btn-primary"
                style={{ width: "100%", padding: "13px", fontSize: 15, borderRadius: 12 }}
                onClick={handleRequest}
                disabled={loading || requested}
              >
                {requested ? "✓ Request Sent" : loading ? "Sending..." : "🤝 Request This Item"}
              </button>
            </>
          )}

          {!user && (
            <div style={{ textAlign: "center", marginTop: 16, color: "var(--mid)", fontSize: 14 }}>
              <a href="/auth" style={{ color: "var(--terracotta)" }}>Sign in</a> to request this item
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
