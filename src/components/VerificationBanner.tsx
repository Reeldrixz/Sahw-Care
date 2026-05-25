"use client";

import { useAuth } from "@/contexts/AuthContext";

interface Props {
  onUploadDocument?: () => void;
  onVerifyPhone: () => void;
  onVerifyEmail: () => void;
}

export default function VerificationBanner({ onVerifyPhone, onVerifyEmail }: Props) {
  const { user } = useAuth();
  if (!user) return null;

  // Manually verified (verificationLevel >= 2) — no banner needed
  if (user.verificationLevel >= 2) return null;

  const hasContact = user.phoneVerified || user.emailVerified;
  const hasPhoto = !!user.avatar;
  const allDone = hasContact && hasPhoto;

  // Both steps complete — no banner needed
  if (allDone) return null;

  const steps = [
    {
      id: "contact",
      done: hasContact,
      label: hasContact
        ? (user.phoneVerified && user.emailVerified ? "Phone & email verified" : user.phoneVerified ? "Phone verified" : "Email verified")
        : "Verify your phone or email",
      sub: hasContact ? null : "Takes 30 seconds",
      action: hasContact ? null : (user.phone ? onVerifyPhone : onVerifyEmail),
      actionLabel: "Verify now",
    },
    {
      id: "photo",
      done: hasPhoto,
      label: hasPhoto ? "Profile photo added" : "Add a profile photo",
      sub: hasPhoto ? null : "Helps the community recognise you",
      action: null as (() => void) | null,
      actionLabel: null as string | null,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <div style={{
      background: "var(--white)",
      borderRadius: 16,
      padding: "16px 16px 4px",
      marginBottom: 20,
      boxShadow: "var(--shadow)",
      border: "1.5px solid var(--border)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>Complete your profile</div>
          <div style={{ fontSize: 12, color: "var(--mid)", marginTop: 2 }}>
            {completedCount}/2 steps done
          </div>
        </div>
        {/* Progress ring */}
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: `conic-gradient(var(--green) ${(completedCount / 2) * 360}deg, var(--bg) 0deg)`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%", background: "var(--white)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 800, color: "var(--green)",
          }}>
            {completedCount}/2
          </div>
        </div>
      </div>

      {/* Steps */}
      {steps.map((step, i) => (
        <div key={step.id} style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "10px 0",
          borderTop: i > 0 ? "1px solid var(--border)" : "none",
          opacity: !step.done && i > 0 && !steps[i - 1].done ? 0.5 : 1,
        }}>
          {/* Icon */}
          <div style={{
            width: 24, height: 24, borderRadius: "50%", flexShrink: 0, marginTop: 1,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: step.done ? "var(--green)" : "var(--bg)",
            border: step.done ? "none" : "2px solid var(--border)",
            fontSize: 12,
          }}>
            {step.done
              ? <span style={{ color: "white" }}>✓</span>
              : <span style={{ color: "var(--mid)", fontSize: 11, fontWeight: 700 }}>{i + 1}</span>}
          </div>

          {/* Text */}
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: step.done ? "var(--green)" : "var(--ink)",
            }}>
              {step.label}
            </div>
            {step.sub && (
              <div style={{ fontSize: 11, color: "var(--mid)", marginTop: 2, lineHeight: 1.4 }}>
                {step.sub}
              </div>
            )}
          </div>

          {/* CTA */}
          {step.action && step.actionLabel && (
            <button
              onClick={step.action}
              style={{
                flexShrink: 0, fontSize: 11, fontWeight: 800, padding: "5px 12px",
                borderRadius: 20, border: "none", cursor: "pointer",
                fontFamily: "Nunito, sans-serif",
                background: "var(--green)",
                color: "white",
              }}
            >
              {step.actionLabel}
            </button>
          )}
        </div>
      ))}

      <div style={{ height: 8 }} />
    </div>
  );
}
