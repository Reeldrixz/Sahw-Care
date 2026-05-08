"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import Toast from "@/components/Toast";
import PhoneSetupSheet from "@/components/PhoneSetupSheet";

export default function AccountPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [toast,         setToast]         = useState<string | null>(null);
  const [showPhone,     setShowPhone]     = useState(false);
  const [showVerify,    setShowVerify]    = useState(false);
  const [verifyType,    setVerifyType]    = useState<"PHONE" | "EMAIL">("EMAIL");
  const [otpStep,       setOtpStep]       = useState<"send" | "confirm">("send");
  const [otpCode,       setOtpCode]       = useState("");
  const [devOtp,        setDevOtp]        = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const sendOtp = async () => {
    setVerifyLoading(true);
    const res = await fetch("/api/verify/send-otp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: verifyType }),
    });
    const d = await res.json();
    if (!res.ok) { setToast(d.error); setVerifyLoading(false); return; }
    setOtpStep("confirm");
    if (d.devCode) setDevOtp(d.devCode);
    setVerifyLoading(false);
  };

  const confirmOtp = async () => {
    if (!otpCode.trim()) return;
    setVerifyLoading(true);
    const res = await fetch("/api/verify/confirm-otp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: verifyType, code: otpCode }),
    });
    const d = await res.json();
    if (!res.ok) { setToast(d.error); setVerifyLoading(false); return; }
    await refreshUser();
    setShowVerify(false); setOtpStep("send"); setOtpCode(""); setDevOtp(null);
    setToast(`${verifyType === "PHONE" ? "Phone" : "Email"} verified!`);
    setVerifyLoading(false);
  };

  if (!user) return null;

  const maskedPhone = user.phone
    ? user.phone.slice(0, -4).replace(/\d/g, "•") + user.phone.slice(-4)
    : null;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 80 }}>
      <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "20px 16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}
          >
            <ArrowLeft size={16} strokeWidth={2} color="white" />
          </button>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "white" }}>Account details</div>
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        <div style={{ background: "white", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 12 }}>
          {/* Phone */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 24 }}>📱</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Phone number</div>
              <div style={{ fontSize: 12, color: "var(--mid)", marginTop: 2 }}>
                {maskedPhone ?? "Not added"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
              {user.phoneVerified && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#1a7a5e", background: "#e8f5f1", padding: "3px 10px", borderRadius: 20 }}>✓ Verified</span>
              )}
              <button
                onClick={() => setShowPhone(true)}
                style={{ fontSize: 11, fontWeight: 700, color: "var(--mid)", background: "none", border: "1.5px solid var(--border)", padding: "4px 10px", borderRadius: 20, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
              >
                {user.phone ? "Change" : "Add"}
              </button>
            </div>
          </div>

          {/* Email */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px" }}>
            <span style={{ fontSize: 24 }}>📧</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Email address</div>
              <div style={{ fontSize: 12, color: "var(--mid)", marginTop: 2 }}>
                {user.email ?? "Not added"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
              {user.emailVerified ? (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#1a7a5e", background: "#e8f5f1", padding: "3px 10px", borderRadius: 20 }}>✓ Verified</span>
              ) : user.email ? (
                <button
                  onClick={() => { setVerifyType("EMAIL"); setOtpStep("send"); setOtpCode(""); setDevOtp(null); setShowVerify(true); }}
                  style={{ fontSize: 11, fontWeight: 700, color: "white", background: "#1a7a5e", border: "none", padding: "4px 10px", borderRadius: 20, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                >
                  Verify
                </button>
              ) : (
                <span style={{ fontSize: 11, color: "var(--light)" }}>—</span>
              )}
            </div>
          </div>
        </div>

        <div style={{ background: "#f8fafc", borderRadius: 14, padding: "12px 14px", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 12, color: "var(--mid)", lineHeight: 1.6 }}>
            Member since {new Date(user.createdAt).getFullYear()} · Account ID ending in {user.id.slice(-6)}
          </div>
        </div>
      </div>

      {/* OTP sheet */}
      {showVerify && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowVerify(false); }}>
          <div style={{ background: "white", borderRadius: "24px 24px 0 0", padding: "24px 20px 48px", width: "100%", maxWidth: 430 }}>
            <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 4, margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Verify your {verifyType === "PHONE" ? "phone" : "email"}
            </div>
            {otpStep === "send" ? (
              <>
                <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 20, lineHeight: 1.6 }}>
                  We&apos;ll send a 6-digit code to <strong>{verifyType === "PHONE" ? (user.phone ?? "") : (user.email ?? "")}</strong>.
                </p>
                <button className="btn-primary" onClick={sendOtp} disabled={verifyLoading}>{verifyLoading ? "Sending..." : "Send code"}</button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 16, lineHeight: 1.6 }}>
                  Enter the code sent to <strong>{verifyType === "PHONE" ? (user.phone ?? "") : (user.email ?? "")}</strong>.
                </p>
                {devOtp && (
                  <div style={{ background: "var(--yellow-light)", borderRadius: 10, padding: "8px 14px", marginBottom: 14, fontSize: 13, color: "#b8860b", fontWeight: 700 }}>
                    Dev mode — code: <strong>{devOtp}</strong>
                  </div>
                )}
                <div className="form-group">
                  <input className="form-input" placeholder="000000" value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    onKeyDown={(e) => e.key === "Enter" && confirmOtp()}
                    style={{ letterSpacing: 6, fontSize: 22, textAlign: "center", fontWeight: 800 }}
                    maxLength={6} inputMode="numeric"
                  />
                </div>
                <button className="btn-primary" onClick={confirmOtp} disabled={verifyLoading || otpCode.length < 6}>{verifyLoading ? "Verifying..." : "Confirm"}</button>
                <button style={{ background: "none", border: "none", color: "var(--mid)", fontSize: 13, display: "block", margin: "12px auto 0", cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                  onClick={() => { setOtpStep("send"); setDevOtp(null); setOtpCode(""); }}>
                  ← Resend code
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showPhone && (
        <PhoneSetupSheet
          existingPhone={user.phone}
          onClose={() => setShowPhone(false)}
          onSuccess={async () => { setShowPhone(false); await refreshUser(); setToast("Phone updated ✓"); }}
        />
      )}

      <BottomNav />
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
