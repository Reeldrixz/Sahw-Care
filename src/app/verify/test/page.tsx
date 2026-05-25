// TEMPORARY: remove after Persona sandbox testing
"use client";

import { useState } from "react";

export default function PersonaTestPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError]   = useState<string | null>(null);

  const handleVerify = async () => {
    setStatus("loading");
    setError(null);
    try {
      const res  = await fetch("/api/verify/persona/start", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Request failed");
        setStatus("error");
        return;
      }

      if (data.alreadyVerified) {
        setError("This account is already identity-verified.");
        setStatus("error");
        return;
      }

      window.location.href = data.hostedUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStatus("error");
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#faf8f3", padding: 24,
      fontFamily: "Nunito, sans-serif",
    }}>
      <div style={{
        background: "white", border: "2px dashed #e8c84b", borderRadius: 20,
        padding: "36px 32px", maxWidth: 380, width: "100%", textAlign: "center",
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "#b07d00", marginBottom: 8 }}>
          TEMPORARY TEST PAGE
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#1a4a3a", marginBottom: 8 }}>
          Persona sandbox flow
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 28, lineHeight: 1.6 }}>
          Starts a Persona inquiry for the logged-in user and redirects to the hosted verification flow.
        </div>

        <button
          onClick={handleVerify}
          disabled={status === "loading"}
          style={{
            width: "100%", padding: "13px", borderRadius: 12, border: "none",
            background: status === "loading" ? "#b6d9c7" : "#1a4a3a",
            color: "white", fontSize: 15, fontWeight: 800, cursor: status === "loading" ? "not-allowed" : "pointer",
            fontFamily: "Nunito, sans-serif", transition: "background 0.15s",
          }}
        >
          {status === "loading" ? "Starting…" : "Verify identity (TEST)"}
        </button>

        {error && (
          <div style={{
            marginTop: 16, padding: "10px 14px", background: "#fef2f2",
            border: "1px solid #fca5a5", borderRadius: 10,
            fontSize: 13, color: "#b91c1c", fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 20, fontSize: 11, color: "#9ca3af" }}>
          Delete <code>src/app/verify/test/page.tsx</code> when done.
        </div>
      </div>
    </div>
  );
}
