"use client";

import Image from "next/image";
import Avatar from "@/components/Avatar";

interface Item {
  id: string;
  title: string;
  category: string;
  condition: string;
  quantity: string;
  location: string;
  images: string[];
  urgent: boolean;
  donor: { id: string; name: string; avatar: string | null };
}

interface ItemCardProps {
  item: Item;
  requested?: boolean;
  onRequest: (e: React.MouseEvent) => void;
  onClick: () => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  "Baby Milk": "🍼",
  "Diapers": "👶",
  "Maternity": "🤱",
  "Clothing": "👗",
  "Accessories": "🧸",
  "Other": "📦",
};

export default function ItemCard({ item, requested, onRequest, onClick }: ItemCardProps) {

  return (
    <div className="item-card" onClick={onClick}>
      <div className="item-img">
        {item.images[0] ? (
          <Image
            src={item.images[0]}
            alt={item.title}
            fill
            style={{ objectFit: "cover" }}
            sizes="(max-width: 768px) 100vw, 260px"
          />
        ) : (
          <span style={{ fontSize: 48 }}>{CATEGORY_EMOJI[item.category] ?? "📦"}</span>
        )}
      </div>
      <div className="item-body">
        <div className="item-badges">
          <span className="badge badge-category">{item.category}</span>
          <span className={`badge ${item.condition === "New" || item.condition === "New (unopened)" ? "badge-new" : "badge-used"}`}>
            {item.condition}
          </span>
          {item.urgent && <span className="badge badge-urgent">⚡ Urgent</span>}
        </div>
        <div className="item-title">{item.title}</div>
        <div className="item-meta">
          <span>📦 {item.quantity}</span>
          <span>📍 {item.location}</span>
        </div>
      </div>
      <div className="item-footer">
        <div className="donor-info">
          <Avatar src={item.donor.avatar} name={item.donor.name} size={28} />
          <div className="donor-name">{item.donor.name.split(" ")[0]}</div>
        </div>
        <button
          className={`btn-request ${requested ? "requested" : ""}`}
          onClick={onRequest}
        >
          {requested ? "✓ Requested" : "Request"}
        </button>
      </div>
    </div>
  );
}
