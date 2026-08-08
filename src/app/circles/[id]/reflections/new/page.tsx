"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ReflectionResources from "@/components/ReflectionResources";
import { CheckCircle, ArrowLeft } from "lucide-react";

const SERIF = "Lora, Georgia, serif";
const SANS  = "Nunito, sans-serif";

export default function NewReflectionPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { id: circleId } = useParams<{ id: string }>();

  const [title, setTitle]         = useState("");
  const [body, setBody]           = useState("");
  const [mode, setMode]           = useState<"write" | "preview">("write");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Only RECIPIENT mothers may write. Donors never reach here.
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/auth"); return; }
    if (user.journeyType === "donor") { router.replace("/"); return; }
    if (user.role !== "RECIPIENT") { router.replace(`/circles/${circleId}/reflections`); return; }
  }, [authLoading, user, router, circleId]);

  const canSubmit = title.trim().length >= 3 && body.trim().length >= 50;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setError(null);
    try {
      const r = await fetch("/api/circles/reflections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error ?? "Something went wrong. Please try again.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Network error. Please check your connection.");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div style={{ background: "var(--bg, #faf7f2)", minHeight: "100vh", padding: "24px 16px" }}>
        <div style={{ maxWidth: 640, margin: "40px auto 0", background: "white", border: "1px solid #eee", borderRadius: 16, padding: "40px 24px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <CheckCircle size={26} color="#1a7a5e" strokeWidth={1.75} />
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, color: "#1a1a1a", marginBottom: 10 }}>Thank you for sharing</div>
          <p style={{ fontFamily: SANS, fontSize: 14, color: "#555", lineHeight: 1.7, maxWidth: 420, margin: "0 auto 22px" }}>
            Your reflection has been received and will be read by our team before it appears in your stage&apos;s space.
            This usually takes a little while, and you&apos;ll be notified once it&apos;s published.
          </p>
          <button
            onClick={() => router.push(`/circles/${circleId}/reflections`)}
            style={{ padding: "12px 28px", background: "#1a7a5e", border: "none", borderRadius: 12, fontFamily: SANS, fontSize: 14, fontWeight: 800, color: "white", cursor: "pointer" }}
          >
            Back to Reflections
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg, #faf7f2)", minHeight: "100vh", paddingBottom: 40 }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "18px 16px 0" }}>
        <button
          onClick={() => router.push(`/circles/${circleId}/reflections`)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#1a7a5e", fontFamily: SANS, fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0, marginBottom: 14 }}
        >
          <ArrowLeft size={15} strokeWidth={2} /> Back to Reflections
        </button>

        <ReflectionResources />

        {mode === "write" ? (
          <div style={{ background: "white", border: "1px solid #eee", borderRadius: 16, padding: "20px" }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your reflection a title"
              maxLength={120}
              style={{ width: "100%", border: "none", outline: "none", fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: "#1a1a1a", marginBottom: 12, boxSizing: "border-box" }}
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share what this stage feels like for you. Take your time."
              rows={14}
              maxLength={8000}
              style={{ width: "100%", border: "none", outline: "none", resize: "vertical", fontFamily: SANS, fontSize: 15.5, color: "#333", lineHeight: 1.8, minHeight: 260, boxSizing: "border-box" }}
            />
            <div style={{ fontFamily: SANS, fontSize: 12, color: "#9ca3af", textAlign: "right", marginBottom: 12 }}>{body.trim().length}/8000</div>

            <div style={{ background: "#f8faf9", border: "1px solid #e0ede8", borderRadius: 10, padding: "11px 14px", marginBottom: 16 }}>
              <p style={{ fontFamily: SANS, fontSize: 12.5, color: "#555", lineHeight: 1.6, margin: 0 }}>
                This space is for your experience and state of mind. It isn&apos;t for requests, donations, or urgent help.
                If you need support right now, the resources above are here for you.
              </p>
            </div>

            {error && (
              <div style={{ padding: "10px 14px", background: "#fdecea", borderRadius: 10, fontSize: 13, color: "#c0392b", fontFamily: SANS, marginBottom: 14 }}>{error}</div>
            )}

            <button
              onClick={() => setMode("preview")}
              disabled={!canSubmit}
              style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: canSubmit ? "#1a7a5e" : "#9ca3af", color: "white", fontFamily: SANS, fontSize: 14, fontWeight: 800, cursor: canSubmit ? "pointer" : "not-allowed" }}
            >
              Preview
            </button>
          </div>
        ) : (
          <div style={{ background: "white", border: "1px solid #eee", borderRadius: 16, padding: "24px" }}>
            <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Preview</div>
            <h1 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 700, color: "#1a1a1a", margin: "0 0 6px", lineHeight: 1.3 }}>{title.trim()}</h1>
            <div style={{ fontFamily: SANS, fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>
              {(user?.name?.split(" ")[0]) || "You"} · your stage
            </div>
            <div style={{ fontFamily: SANS, fontSize: 15.5, color: "#333", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{body.trim()}</div>

            {error && (
              <div style={{ padding: "10px 14px", background: "#fdecea", borderRadius: 10, fontSize: 13, color: "#c0392b", fontFamily: SANS, margin: "16px 0 0" }}>{error}</div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button
                onClick={() => setMode("write")}
                disabled={submitting}
                style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1.5px solid #e0e0e0", background: "white", color: "#555", fontFamily: SANS, fontSize: 14, fontWeight: 800, cursor: "pointer" }}
              >
                Keep editing
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                style={{ flex: 1, padding: "13px", borderRadius: 12, border: "none", background: submitting ? "#9ca3af" : "#1a7a5e", color: "white", fontFamily: SANS, fontSize: 14, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer" }}
              >
                {submitting ? "Submitting…" : "Submit for review"}
              </button>
            </div>
            <p style={{ fontFamily: SANS, fontSize: 11.5, color: "#9ca3af", textAlign: "center", margin: "12px 0 0", lineHeight: 1.6 }}>
              Your reflection is read by our team before it appears in your stage&apos;s space.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
