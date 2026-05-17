"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

function ReportBugForm() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [description,    setDescription]    = useState("");
  const [pageUrl,        setPageUrl]        = useState("");
  const [email,          setEmail]          = useState("");
  const [overrideEmail,  setOverrideEmail]  = useState(false);
  const [screenshot,     setScreenshot]     = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const [uploading,      setUploading]      = useState(false);
  const [busy,           setBusy]           = useState(false);
  const [done,           setDone]           = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const from = searchParams.get("from");
    if (from) { setPageUrl(from); return; }
    if (typeof document !== "undefined" && document.referrer && !document.referrer.includes("/report-bug")) {
      setPageUrl(document.referrer);
    }
  }, [searchParams]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/bug-reports/upload-screenshot", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Screenshot upload failed"); return; }
      setScreenshot(d.url);
      setScreenshotName(file.name);
    } catch {
      setError("Screenshot upload failed. You can still submit without it.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (description.trim().length < 10) {
      setError("Please describe the issue in at least 10 characters.");
      return;
    }
    const contactEmail = overrideEmail || !user ? email.trim() : "";
    if (!user && !contactEmail) {
      setError("Please provide your email so we can follow up.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/bug-reports", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          description:   description.trim(),
          pageUrl:       pageUrl.trim() || undefined,
          email:         contactEmail || undefined,
          screenshotUrl: screenshot ?? undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Something went wrong. Please try again."); return; }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div style={{ background: "#faf8f3", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
        <div style={{ background: "white", borderRadius: 24, border: "1px solid #ede8df", padding: "40px 32px", maxWidth: 440, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💜</div>
          <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>Thank you.</div>
          <p style={{ fontSize: 14, color: "#6b7280", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, marginBottom: 28 }}>
            We&apos;ve received your report. We&apos;ll look into it as soon as possible.
          </p>
          <button
            onClick={() => { if (window.history.length > 2) router.back(); else router.push("/"); }}
            style={{ background: "#1a7a5e", color: "white", border: "none", borderRadius: 12, padding: "13px 28px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const charCount = description.length;
  const showEmailField = !user || overrideEmail;

  return (
    <div style={{ background: "#faf8f3", minHeight: "100vh", padding: "32px 16px 80px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ background: "white", borderRadius: 24, border: "1px solid #ede8df", padding: "32px 28px" }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 24, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>
              Report a bug
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, margin: 0 }}>
              Something broken? Confusing? Tell us so we can fix it.
            </p>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", fontFamily: "Nunito, sans-serif", marginBottom: 6 }}>
              What happened? *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you were doing and what went wrong..."
              maxLength={2000}
              rows={5}
              style={{ width: "100%", padding: "11px 13px", border: "1.5px solid #ede8df", borderRadius: 12, fontSize: 13, fontFamily: "Nunito, sans-serif", lineHeight: 1.5, resize: "vertical", outline: "none", boxSizing: "border-box", background: charCount > 1900 ? "#fffbf0" : "white" }}
            />
            <div style={{ fontSize: 11, color: charCount > 1900 ? "#d97706" : "#9ca3af", textAlign: "right", marginTop: 4, fontFamily: "Nunito, sans-serif" }}>
              {charCount}/2000
            </div>
          </div>

          {/* Page URL */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", fontFamily: "Nunito, sans-serif", marginBottom: 6 }}>
              Page or feature <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span>
            </label>
            <input
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value)}
              placeholder="Which page were you on?"
              style={{ width: "100%", padding: "11px 13px", border: "1.5px solid #ede8df", borderRadius: 12, fontSize: 13, fontFamily: "Nunito, sans-serif", outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Email */}
          {user && !overrideEmail ? (
            <div style={{ marginBottom: 18, padding: "11px 13px", background: "#f9fafb", borderRadius: 12, border: "1.5px solid #ede8df" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", fontFamily: "Nunito, sans-serif", marginBottom: 2 }}>Contact email</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "#374151", fontFamily: "Nunito, sans-serif" }}>{user.email ?? "(none on file)"}</span>
                <button onClick={() => setOverrideEmail(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", fontWeight: 700, padding: 0 }}>
                  Use a different email
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#374151", fontFamily: "Nunito, sans-serif" }}>
                  Your email {!user && <span style={{ color: "#c0392b" }}>*</span>}
                  {user && <span style={{ fontWeight: 400, color: "#9ca3af" }}> (optional)</span>}
                </label>
                {user && overrideEmail && (
                  <button onClick={() => { setOverrideEmail(false); setEmail(""); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9ca3af", fontFamily: "Nunito, sans-serif", padding: 0 }}>
                    Cancel
                  </button>
                )}
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={{ width: "100%", padding: "11px 13px", border: "1.5px solid #ede8df", borderRadius: 12, fontSize: 13, fontFamily: "Nunito, sans-serif", outline: "none", boxSizing: "border-box" }}
              />
            </div>
          )}

          {/* Screenshot */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", fontFamily: "Nunito, sans-serif", marginBottom: 6 }}>
              Add a screenshot <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span>
            </label>
            {screenshot ? (
              <div style={{ position: "relative", display: "inline-block" }}>
                <img src={screenshot} alt="Screenshot preview" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 10, border: "1.5px solid #ede8df" }} />
                <button
                  onClick={() => { setScreenshot(null); setScreenshotName(null); if (fileRef.current) fileRef.current.value = ""; }}
                  style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: 6, padding: "3px 7px", fontSize: 11, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                >
                  Remove
                </button>
                {screenshotName && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, fontFamily: "Nunito, sans-serif" }}>{screenshotName}</div>}
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{ width: "100%", padding: "13px", border: "1.5px dashed #ede8df", borderRadius: 12, background: "#faf8f3", cursor: uploading ? "wait" : "pointer", fontSize: 13, color: "#6b7280", fontFamily: "Nunito, sans-serif", textAlign: "center" }}
              >
                {uploading ? "Uploading…" : "📎 Click to attach a screenshot"}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "11px 14px", fontSize: 13, color: "#c0392b", fontFamily: "Nunito, sans-serif", marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={busy || uploading}
            style={{ width: "100%", padding: "14px", background: busy ? "#9ca3af" : "#1a7a5e", color: "white", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 800, cursor: busy ? "not-allowed" : "pointer", fontFamily: "Nunito, sans-serif" }}
          >
            {busy ? "Sending…" : "Submit report"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReportBugPage() {
  return (
    <Suspense>
      <ReportBugForm />
    </Suspense>
  );
}
