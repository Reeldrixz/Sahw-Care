"use client";

import Image from "next/image";

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
  donor: { id: string; name: string; avatar: string | null; trustRating: number };
}

const CAT_EMOJI: Record<string, string> = {
  "Baby Milk": "🍼",
  "Diapers": "👶",
  "Maternity": "🤱",
  "Clothing": "👗",
  "Accessories": "🧸",
  "Other": "📦",
};

const CAT_BG: Record<string, string> = {
  "Baby Milk": "#e8f5f1",
  "Diapers": "#fff3e0",
  "Maternity": "#f3e5f5",
  "Clothing": "#e3f2fd",
  "Accessories": "#e8f5e9",
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
  const initials = item.donor.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
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
          <div className="list-card-avatar">
            {item.donor.avatar ? (
              <Image src={item.donor.avatar} alt={item.donor.name} width={24} height={24} style={{ objectFit: "cover" }} />
            ) : initials}
          </div>
          <div className="list-card-donor-name">{item.donor.name}</div>
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
        <button
          className={`btn-reserve ${requested ? "done" : ""}`}
          onClick={(e) => { e.stopPropagation(); onRequest(e); }}
          disabled={requested}
        >
          {requested ? "✓ Requested" : "Request Free"}
        </button>
      </div>
    </div>
  );
}
