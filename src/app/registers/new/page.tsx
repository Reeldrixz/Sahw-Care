"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import Toast from "@/components/Toast";

interface DraftItem {
  name: string;
  quantity: string;
  note: string;
  storeLinks: string;
}

export default function NewRegisterPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ name: "", quantity: "1", note: "", storeLinks: "" }]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!user) router.push("/auth?mode=signup");
  }, [user, router]);

  // Pre-fill city from user location
  useEffect(() => {
    if (user?.location && !city) {
      const parts = user.location.split(",");
      setCity(parts[0].trim());
    }
  }, [user, city]);

  const addItem = () => setItems((prev) => [...prev, { name: "", quantity: "1", note: "", storeLinks: "" }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof DraftItem, val: string) =>
    setItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, [field]: val } : item)));

  const handleSubmit = async () => {
    if (!title || !city || !dueDate) { setToast("Title, city and due date are required"); return; }
    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) { setToast("Add at least one item to your register"); return; }

    setLoading(true);
    try {
      // Create register
      const res = await fetch("/api/registers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, city, dueDate }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
      const { register } = await res.json();

      // Add items
      await Promise.all(
        validItems.map((item) =>
          fetch(`/api/registers/${register.id}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: item.name,
              quantity: item.quantity || "1",
              note: item.note || null,
              storeLinks: item.storeLinks ? item.storeLinks.split(",").map((l) => l.trim()).filter(Boolean) : [],
            }),
          })
        )
      );

      router.push(`/registers/${register.id}`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  if (!user) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">
        {/* Header */}
        <div style={{ background: "var(--white)", padding: "16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)" }}>
          <button
            onClick={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg)", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            ←
          </button>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700 }}>Create Register</div>
        </div>

        <div style={{ padding: "20px 16px 120px" }}>
          {/* Info banner */}
          <div style={{ background: "var(--green-light)", borderRadius: 12, padding: "12px 14px", marginBottom: 20, fontSize: 13, color: "var(--green)", fontWeight: 600 }}>
            💛 Share what you need. Only your first name and city will be shown publicly.
          </div>

          {/* Title */}
          <div className="form-group">
            <label className="form-label">Register title</label>
            <input className="form-input" placeholder="e.g. Baby things for March arrival" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {/* City */}
          <div className="form-group">
            <label className="form-label">Your city</label>
            <input className="form-input" placeholder="e.g. Lagos" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>

          {/* Due date */}
          <div className="form-group">
            <label className="form-label">Due date (baby arrival / needed by)</label>
            <input className="form-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
          </div>

          {/* Items */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Items needed</span>
              <span style={{ fontSize: 12, color: "var(--mid)", fontWeight: 600 }}>{items.length} item{items.length !== 1 ? "s" : ""}</span>
            </div>

            {items.map((item, i) => (
              <div key={i} style={{ background: "var(--white)", borderRadius: 12, padding: "14px", marginBottom: 10, boxShadow: "var(--shadow)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--mid)" }}>Item {i + 1}</span>
                  {items.length > 1 && (
                    <button
                      onClick={() => removeItem(i)}
                      style={{ background: "none", border: "none", color: "var(--terra)", fontSize: 18, cursor: "pointer", padding: 0 }}
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <input
                    className="form-input"
                    placeholder="Item name (e.g. Newborn diapers)"
                    value={item.name}
                    onChange={(e) => updateItem(i, "name", e.target.value)}
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <input
                    className="form-input"
                    placeholder="Qty (e.g. 2 packs)"
                    value={item.quantity}
                    onChange={(e) => updateItem(i, "quantity", e.target.value)}
                  />
                  <input
                    className="form-input"
                    placeholder="Note (optional)"
                    value={item.note}
                    onChange={(e) => updateItem(i, "note", e.target.value)}
                  />
                </div>
                <input
                  className="form-input"
                  placeholder="Store links (optional, comma-separated)"
                  value={item.storeLinks}
                  onChange={(e) => updateItem(i, "storeLinks", e.target.value)}
                />
              </div>
            ))}

            <button
              onClick={addItem}
              style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1.5px dashed var(--border)", background: "var(--white)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "var(--green)" }}
            >
              + Add another item
            </button>
          </div>

          <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating..." : "Publish Register 📋"}
          </button>
        </div>
      </div>

      <BottomNav />
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
