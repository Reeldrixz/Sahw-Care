"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { Heart, ShieldCheck } from "lucide-react";

type Phase = "checking" | "invalid" | "ready";

export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(Array.isArray(params.code) ? params.code[0] : params.code ?? "");
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();

  const [phase, setPhase]           = useState<Phase>("checking");
  const [partnerName, setPartner]   = useState<string>("");
  const [name, setName]             = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // ── Validate the code (non-leaking endpoint) ──────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/referral/validate?code=${encodeURIComponent(code)}`);
        const d = await r.json().catch(() => ({ valid: false }));
        if (cancelled) return;
        if (d.valid) { setPartner(d.partnerName ?? ""); setPhase("ready"); }
        else setPhase("invalid");
      } catch {
        if (!cancelled) setPhase("invalid");
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  const finish = useCallback(async () => {
    await refreshUser();
    router.push("/");
  }, [refreshUser, router]);

  // ── New-account signup (email/password) with the code attached ────────────
  const handleSignup = async () => {
    setError(null);
    if (!name.trim())       { setError("Please enter your name."); return; }
    if (!identifier.trim()) { setError("Please enter an email or phone number."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/auth/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, identifier, password, referralCode: code }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? "Something went wrong. Please try again."); setSubmitting(false); return; }
      await finish();
    } catch {
      setError("Network error. Please check your connection.");
      setSubmitting(false);
    }
  };

  // ── Existing logged-in DONOR redeeming (authenticated upgrade) ────────────
  const handleRedeem = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch("/api/referral/redeem", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? "Something went wrong. Please try again."); setSubmitting(false); return; }
      await finish();
    } catch {
      setError("Network error. Please check your connection.");
      setSubmitting(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: "100vh", background: "#faf8f3", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px" }}>
      <div style={{ width: "100%", maxWidth: 440, background: "white", borderRadius: 24, boxShadow: "0 8px 40px rgba(0,0,0,0.10)", padding: "36px 28px" }}>
        {children}
      </div>
    </div>
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (phase === "checking" || authLoading) {
    return shell(
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <div className="spinner" style={{ margin: "0 auto 16px" }} />
        <div style={{ fontSize: 14, color: "#666", fontFamily: "Nunito, sans-serif" }}>Checking your invitation…</div>
      </div>,
    );
  }

  // ── Invalid / used / expired — warm, non-leaking ─────────────────────────
  if (phase === "invalid") {
    return shell(
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f0ede6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
          <Heart size={24} color="#1a7a5e" strokeWidth={1.75} />
        </div>
        <div style={{ fontFamily: "Lora, serif", fontSize: 21, fontWeight: 700, color: "#1a1a1a", marginBottom: 10 }}>
          This invitation can&apos;t be opened
        </div>
        <div style={{ fontSize: 14, color: "#555", fontFamily: "Nunito, sans-serif", lineHeight: 1.7, marginBottom: 24 }}>
          This invitation link can&apos;t be used right now. Please reach out to the organization that referred you. They&apos;ll be able to help you get set up.
        </div>
        <button onClick={() => router.push("/find-help")} style={btnGhost}>Find support near you</button>
      </div>,
    );
  }

  // ── Valid code ────────────────────────────────────────────────────────────
  const invitedBy = partnerName ? `You've been invited by ${partnerName}.` : "You've been personally invited.";

  // Already a mother or an admin — nothing to redeem.
  if (user && user.role !== "DONOR") {
    return shell(
      <div style={{ textAlign: "center" }}>
        <div style={welcomeBadge}><ShieldCheck size={24} color="#1a7a5e" strokeWidth={1.75} /></div>
        <div style={{ fontFamily: "Lora, serif", fontSize: 21, fontWeight: 700, color: "#1a1a1a", marginBottom: 10 }}>You&apos;re already set up</div>
        <div style={{ fontSize: 14, color: "#555", fontFamily: "Nunito, sans-serif", lineHeight: 1.7, marginBottom: 24 }}>
          Your account is ready to go. Head back to Kradel to continue.
        </div>
        <button onClick={() => router.push("/")} style={btnPrimary}>Continue to Kradel →</button>
      </div>,
    );
  }

  return shell(
    <>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={welcomeBadge}><Heart size={24} color="#1a7a5e" strokeWidth={1.75} fill="#1a7a5e" /></div>
        <div style={{ fontFamily: "Lora, serif", fontSize: 23, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>
          Welcome to Kradel
        </div>
        <div style={{ fontSize: 14, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", fontWeight: 700, marginBottom: 6 }}>
          {invitedBy}
        </div>
        <div style={{ fontSize: 13, color: "#666", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
          Create your account to access curated support for your pregnancy and motherhood journey. Always free.
        </div>
      </div>

      {user ? (
        // Existing logged-in DONOR redeeming.
        <div>
          <div style={{ fontSize: 13, color: "#555", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, textAlign: "center", marginBottom: 18 }}>
            You&apos;re signed in as <strong>{user.name}</strong>. Confirm to join as a mother.
          </div>
          {error && <div style={errBox}>{error}</div>}
          <button onClick={handleRedeem} disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "Setting up…" : "Confirm & join →"}
          </button>
        </div>
      ) : (
        <>
          <label style={labelStyle}>Full name</label>
          <input style={inputStyle} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <label style={labelStyle}>Email or phone</label>
          <input style={inputStyle} placeholder="email@example.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          <label style={labelStyle}>Password</label>
          <input style={inputStyle} type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSignup()} />

          {error && <div style={errBox}>{error}</div>}

          <button onClick={handleSignup} disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.7 : 1, marginTop: 6 }}>
            {submitting ? "Setting up…" : "Create my account →"}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 14px" }}>
            <div style={{ flex: 1, height: 1, background: "#e8e4dc" }} />
            <span style={{ fontSize: 12, color: "#999", fontWeight: 600, fontFamily: "Nunito, sans-serif" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "#e8e4dc" }} />
          </div>
          <GoogleSignInButton referralCode={code} onSuccess={finish} onError={(m) => setError(m)} />
        </>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 22, padding: "10px 12px", background: "#f8faf9", borderRadius: 10, border: "1px solid #e0ede8" }}>
        <ShieldCheck size={14} color="#1a7a5e" strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 11, color: "#555", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>
          Your information is private and only used to support your journey. It&apos;s never shared or shown publicly.
        </div>
      </div>
    </>,
  );
}

const welcomeBadge: React.CSSProperties = {
  width: 56, height: 56, borderRadius: "50%", background: "#e8f5f1",
  display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 700, color: "#1a1a1a",
  fontFamily: "Nunito, sans-serif", marginBottom: 5, marginTop: 12,
};
const inputStyle: React.CSSProperties = {
  display: "block", width: "100%", padding: "11px 13px", marginBottom: 2,
  border: "1.5px solid #e0e0e0", borderRadius: 10, fontSize: 14, color: "#1a1a1a",
  fontFamily: "Nunito, sans-serif", background: "white", boxSizing: "border-box", outline: "none",
};
const btnPrimary: React.CSSProperties = {
  width: "100%", padding: "13px", background: "#1a7a5e", border: "none", borderRadius: 12,
  fontSize: 15, fontWeight: 800, color: "white", cursor: "pointer", fontFamily: "Nunito, sans-serif",
};
const btnGhost: React.CSSProperties = {
  width: "100%", padding: "12px", background: "transparent", border: "1.5px solid #1a7a5e",
  borderRadius: 12, fontSize: 14, fontWeight: 800, color: "#1a7a5e", cursor: "pointer", fontFamily: "Nunito, sans-serif",
};
const errBox: React.CSSProperties = {
  padding: "10px 14px", background: "#fdecea", borderRadius: 10, fontSize: 13, color: "#c0392b",
  fontFamily: "Nunito, sans-serif", margin: "12px 0", lineHeight: 1.5,
};
