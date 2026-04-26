"use client";

import { useState, useRef } from "react";
import { X } from "lucide-react";

interface DonateModalProps {
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
}

const CATEGORIES = ["Feeding", "Diapering", "Maternity", "Clothing", "Hygiene", "Other"];

export default function DonateModal({ onClose, onSubmit }: DonateModalProps) {
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "",
    category: "Feeding",
    condition: "New (unopened)",
    quantity: "",
    location: "",
    description: "",
    urgent: false,
  });

  const set = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!form.title || !form.quantity || !form.location) {
      alert("Please fill in all required fields");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
      if (fileRef.current?.files?.[0]) {
        fd.append("file", fileRef.current.files[0]);
      }
      await onSubmit(fd);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 200,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--white)",
          borderRadius: "24px 24px 0 0",
          width: "100%",
          maxWidth: 430,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          animation: "sheetUp 0.3s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 4, margin: "12px auto 0" }} />

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px 0" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700 }}>List a Donation</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={20} color="var(--ink)" />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 0" }}>
          <div className="form-grid">
            <div className="form-group full">
              <label className="form-label">Item Title *</label>
              <input
                className="form-input"
                placeholder="e.g. Pampers Newborn Size 1 (2 packs)"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Category *</label>
              <select
                className="form-select"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Condition *</label>
              <select
                className="form-select"
                value={form.condition}
                onChange={(e) => set("condition", e.target.value)}
              >
                <option>New (unopened)</option>
                <option>Slightly used</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Quantity *</label>
              <input
                className="form-input"
                placeholder="e.g. 2 packs, 1 unit"
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">City / Area *</label>
              <input
                className="form-input"
                placeholder="e.g. Ikeja, Lagos"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
              />
            </div>

            <div className="form-group full">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                placeholder="Any details — expiry date, size, brand, reason for donating..."
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>

            <div className="form-group full" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                id="urgent"
                checked={form.urgent}
                onChange={(e) => set("urgent", e.target.checked)}
              />
              <label htmlFor="urgent" className="form-label" style={{ marginBottom: 0, cursor: "pointer" }}>
                Mark as urgent
              </label>
            </div>

            <div className="form-group full">
              <label className="form-label">Photo</label>
              <div
                className="upload-area"
                onClick={() => fileRef.current?.click()}
              >
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Preview" style={{ maxHeight: 120, borderRadius: 8, objectFit: "cover" }} />
                ) : (
                  <>
                    <div className="upload-icon">📸</div>
                    <div className="upload-text">
                      <strong>Click to upload</strong> or drag and drop
                    </div>
                    <div style={{ fontSize: 12, color: "var(--light)", marginTop: 4 }}>PNG, JPG up to 5MB</div>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFile}
              />
            </div>
          </div>
        </div>

        {/* Sticky submit button */}
        <div style={{ padding: "12px 16px 32px", borderTop: "1px solid var(--border)" }}>
          <button
            className="btn-primary"
            style={{ width: "100%", padding: "13px", fontSize: 15, borderRadius: 12 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Submitting..." : "Post listing"}
          </button>
        </div>
      </div>
    </div>
  );
}
