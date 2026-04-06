"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

function AuthForm() {
  const { user, login, register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authMode, setAuthMode] = useState<"login" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "login"
  );
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) router.push("/");
  }, [user, router]);

  const handleSubmit = async () => {
    setError("");
    if (!identifier || !password) { setError("All fields are required"); return; }
    if (authMode === "signup" && !name) { setError("Name is required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setLoading(true);
    try {
      if (authMode === "login") {
        await login(identifier, password);
      } else {
        await register(name, identifier, password);
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🤲 Kradel</div>
        <div className="auth-sub">Free baby &amp; maternal items near you</div>

        <div className="auth-tabs">
          <button className={`auth-tab ${authMode === "login" ? "active" : ""}`} onClick={() => { setAuthMode("login"); setError(""); }}>Sign In</button>
          <button className={`auth-tab ${authMode === "signup" ? "active" : ""}`} onClick={() => { setAuthMode("signup"); setError(""); }}>Join Free</button>
        </div>

        {authMode === "signup" && (
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Email or Phone</label>
          <input className="form-input" placeholder="email@example.com or 08012345678" value={identifier} onChange={(e) => setIdentifier(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
        </div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <div style={{ position: "relative" }}>
            <input
              className="form-input"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              style={{ paddingRight: 44, width: "100%" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--mid)", padding: 0, lineHeight: 1 }}
              tabIndex={-1}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        {authMode === "login" && (
          <div style={{ textAlign: "right", marginBottom: 12, marginTop: -4 }}>
            <span
              style={{ fontSize: 12, color: "var(--green)", cursor: "pointer", fontWeight: 700 }}
              onClick={() => router.push("/auth/forgot-password")}
            >
              Forgot password?
            </span>
          </div>
        )}

        {error && <div style={{ color: "#dc3232", fontSize: 13, marginBottom: 12, textAlign: "center", fontWeight: 600 }}>{error}</div>}

        <button className="btn-primary" onClick={handleSubmit} disabled={loading} style={{ marginTop: 4 }}>
          {loading ? "Please wait..." : authMode === "login" ? "Sign In" : "Create Free Account"}
        </button>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--mid)", marginTop: 16, fontWeight: 600 }}>
          {authMode === "login" ? "New here? " : "Already have an account? "}
          <span style={{ color: "var(--green)", cursor: "pointer", fontWeight: 800 }} onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setError(""); }}>
            {authMode === "login" ? "Create a free account" : "Sign in"}
          </span>
        </p>
        <button style={{ background: "none", border: "none", color: "var(--mid)", fontSize: 13, display: "block", margin: "8px auto 0", cursor: "pointer", fontFamily: "Nunito, sans-serif", fontWeight: 600 }} onClick={() => router.push("/")}>
          ← Back to discover
        </button>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>}>
      <AuthForm />
    </Suspense>
  );
}
