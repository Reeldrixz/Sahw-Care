"use client";

import { useState } from "react";
import { X, Clock, CheckCircle } from "lucide-react";
import { ItemData } from "@/components/ListCard";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";

interface Props {
  item: ItemData;
  onClose: () => void;
  onSubmitted: (itemId: string) => void;
}

type WhoFor = "ME" | "MY_BABY" | "SOMEONE_I_CARE_FOR";
type PickupPref = "PICKUP" | "DELIVERY";

const WHO_OPTIONS: { value: WhoFor; label: string }[] = [
  { value: "ME",                  label: "Me" },
  { value: "MY_BABY",             label: "My baby" },
  { value: "SOMEONE_I_CARE_FOR",  label: "Someone I care for" },
];

const PICKUP_OPTIONS: { value: PickupPref; label: string }[] = [
  { value: "PICKUP",   label: "I can pick up" },
  { value: "DELIVERY", label: "I need delivery support" },
];

export default function RequestReviewSheet({ item, onClose, onSubmitted }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [whoFor, setWhoFor] = useState<WhoFor | null>(null);
  const [pickup, setPickup] = useState<PickupPref | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const reasonOk = reason.trim().length >= 20 && reason.trim().length <= 200;
  const canSubmit = reasonOk && !!whoFor && !!pickup;
  const donorFirstName = item.donor.name.split(" ")[0];

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setApiError(null);
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: item.id,
        reasonForRequest: reason.trim(),
        whoIsItFor: whoFor,
        pickupPreference: pickup,
      }),
    });
    const d = await res.json();
    if (res.ok) {
      onSubmitted(item.id);
      setSubmitted(true);
    } else {
      setApiError(d.error ?? "Something went wrong");
    }
    setLoading(false);
  };

  const radioBtn = (
    active: boolean,
    onClick: () => void,
    label: string,
    wide = false
  ) => (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "11px 14px",
        borderRadius: 12,
        border: `1.5px solid ${active ? "var(--green)" : "var(--border)"}`,
        background: active ? "var(--green-light)" : "var(--bg)",
        cursor: "pointer", textAlign: "left",
        ...(wide ? { flex: 1 } : {}),
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${active ? "var(--green)" : "var(--border)"}`,
        background: active ? "var(--green)" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {active && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "white" }} />}
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", color: "var(--ink)" }}>
        {label}
      </span>
    </button>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 190 }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
        background: "var(--white)", borderRadius: "20px 20px 0 0",
        maxHeight: "92vh", overflowY: "auto",
        animation: "sheetUp 0.3s ease",
        paddingBottom: "env(safe-area-inset-bottom, 16px)",
      }}>
        {/* Handle bar */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)" }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px 16px" }}>
          <div style={{ fontSize: 17, fontWeight: 800, fontFamily: "Lora, serif" }}>
            {submitted ? "Request sent" : "Request item"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={22} color="var(--mid)" />
          </button>
        </div>

        <div style={{ padding: "0 20px 32px" }}>
          {/* Item summary card */}
          <div style={{
            background: "var(--bg)", borderRadius: 12, padding: "12px 14px",
            marginBottom: 22, display: "flex", alignItems: "center", gap: 12,
            border: "1.5px solid var(--border)",
          }}>
            <Avatar src={item.donor.avatar} name={item.donor.name} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "Nunito, sans-serif", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.title}
              </div>
              <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                From {donorFirstName} · {item.condition} · {item.location.split(",")[0]}
              </div>
            </div>
            {item.urgent && (
              <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 20, background: "#fff3e0", color: "#e65100", flexShrink: 0 }}>
                ⚡ Urgent
              </span>
            )}
          </div>

          {submitted ? (
            /* ── Confirmation ── */
            <div style={{ textAlign: "center", padding: "8px 0 8px" }}>
              <CheckCircle size={52} color="var(--green)" style={{ marginBottom: 16 }} />
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "Lora, serif", marginBottom: 10 }}>
                Request sent to {donorFirstName}
              </div>
              <div style={{ fontSize: 13, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.65, marginBottom: 22 }}>
                {donorFirstName} can now review your request<br />and choose whether to connect.
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#fff8e1", border: "1.5px solid #fbbf24",
                borderRadius: 20, padding: "8px 18px",
                fontSize: 13, fontWeight: 700, color: "#92400e",
                marginBottom: 30,
              }}>
                <Clock size={15} color="#d97706" />
                Pending donor response
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  onClick={() => router.push("/profile")}
                  style={{
                    width: "100%", padding: "14px 0", borderRadius: 14,
                    background: "var(--green)", color: "white", border: "none",
                    fontSize: 14, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer",
                  }}
                >
                  View request status
                </button>
                <button
                  onClick={onClose}
                  style={{
                    width: "100%", padding: "14px 0", borderRadius: 14,
                    background: "transparent", color: "var(--ink)",
                    border: "1.5px solid var(--border)",
                    fontSize: 14, fontWeight: 700, fontFamily: "Nunito, sans-serif", cursor: "pointer",
                  }}
                >
                  Browse more items
                </button>
              </div>
            </div>
          ) : (
            /* ── Form ── */
            <>
              {/* Why do you need this */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", marginBottom: 6, color: "var(--ink)" }}>
                  Why do you need this item? <span style={{ color: "var(--terra)" }}>*</span>
                </label>
                <textarea
                  rows={3}
                  maxLength={200}
                  placeholder="Briefly explain your need..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{
                    width: "100%", padding: "11px 14px", borderRadius: 12,
                    border: `1.5px solid ${reason.length > 0 && !reasonOk ? "var(--terra)" : "var(--border)"}`,
                    fontSize: 14, fontFamily: "Nunito, sans-serif", outline: "none",
                    resize: "none", boxSizing: "border-box",
                    background: "var(--bg)", color: "var(--ink)",
                    lineHeight: 1.5,
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  {reason.length > 0 && !reasonOk ? (
                    <span style={{ fontSize: 11, color: "var(--terra)", fontFamily: "Nunito, sans-serif" }}>
                      Minimum 20 characters
                    </span>
                  ) : <span />}
                  <span style={{ fontSize: 11, color: "var(--light)", fontFamily: "Nunito, sans-serif" }}>
                    {reason.length}/200
                  </span>
                </div>
              </div>

              {/* Who is it for */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", marginBottom: 10, color: "var(--ink)" }}>
                  Who is it for? <span style={{ color: "var(--terra)" }}>*</span>
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {WHO_OPTIONS.map((opt) => radioBtn(whoFor === opt.value, () => setWhoFor(opt.value), opt.label))}
                </div>
              </div>

              {/* Pickup or delivery */}
              <div style={{ marginBottom: 26 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", marginBottom: 10, color: "var(--ink)" }}>
                  Pickup or delivery? <span style={{ color: "var(--terra)" }}>*</span>
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  {PICKUP_OPTIONS.map((opt) => radioBtn(pickup === opt.value, () => setPickup(opt.value), opt.label, true))}
                </div>
              </div>

              {apiError && (
                <div style={{ fontSize: 13, color: "var(--terra)", marginBottom: 14, fontFamily: "Nunito, sans-serif", fontWeight: 600 }}>
                  {apiError}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!canSubmit || loading}
                style={{
                  width: "100%", padding: "15px 0", borderRadius: 14,
                  background: canSubmit ? "var(--green)" : "var(--border)",
                  color: canSubmit ? "white" : "var(--mid)",
                  border: "none", fontSize: 15, fontWeight: 800,
                  fontFamily: "Nunito, sans-serif",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  transition: "background 0.15s",
                }}
              >
                {loading ? "Sending…" : "Send Request"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
