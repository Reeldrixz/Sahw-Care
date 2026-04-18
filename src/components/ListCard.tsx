"use client";

import Image from "next/image";
import Avatar from "@/components/Avatar";

export interface ItemData {
  id: string;
  title: string;
  category: string;
  condition: string;
  quantity: string;
  location: string;
  description: string | null;
  images: string[];
  urgent: boolean;
  requestable?: boolean;
  requestLockedReason?: string | null;
  donor: { id: string; name: string; avatar: string | null; trustRating: number };
}

const CAT_EMOJI: Record<string, string> = {
  "Feeding": "🍼",
  "Diapering": "👶",
  "Maternity": "🤱",
  "Clothing": "👗",
  "Hygiene": "🧴",
  "Other": "📦",
};

const CAT_BG: Record<string, string> = {
  "Feeding": "#e8f5f1",
  "Diapering": "#fff3e0",
  "Maternity": "#f3e5f5",
  "Clothing": "#e3f2fd",
  "Hygiene": "#e8f5e9",
  "Other": "#f5f5f5",
};

interface ListCardProps {
  item: ItemData;
  requested?: boolean;
  favourited?: boolean;
  onRequest: (e: React.MouseEvent) => void;
  onFavourite?: (e: React.MouseEvent) => void;
  onClick: () => void;
  badge?: string;
}

export default function ListCard({ item, requested, favourited, onRequest, onFavourite, onClick, badge }: ListCardProps) {
  const bg = CAT_BG[item.category] ?? "#f5f5f5";

  return (
    <div className="list-card" onClick={onClick}>
      <div className="list-card-img" style={{ background: bg }}>
        {badge && <div className="list-card-badge">{badge}</div>}
        {item.urgent && !badge && <div className="list-card-badge">⚡ Urgent</div>}

        <button className="list-card-fav" onClick={(e) => { e.stopPropagation(); onFavourite?.(e); }}>
          {favourited ? "❤️" : "🤍"}
        </button>

        <div className="list-card-donor">
          <Avatar src={item.donor.avatar} name={item.donor.name} size={24} />
          <div className="list-card-donor-name">{item.donor.name.split(" ")[0]}</div>
        </div>

        {item.images[0] ? (
          <Image src={item.images[0]} alt={item.title} fill style={{ objectFit: "cover" }} sizes="430px" />
        ) : (
          <span style={{ fontSize: 60 }}>{CAT_EMOJI[item.category] ?? "📦"}</span>
        )}
      </div>

      <div className="list-card-body">
        <div className="list-card-title">{item.title}</div>
        <div className="list-card-desc">
          <span>{item.category} · {item.quantity}</span>
          <span>·</span>
          <span>📍 {item.location}</span>
        </div>
      </div>

      <div className="list-card-footer">
        <div className="list-card-rating">
          ⭐ {item.donor.trustRating.toFixed(1)}
          <span style={{ color: "var(--light)", fontWeight: 500 }}> · {item.condition}</span>
        </div>
        {item.requestable === false ? (
          <button
            className="btn-reserve"
            style={{ background: "var(--border)", color: "var(--mid)", cursor: "not-allowed" }}
            onClick={(e) => e.stopPropagation()}
            disabled
            title={item.requestLockedReason ?? "Trust score too low"}
          >
            🔒 Locked
          </button>
        ) : (
          <button
            className={`btn-reserve ${requested ? "done" : ""}`}
            onClick={(e) => { e.stopPropagation(); onRequest(e); }}
            disabled={requested}
          >
            {requested ? "✓ Requested" : "Request Free"}
          </button>
        )}
      </div>
    </div>
  );
}
