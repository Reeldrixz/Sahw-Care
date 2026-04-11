"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!identifier) return;
    setSubmitted(true);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Kradəl</div>
        <div className="auth-sub" style={{ marginBottom: 24 }}>Password reset</div>

        {submitted ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Check your inbox</div>
            <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 24, lineHeight: 1.6 }}>
              If an account exists for <strong>{identifier}</strong>, you&apos;ll receive a reset link shortly.
            </p>
            <button className="btn-primary" onClick={() => router.push("/auth")}>Back to Sign In</button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 20, lineHeight: 1.6 }}>
              Enter your email or phone number and we&apos;ll send you a link to reset your password.
            </p>
            <div className="form-group">
              <label className="form-label">Email or Phone</label>
              <input
                className="form-input"
                placeholder="email@example.com or 08012345678"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
            <button className="btn-primary" onClick={handleSubmit} style={{ marginTop: 8 }}>
              Send Reset Link
            </button>
            <button
              style={{ background: "none", border: "none", color: "var(--mid)", fontSize: 13, display: "block", margin: "12px auto 0", cursor: "pointer", fontFamily: "Nunito, sans-serif", fontWeight: 600 }}
              onClick={() => router.push("/auth")}
            >
              ← Back to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
}
