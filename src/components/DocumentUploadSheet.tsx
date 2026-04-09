"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const DOC_TYPES = [
  { value: "Hospital appointment letter",     label: "Hospital appointment letter",   emoji: "🏥" },
  { value: "Pregnancy scan / ultrasound",     label: "Pregnancy scan / ultrasound",   emoji: "🤱" },
  { value: "Birth certificate",               label: "Baby's birth certificate",       emoji: "📄" },
  { value: "Immunisation card",               label: "Immunisation / vaccination card",emoji: "💉" },
  { value: "Other maternity document",        label: "Other maternity document",       emoji: "📋" },
];

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function DocumentUploadSheet({ onClose, onSuccess }: Props) {
  const { refreshUser } = useAuth();
  const [docType, setDocType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!docType) { setError("Please choose a document type."); return; }
    if (!file) { setError("Please select a file to upload."); return; }

    setUploading(true);
    setError(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("documentType", docType);

    const res = await fetch("/api/user/document", { method: "POST", body: fd });
    const data = await res.json();

    if (!res.ok) { setError(data.error ?? "Upload failed"); setUploading(false); return; }

    await refreshUser();
    setUploading(false);
    onSuccess();
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--white)", borderRadius: "24px 24px 0 0",
        padding: "24px 20px 48px", width: "100%", maxWidth: 430,
        animation: "sheetUp 0.3s ease", maxHeight: "85vh", overflowY: "auto",
      }}>
        <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 4, margin: "0 auto 20px" }} />

        <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          Verify your motherhood 💛
        </div>
        <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 20, lineHeight: 1.6 }}>
          Upload one document to help us protect our community. Your document is kept private and only reviewed by our small team.
        </p>

        {/* Document type selector */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">What are you uploading?</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {DOC_TYPES.map((t) => (
              <label key={t.value} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", borderRadius: 12,
                border: `1.5px solid ${docType === t.value ? "var(--green)" : "var(--border)"}`,
                background: docType === t.value ? "var(--green-light)" : "var(--white)",
                cursor: "pointer", transition: "all 0.15s",
              }}>
                <input
                  type="radio" name="docType" value={t.value}
                  checked={docType === t.value}
                  onChange={() => setDocType(t.value)}
                  style={{ display: "none" }}
                />
                <span style={{ fontSize: 20 }}>{t.emoji}</span>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: docType === t.value ? "var(--green)" : "var(--ink)",
                }}>
                  {t.label}
                </span>
                {docType === t.value && (
                  <span style={{ marginLeft: "auto", color: "var(--green)", fontWeight: 800 }}>✓</span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* File picker */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Upload file (photo or PDF, max 10MB)</label>
          <label style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "24px", borderRadius: 12,
            border: `2px dashed ${file ? "var(--green)" : "var(--border)"}`,
            background: file ? "var(--green-light)" : "var(--bg)",
            cursor: "pointer", gap: 8,
          }}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              style={{ display: "none" }}
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); }}
            />
            {file ? (
              <>
                <span style={{ fontSize: 28 }}>✅</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>{file.name}</span>
                <span style={{ fontSize: 11, color: "var(--mid)" }}>{(file.size / 1024 / 1024).toFixed(1)} MB · tap to change</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 28 }}>📎</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--mid)" }}>Tap to choose file</span>
                <span style={{ fontSize: 11, color: "var(--light)" }}>JPG, PNG, WebP or PDF</span>
              </>
            )}
          </label>
        </div>

        {error && (
          <div style={{ background: "var(--terra-light)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--terra)", fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ background: "var(--bg)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "var(--mid)", lineHeight: 1.5 }}>
          🔒 Your document is stored securely and only seen by our verification team. It won't be shared publicly.
        </div>

        <button className="btn-primary" onClick={handleSubmit} disabled={uploading}>
          {uploading ? "Uploading…" : "Submit for review"}
        </button>
        <button
          onClick={onClose}
          style={{ width: "100%", marginTop: 10, padding: "12px", background: "none", border: "none", color: "var(--mid)", fontSize: 14, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
