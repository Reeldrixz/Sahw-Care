"use client";

import { useState, useRef } from "react";

interface DonateModalProps {
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
}

const CATEGORIES = ["Baby Milk", "Diapers", "Maternity", "Clothing", "Accessories", "Other"];

export default function DonateModal({ onClose, onSubmit }: DonateModalProps) {
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: "",
    category: "Baby Milk",
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">List a Donation</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
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

          <button
            className="btn-primary"
            style={{ width: "100%", padding: "13px", fontSize: 15, borderRadius: 12, marginTop: 8 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Submitting..." : "🎁 Submit Donation"}
          </button>
        </div>
      </div>
    </div>
  );
}
