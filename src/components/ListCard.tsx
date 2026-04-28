"use client";

import Image from "next/image";
import { useState } from "react";
import {
  MapPin, CheckCircle, MoreHorizontal, X,
  Milk, Baby, Heart, Shirt, Sparkles, Package, type LucideIcon,
} from "lucide-react";

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
  status: string;
  createdAt: string;
  requestable?: boolean;
  requestLockedReason?: string | null;
  donor: {
    id: string;
    name: string;
    avatar: string | null;
    trustRating: number;
    verificationLevel?: number;
    countryFlag?: string | null;
  };
}

const CAT_BG: Record<string, string> = {
  "Feeding":   "#e8f5f1",
  "Diapering": "#fff8ed",
  "Maternity": "#f5f3ff",
  "Clothing":  "#eff6ff",
  "Hygiene":   "#f0fdf4",
  "Other":     "#f5f5f5",
};

const CAT_ICONS: Record<string, LucideIcon> = {
  "Feeding":   Milk,
  "Diapering": Baby,
  "Maternity": Heart,
  "Clothing":  Shirt,
  "Hygiene":   Sparkles,
  "Other":     Package,
};

const REPORT_REASONS = [
  "This item doesn't seem genuine",
  "Duplicate listing",
  "Inappropriate content",
  "Other",
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function normalizeCondition(c: string): string {
  if (c === "Slightly used" || c === "Gently used") return "Gently used";
  if (c === "New (unopened)" || c === "New (Unopened)") return "New";
  return c;
}

function getSignal(item: ItemData): { label: string; color: string; bg: string } | null {
  const hoursOld = (Date.now() - new Date(item.createdAt).getTime()) / 3600000;
  if (hoursOld < 2) return { label: "Just listed", color: "#1a7a5e", bg: "#e8f5f1" };
  if (item.urgent && hoursOld < 48) return { label: "Needed soon", color: "#d97706", bg: "#fff8ed" };
  if (item.quantity === "1") return { label: "1 available", color: "#555555", bg: "#f5f5f5" };
  return null;
}

interface ListCardProps {
  item: ItemData;
  requested?: boolean;
  favourited?: boolean;
  locked?: boolean;
  onRequest: (e: React.MouseEvent) => void;
  onFavourite?: (e: React.MouseEvent) => void;
  onClick: () => void;
  badge?: string;
}

export default function ListCard({ item, requested, favourited, locked, onRequest, onFavourite, onClick }: ListCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reporting, setReporting] = useState(false);

  const isVerified = (item.donor.verificationLevel ?? 0) >= 1;
  const bg = CAT_BG[item.category] ?? "#f5f5f5";
  const CatIcon = CAT_ICONS[item.category] ?? Package;
  const signal = getSignal(item);
  const city = item.location.includes(",") ? item.location.split(",")[0].trim() : item.location;
  const isFulfilled = item.status === "FULFILLED";
  const isReserved = item.status === "RESERVED";

  const handleReport = async () => {
    if (!reportReason) return;
    setReporting(true);
    await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id, reason: reportReason }),
    }).catch(() => {});
    setReporting(false);
    setReportSubmitted(true);
  };

  return (
    <>
      <div
        className="list-card"
        onClick={onClick}
        style={{
          opacity: isFulfilled ? 0.8 : 1,
          borderLeft: isVerified ? "3px solid #1a7a5e" : undefined,
          position: "relative",
        }}
      >
        {/* Photo / icon area */}
        <div
          className="list-card-img"
          style={{
            background: bg,
            position: "relative",
            height: 160,
            overflow: "hidden",
            borderRadius: "14px 14px 0 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {item.images[0] ? (
            <Image
              src={item.images[0]}
              alt={item.title}
              fill
              style={{ objectFit: "cover" }}
              sizes="430px"
            />
          ) : (
            <CatIcon size={48} color="#1a7a5e" strokeWidth={1.25} style={{ opacity: 0.5 }} />
          )}

          {/* Verified overlay pill */}
          {isVerified && (
            <div style={{
              position: "absolute", top: 8, right: 8,
              display: "flex", alignItems: "center", gap: 4,
              background: "rgba(26,122,94,0.92)", color: "white",
              fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 20,
              fontFamily: "Nunito, sans-serif",
            }}>
              <CheckCircle size={10} strokeWidth={2.5} />
              Verified
            </div>
          )}

          {/* Fulfilled overlay */}
          {isFulfilled && (
            <div style={{
              position: "absolute", top: 8, left: 8,
              display: "flex", alignItems: "center", gap: 4,
              background: "rgba(26,122,94,0.92)", color: "white",
              fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20,
              fontFamily: "Nunito, sans-serif",
            }}>
              <CheckCircle size={10} strokeWidth={2.5} />
              Completed
            </div>
          )}

          {/* Reserved overlay */}
          {isReserved && (
            <div style={{
              position: "absolute", top: 8, left: 8,
              background: "#d97706", color: "white",
              fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20,
              fontFamily: "Nunito, sans-serif",
            }}>
              Reserved
            </div>
          )}

          {/* Favourite */}
          <button
            className="list-card-fav"
            onClick={(e) => { e.stopPropagation(); onFavourite?.(e); }}
            style={{ position: "absolute", bottom: 8, right: 8 }}
          >
            {favourited ? (
              <Heart size={16} fill="#e11d48" color="#e11d48" />
            ) : (
              <Heart size={16} color="white" strokeWidth={2} />
            )}
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "10px 12px 0" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 3, lineHeight: 1.3 }}>
            {item.title}
          </div>
          <div style={{ fontSize: 12, color: "#555555", fontFamily: "Nunito, sans-serif", marginBottom: 5 }}>
            {item.category} · {item.quantity}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#555555", fontFamily: "Nunito, sans-serif" }}>
            <MapPin size={11} strokeWidth={2} color="#1a7a5e" />
            <span>{city}</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "8px 12px 12px", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {/* Condition pill */}
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
            border: "1px solid #e5e7eb", color: "#555555", fontFamily: "Nunito, sans-serif",
          }}>
            {normalizeCondition(item.condition)}
          </span>

          {/* Time */}
          <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: "Nunito, sans-serif" }}>
            {timeAgo(item.createdAt)}
          </span>

          {/* Contextual signal */}
          {signal && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              background: signal.bg, color: signal.color, fontFamily: "Nunito, sans-serif",
            }}>
              {signal.label}
            </span>
          )}

          {/* Spacer + action button */}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            {/* 3-dot report menu */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(true); }}
              style={{ padding: "4px", background: "none", border: "none", cursor: "pointer", display: "flex", color: "#d1d5db" }}
            >
              <MoreHorizontal size={14} />
            </button>

            {/* Request button */}
            {!isFulfilled && !isReserved && (
              item.requestable === false ? (
                <button
                  className="btn-reserve"
                  style={{ background: "var(--border)", color: "var(--mid)", cursor: "not-allowed", fontSize: 12, padding: "6px 12px", height: 36 }}
                  onClick={(e) => e.stopPropagation()}
                  disabled
                >
                  Locked
                </button>
              ) : locked ? (
                <button
                  className="btn-reserve"
                  style={{ background: "#f59e0b", color: "white", cursor: "not-allowed", opacity: 0.8, fontSize: 12, padding: "6px 12px", height: 36 }}
                  onClick={(e) => { e.stopPropagation(); onRequest(e); }}
                >
                  Limit
                </button>
              ) : (
                <button
                  className={`btn-reserve ${requested ? "done" : ""}`}
                  style={{ fontSize: 12, padding: "6px 14px", height: 36 }}
                  onClick={(e) => { e.stopPropagation(); onRequest(e); }}
                  disabled={requested}
                >
                  {requested ? "Requested" : "Request"}
                </button>
              )
            )}
          </div>
        </div>

        {/* Donor attribution */}
        <div style={{ padding: "0 12px 10px", fontSize: 10, color: "#9ca3af", fontFamily: "Nunito, sans-serif" }}>
          Offered by a verified donor in {city}
        </div>
      </div>

      {/* Report bottom sheet */}
      {showMenu && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => { setShowMenu(false); setReportReason(""); setReportSubmitted(false); }}
        >
          <div
            style={{ background: "white", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, padding: "20px 20px 40px", animation: "sheetUp 0.25s ease" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, background: "#e5e7eb", borderRadius: 4, margin: "0 auto 20px" }} />

            {reportSubmitted ? (
              <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
                <CheckCircle size={32} color="#1a7a5e" style={{ marginBottom: 10 }} />
                <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 15, color: "#1a1a1a", marginBottom: 6 }}>Thank you</div>
                <div style={{ fontSize: 13, color: "#555555", lineHeight: 1.5 }}>Our team will review this listing.</div>
                <button onClick={() => { setShowMenu(false); setReportSubmitted(false); setReportReason(""); }}
                  style={{ marginTop: 16, fontSize: 13, color: "#1a7a5e", background: "none", border: "none", cursor: "pointer", fontWeight: 700, fontFamily: "Nunito, sans-serif" }}>
                  Close
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 15, color: "#1a1a1a" }}>Something wrong with this listing?</div>
                  <button onClick={() => { setShowMenu(false); setReportReason(""); }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                    <X size={18} color="#9ca3af" />
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 18, fontFamily: "Nunito, sans-serif" }}>
                  What&apos;s wrong with this listing?
                </div>
                {REPORT_REASONS.map((r) => (
                  <label key={r} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #f5f5f5", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="report-reason"
                      value={r}
                      checked={reportReason === r}
                      onChange={() => setReportReason(r)}
                      style={{ accentColor: "#1a7a5e", width: 16, height: 16 }}
                    />
                    <span style={{ fontSize: 13, fontFamily: "Nunito, sans-serif", color: "#1a1a1a" }}>{r}</span>
                  </label>
                ))}
                <button
                  onClick={handleReport}
                  disabled={!reportReason || reporting}
                  style={{
                    marginTop: 20, width: "100%", padding: "12px", borderRadius: 12,
                    border: "1.5px solid #e5e7eb", background: "white",
                    color: reportReason ? "#1a7a5e" : "#9ca3af",
                    fontSize: 13, fontWeight: 700, cursor: reportReason ? "pointer" : "default",
                    fontFamily: "Nunito, sans-serif",
                  }}
                >
                  {reporting ? "Submitting…" : "Submit report"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
