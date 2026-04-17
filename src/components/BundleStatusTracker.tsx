"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface BundleInstance {
  id:             string;
  status:         string;
  requestedAt:    string;
  approvedAt:     string | null;
  shippedAt:      string | null;
  confirmedAt:    string | null;
  trackingNumber: string | null;
  campaign:       { title: string; sponsorName: string };
  template:       { name: string };
}

interface Props {
  instance: BundleInstance;
  onConfirmed?: () => void;
}

const STEPS = [
  { key: "REQUESTED", label: "Requested",   emoji: "📋" },
  { key: "APPROVED",  label: "Approved",    emoji: "✅" },
  { key: "ORDERED",   label: "On its way",  emoji: "📦" },
  { key: "SHIPPED",   label: "Shipped",     emoji: "🚚" },
  { key: "COMPLETED", label: "Delivered",   emoji: "🎉" },
];

const STATUS_ORDER = ["REQUESTED", "APPROVED", "ORDERED", "SHIPPED", "DELIVERED", "COMPLETED"];

export default function BundleStatusTracker({ instance, onConfirmed }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const currentIdx = STATUS_ORDER.indexOf(instance.status);

  const handleConfirm = async () => {
    setConfirming(true);
    const res = await fetch(`/api/bundles/${instance.id}/confirm`, { method: "POST" });
    setConfirming(false);
    if (res.ok) {
      setConfirmed(true);
      onConfirmed?.();
    }
  };

  if (confirmed || instance.status === "COMPLETED") {
    return (
      <div style={{ background: "var(--green-light)", borderRadius: 16, padding: "20px", textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
        <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, color: "var(--green)", marginBottom: 6 }}>
          Bundle delivered!
        </div>
        <div style={{ fontSize: 13, color: "var(--green)", opacity: 0.8, lineHeight: 1.6 }}>
          Thank you for confirming. We hope these items bring comfort and joy to your family 💛
        </div>
      </div>
    );
  }

  if (instance.status === "REJECTED") {
    return (
      <div style={{ background: "var(--terra-light)", borderRadius: 16, padding: "20px", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>💌</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--terra)", marginBottom: 4 }}>Bundle request not approved</div>
        <div style={{ fontSize: 12, color: "var(--terra)", lineHeight: 1.6 }}>
          This request could not be fulfilled at this time. You may request a new bundle when eligible.
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--white)", borderRadius: 16, padding: "20px", boxShadow: "var(--shadow)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 12, color: "var(--mid)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
        {instance.campaign.sponsorName}
      </div>
      <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
        {instance.template.name}
      </div>

      {/* Progress steps */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 0, marginBottom: 20 }}>
        {STEPS.map((step, i) => {
          const stepIdx    = STATUS_ORDER.indexOf(step.key);
          const isDone     = currentIdx >= stepIdx;
          const isCurrent  = currentIdx === stepIdx ||
            (step.key === "ORDERED" && ["ORDERED", "SHIPPED"].includes(instance.status));
          const isLast     = i === STEPS.length - 1;

          return (
            <div key={step.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                <div
                  style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14,
                    background: isDone ? "var(--green)" : "var(--bg)",
                    border: `2px solid ${isDone ? "var(--green)" : "var(--border)"}`,
                    margin: "0 auto",
                    boxShadow: isCurrent ? "0 0 0 3px rgba(26,122,94,0.18)" : "none",
                    transition: "all 0.2s",
                  }}
                >
                  {isDone ? <span style={{ color: "white", fontSize: 12 }}>✓</span> : <span>{step.emoji}</span>}
                </div>
                {!isLast && (
                  <div style={{ flex: 1, height: 2, background: isDone && currentIdx > stepIdx ? "var(--green)" : "var(--border)", margin: "0 2px" }} />
                )}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, marginTop: 5, textAlign: "center", color: isDone ? "var(--green)" : "var(--light)", lineHeight: 1.2 }}>
                {step.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tracking number */}
      {instance.trackingNumber && (
        <div style={{ background: "var(--bg)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
          <span style={{ color: "var(--mid)", fontWeight: 600 }}>Tracking: </span>
          <span style={{ fontWeight: 800, fontFamily: "monospace" }}>{instance.trackingNumber}</span>
        </div>
      )}

      {/* Confirm received button */}
      {["SHIPPED", "DELIVERED"].includes(instance.status) && (
        <button
          onClick={handleConfirm}
          disabled={confirming}
          style={{
            width: "100%", padding: "13px", borderRadius: 12, border: "none",
            background: "var(--green)", color: "white", fontSize: 14, fontWeight: 800,
            cursor: confirming ? "default" : "pointer", fontFamily: "Nunito, sans-serif",
            opacity: confirming ? 0.7 : 1,
          }}
        >
          {confirming ? "Confirming…" : "✓ Confirm I received my bundle"}
        </button>
      )}

      {/* Status message */}
      {!["SHIPPED", "DELIVERED"].includes(instance.status) && (
        <div style={{ fontSize: 12, color: "var(--mid)", textAlign: "center", lineHeight: 1.6 }}>
          {instance.status === "REQUESTED" && "Your request is with our team. We'll review it within 1–2 days."}
          {instance.status === "APPROVED"  && "Approved! We're preparing your bundle now."}
          {instance.status === "ORDERED"   && "Your bundle has been ordered and will ship soon."}
        </div>
      )}
    </div>
  );
}
