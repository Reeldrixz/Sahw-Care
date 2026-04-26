"use client";

import { useState, useRef } from "react";
import { X, ImagePlus } from "lucide-react";

interface DonateModalProps {
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
}

const CATEGORIES = ["Feeding", "Diapering", "Maternity", "Clothing", "Hygiene", "Other"];

const field: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 12,
  background: "#f5f5f5",
  border: "1.5px solid transparent",
  fontSize: 14,
  fontFamily: "Nunito, sans-serif",
  color: "#1a1a1a",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
};

const label: React.CSSProperties = {
  display: "block",
  fontFamily: "Nunito, sans-serif",
  fontWeight: 600,
  fontSize: 12,
  color: "#444",
  marginBottom: 6,
};

export default function DonateModal({ onClose, onSubmit }: DonateModalProps) {
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
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

  const set = (f: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [f]: value }));

  const focusBorder = (name: string): React.CSSProperties =>
    focused === name ? { ...field, border: "1.5px solid #1a7a5e" } : field;

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
      if (fileRef.current?.files?.[0]) fd.append("file", fileRef.current.files[0]);
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
          background: "#fff",
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
        <div style={{ width: 40, height: 4, background: "#ddd", borderRadius: 4, margin: "12px auto 0" }} />

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 0" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "#1a1a1a" }}>
            List a Donation
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
          >
            <X size={20} color="#333" />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 0" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Title */}
            <div>
              <label style={label}>Item Title *</label>
              <input
                style={focusBorder("title")}
                placeholder="e.g. Pampers Newborn Size 1 (2 packs)"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                onFocus={() => setFocused("title")}
                onBlur={() => setFocused(null)}
              />
            </div>

            {/* Category + Condition */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={label}>Category *</label>
                <select
                  style={{ ...focusBorder("category"), appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  onFocus={() => setFocused("category")}
                  onBlur={() => setFocused(null)}
                >
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Condition *</label>
                <select
                  style={{ ...focusBorder("condition"), appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}
                  value={form.condition}
                  onChange={(e) => set("condition", e.target.value)}
                  onFocus={() => setFocused("condition")}
                  onBlur={() => setFocused(null)}
                >
                  <option>New (unopened)</option>
                  <option>Slightly used</option>
                </select>
              </div>
            </div>

            {/* Quantity + Location */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={label}>Quantity *</label>
                <input
                  style={focusBorder("quantity")}
                  placeholder="e.g. 2 packs"
                  value={form.quantity}
                  onChange={(e) => set("quantity", e.target.value)}
                  onFocus={() => setFocused("quantity")}
                  onBlur={() => setFocused(null)}
                />
              </div>
              <div>
                <label style={label}>City / Area *</label>
                <input
                  style={focusBorder("location")}
                  placeholder="e.g. Ikeja, Lagos"
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                  onFocus={() => setFocused("location")}
                  onBlur={() => setFocused(null)}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label style={label}>Description</label>
              <textarea
                style={{ ...focusBorder("desc"), resize: "none", minHeight: 80 }}
                placeholder="Any details — expiry date, size, brand, reason for donating..."
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                onFocus={() => setFocused("desc")}
                onBlur={() => setFocused(null)}
              />
            </div>

            {/* Mark as urgent */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="checkbox"
                id="urgent"
                checked={form.urgent}
                onChange={(e) => set("urgent", e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "#1a7a5e", cursor: "pointer", flexShrink: 0 }}
              />
              <label
                htmlFor="urgent"
                style={{ ...label, marginBottom: 0, cursor: "pointer", fontSize: 13 }}
              >
                Mark as urgent
              </label>
            </div>

            {/* Photo upload */}
            <div>
              <label style={label}>Photo</label>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: "1.5px dashed #c8e8e0",
                  borderRadius: 12,
                  padding: "24px 16px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  cursor: "pointer",
                  background: "#f9fefd",
                }}
              >
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Preview" style={{ maxHeight: 120, borderRadius: 8, objectFit: "cover" }} />
                ) : (
                  <>
                    <ImagePlus size={28} color="#1a7a5e" strokeWidth={1.5} />
                    <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 600, color: "#333" }}>
                      Upload photo
                    </div>
                    <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: "#888" }}>
                      PNG, JPG up to 5MB
                    </div>
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

        {/* Sticky submit */}
        <div style={{ padding: "12px 16px 32px", borderTop: "1px solid #eee" }}>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px",
              background: loading ? "#aaa" : "#1a7a5e",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontFamily: "Nunito, sans-serif",
              fontWeight: 700,
              fontSize: 15,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {loading ? "Submitting..." : "Post listing"}
          </button>
        </div>
      </div>
    </div>
  );
}
