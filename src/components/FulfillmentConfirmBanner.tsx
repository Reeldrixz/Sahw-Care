"use client";

import { useState } from "react";
import FulfillmentStatusBadge from "./FulfillmentStatusBadge";

export interface PendingFulfillment {
  requestId:    string;
  itemTitle:    string;
  donorName:    string;
  donorNote:    string | null;
  donorPhotoUrl: string | null;
  markedAt:     string;
}

interface Props {
  items:       PendingFulfillment[];
  onResolved?: (requestId: string, status: "VERIFIED" | "DISPUTED") => void;
}

export default function FulfillmentConfirmBanner({ items, onResolved }: Props) {
  const [loading,   setLoading]   = useState<Record<string, boolean>>({});
  const [disputed,  setDisputed]  = useState<Record<string, boolean>>({});
  const [reasons,   setReasons]   = useState<Record<string, string>>({});
  // Items that have been confirmed — shows a brief success/disputed flash before parent removes them
  const [confirmed, setConfirmed] = useState<Record<string, "VERIFIED" | "DISPUTED">>({});

  if (items.length === 0) return null;

  const handleConfirm = async (requestId: string, response: "YES" | "NO") => {
    if (loading[requestId]) return;
    setLoading((p) => ({ ...p, [requestId]: true }));
    try {
      const body: Record<string, string> = { response };
      if (response === "NO" && reasons[requestId]) body.reason = reasons[requestId];

      const res  = await fetch(`/api/requests/${requestId}/fulfillment/confirm`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Something went wrong");
        return;
      }
      const status: "VERIFIED" | "DISPUTED" = response === "YES" ? "VERIFIED" : "DISPUTED";
      // Immediately show the correct badge (fixes Bug 2)
      setConfirmed((p) => ({ ...p, [requestId]: status }));
      // Dismiss after a brief success flash so the user sees the updated badge (fixes Bug 1)
      setTimeout(() => {
        onResolved?.(requestId, status);
      }, 1500);
    } finally {
      setLoading((p) => ({ ...p, [requestId]: false }));
    }
  };

  return (
    <div style={{ marginBottom: 14 }}>
      {items.map((item) => {
        const confirmedStatus = confirmed[item.requestId];

        // Success/disputed flash — shown after confirm, before parent removes the item
        if (confirmedStatus) {
          const isVerified = confirmedStatus === "VERIFIED";
          return (
            <div
              key={item.requestId}
              style={{
                background:   "var(--white)",
                borderRadius: 16,
                border:       `2px solid ${isVerified ? "#1a7a5e" : "#c0392b"}`,
                padding:      "16px 18px",
                marginBottom: 10,
                boxShadow:    "var(--shadow)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700 }}>
                  {item.itemTitle}
                </div>
                <FulfillmentStatusBadge status={confirmedStatus} small />
              </div>
              <div style={{
                fontSize: 12, fontFamily: "Nunito, sans-serif", fontWeight: 600,
                color: isVerified ? "#1a7a5e" : "#c0392b",
              }}>
                {isVerified
                  ? "Thank you for confirming! ✅"
                  : "Dispute reported — our team will review ⚠️"}
              </div>
            </div>
          );
        }

        // Normal pending view
        const isDisputing = disputed[item.requestId];
        const daysSince   = Math.floor((Date.now() - new Date(item.markedAt).getTime()) / (86400 * 1000));
        const daysLeft    = Math.max(0, 7 - daysSince);

        return (
          <div
            key={item.requestId}
            style={{
              background:   "var(--white)",
              borderRadius: 16,
              border:       "2px solid #f0a500",
              padding:      "18px 18px 16px",
              marginBottom: 10,
              boxShadow:    "var(--shadow)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "#b8860b", fontWeight: 800, fontFamily: "Nunito, sans-serif", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>
                  Confirm receipt
                </div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
                  {item.itemTitle}
                </div>
                <div style={{ fontSize: 12, color: "var(--mid)", marginTop: 2, fontFamily: "Nunito, sans-serif" }}>
                  Sent by {item.donorName}
                </div>
              </div>
              <FulfillmentStatusBadge status="PENDING" small />
            </div>

            {/* Donor note */}
            {item.donorNote && (
              <div style={{ background: "#fff8e6", borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 12, color: "var(--ink)", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>
                <span style={{ fontWeight: 700, color: "#b8860b" }}>Message from donor: </span>
                {item.donorNote}
              </div>
            )}

            {/* Donor photo */}
            {item.donorPhotoUrl && (
              <div style={{ marginBottom: 12 }}>
                <img
                  src={item.donorPhotoUrl}
                  alt="Item photo from donor"
                  style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" }}
                />
              </div>
            )}

            {/* Dispute reason textarea */}
            {isDisputing && (
              <textarea
                placeholder="What happened? (optional but helpful)"
                value={reasons[item.requestId] ?? ""}
                onChange={(e) => setReasons((p) => ({ ...p, [item.requestId]: e.target.value }))}
                rows={3}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 10,
                  border: "1.5px solid var(--border)", fontSize: 13,
                  fontFamily: "Nunito, sans-serif", resize: "none",
                  marginBottom: 10, boxSizing: "border-box", outline: "none",
                }}
              />
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              {!isDisputing ? (
                <>
                  <button
                    onClick={() => handleConfirm(item.requestId, "YES")}
                    disabled={!!loading[item.requestId]}
                    style={{
                      flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
                      background: "#1a7a5e", color: "white", fontSize: 13, fontWeight: 800,
                      cursor: loading[item.requestId] ? "default" : "pointer",
                      fontFamily: "Nunito, sans-serif", opacity: loading[item.requestId] ? 0.6 : 1,
                    }}
                  >
                    {loading[item.requestId] ? "…" : "✅ Yes, I got it!"}
                  </button>
                  <button
                    onClick={() => setDisputed((p) => ({ ...p, [item.requestId]: true }))}
                    style={{
                      flex: 1, padding: "11px 0", borderRadius: 10,
                      border: "1.5px solid var(--border)", background: "var(--bg)",
                      color: "var(--mid)", fontSize: 13, fontWeight: 700,
                      cursor: "pointer", fontFamily: "Nunito, sans-serif",
                    }}
                  >
                    ❌ I didn't get it
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleConfirm(item.requestId, "NO")}
                    disabled={!!loading[item.requestId]}
                    style={{
                      flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
                      background: "#c0392b", color: "white", fontSize: 13, fontWeight: 800,
                      cursor: loading[item.requestId] ? "default" : "pointer",
                      fontFamily: "Nunito, sans-serif", opacity: loading[item.requestId] ? 0.6 : 1,
                    }}
                  >
                    {loading[item.requestId] ? "…" : "Report issue"}
                  </button>
                  <button
                    onClick={() => setDisputed((p) => ({ ...p, [item.requestId]: false }))}
                    style={{
                      flex: 1, padding: "11px 0", borderRadius: 10,
                      border: "1.5px solid var(--border)", background: "var(--bg)",
                      color: "var(--mid)", fontSize: 13, fontWeight: 700,
                      cursor: "pointer", fontFamily: "Nunito, sans-serif",
                    }}
                  >
                    Back
                  </button>
                </>
              )}
            </div>

            {daysLeft <= 3 && daysLeft > 0 && (
              <div style={{ fontSize: 11, color: "#b8860b", marginTop: 10, textAlign: "center", fontFamily: "Nunito, sans-serif" }}>
                Auto-confirms in {daysLeft} day{daysLeft !== 1 ? "s" : ""} if no response
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
