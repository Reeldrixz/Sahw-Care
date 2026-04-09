"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import Toast from "@/components/Toast";
import DocumentUploadSheet from "@/components/DocumentUploadSheet";
import { ALL_CATEGORIES } from "@/lib/cooldown";

interface DraftItem {
  name: string;
  category: string;
  quantity: string;
  note: string;
  storeLinks: string;
}

interface CooldownInfo {
  category: string;
  inCooldown: boolean;
  daysLeft: number;
  nextEligibleAt: string | null;
}

interface OverrideStatus {
  overridesUsed: number;
  overrideLimit: number;
  overridesRemaining: number;
}

export default function NewRegisterPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ name: "", category: "Other", quantity: "1", note: "", storeLinks: "" }]);
  const [cooldowns, setCooldowns] = useState<CooldownInfo[]>([]);
  const [overrideStatus, setOverrideStatus] = useState<OverrideStatus | null>(null);
  const [overridingCategories, setOverridingCategories] = useState<Set<string>>(new Set());
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showDocUpload, setShowDocUpload] = useState(false);

  useEffect(() => { if (!user) router.push("/auth?mode=signup"); }, [user, router]);
  useEffect(() => { if (user?.location && !city) setCity(user.location.split(",")[0].trim()); }, [user, city]);

  const fetchCooldowns = useCallback(async () => {
    if (!user) return;
    const [cdRes, ovRes] = await Promise.all([
      fetch("/api/cooldown"),
      fetch("/api/urgent-override"),
    ]);
    if (cdRes.ok) { const d = await cdRes.json(); setCooldowns(d.cooldowns ?? []); }
    if (ovRes.ok) { const d = await ovRes.json(); setOverrideStatus(d); }
  }, [user]);

  useEffect(() => { fetchCooldowns(); }, [fetchCooldowns]);

  const getCooldown = (cat: string) => cooldowns.find((c) => c.category === cat);

  const addItem = () => setItems((p) => [...p, { name: "", category: "Other", quantity: "1", note: "", storeLinks: "" }]);
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof DraftItem, val: string) =>
    setItems((p) => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const toggleOverride = (cat: string) => {
    setOverridingCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!title || !city || !dueDate) { setToast("Title, city and due date are required"); return; }
    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) { setToast("Add at least one item"); return; }

    // Check all cooldowns — collect categories needing override
    const blockedItems = validItems.filter((item) => {
      const cd = getCooldown(item.category);
      return cd?.inCooldown && !overridingCategories.has(item.category);
    });
    if (blockedItems.length > 0) {
      setToast(`Some items are in cooldown. Use urgent override or remove them.`);
      return;
    }

    // Validate override reasons for items using override
    for (const cat of overridingCategories) {
      if (!overrideReasons[cat]?.trim()) {
        setToast(`Please provide a reason for the urgent override for "${cat}"`);
        return;
      }
    }

    setLoading(true);
    try {
      // Apply urgent overrides first
      for (const cat of overridingCategories) {
        const res = await fetch("/api/urgent-override", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: cat, reason: overrideReasons[cat] }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Override failed"); }
      }

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
              category: item.category,
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

  // Layer 1 check
  const layer1Done = (user.phoneVerified || user.emailVerified) && !!user.avatar;
  // Layer 2 check
  const layer2Done = user.docStatus === "VERIFIED";

  if (!layer1Done) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
        <div className="discover-desktop">
          <div style={{ background: "var(--white)", padding: "16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)" }}>
            <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg)", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>←</button>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700 }}>Create Register</div>
          </div>
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Complete your profile first</div>
            <p style={{ fontSize: 14, color: "var(--mid)", lineHeight: 1.7, marginBottom: 24 }}>
              Before creating a Register, please verify your phone or email and add a profile photo. This helps protect our community and ensures donations reach real families.
            </p>
            <div style={{ background: "var(--white)", borderRadius: 14, padding: "14px 16px", marginBottom: 20, textAlign: "left" }}>
              {[
                { done: user.phoneVerified || user.emailVerified, label: user.phoneVerified ? "Phone verified ✓" : user.emailVerified ? "Email verified ✓" : "Verify your phone or email" },
                { done: !!user.avatar, label: user.avatar ? "Profile photo added ✓" : "Add a profile photo" },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i === 0 ? "1px solid var(--border)" : "none" }}>
                  <span style={{ fontSize: 18 }}>{s.done ? "✅" : "⭕"}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: s.done ? "var(--green)" : "var(--ink)" }}>{s.label}</span>
                </div>
              ))}
            </div>
            <button className="btn-primary" onClick={() => router.push("/profile")}>
              Go to profile settings →
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!layer2Done) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
        <div className="discover-desktop">
          <div style={{ background: "var(--white)", padding: "16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)" }}>
            <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg)", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>←</button>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700 }}>Create Register</div>
          </div>
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            {user.docStatus === "PENDING" ? (
              <>
                <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Document under review</div>
                <p style={{ fontSize: 14, color: "var(--mid)", lineHeight: 1.7, marginBottom: 20 }}>
                  Your {user.documentType} is being reviewed by our team. This usually takes less than 24 hours. We'll notify you as soon as it's confirmed!
                </p>
                <div style={{ background: "var(--yellow-light)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#7a5500", fontWeight: 600 }}>
                  ✉️ You'll be able to create your Register as soon as your document is verified.
                </div>
              </>
            ) : user.docStatus === "REJECTED" ? (
              <>
                <div style={{ fontSize: 48, marginBottom: 16 }}>💌</div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Document needs resubmission</div>
                <p style={{ fontSize: 14, color: "var(--mid)", lineHeight: 1.7, marginBottom: 16 }}>
                  {user.documentNote ?? "We weren't able to verify your document. Please try uploading a clearer version."}
                </p>
                <button className="btn-primary" onClick={() => setShowDocUpload(true)}>
                  Upload new document
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🤱</div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 10 }}>One more step to protect you</div>
                <p style={{ fontSize: 14, color: "var(--mid)", lineHeight: 1.7, marginBottom: 16 }}>
                  To create a Register, we ask all mothers to upload one document — a hospital letter, pregnancy scan, birth certificate, or immunisation card. This helps ensure every donation goes to a real family.
                </p>
                <div style={{ background: "var(--green-light)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "var(--green)", fontWeight: 600, marginBottom: 20 }}>
                  💛 Your document is kept private and only seen by our small verification team.
                </div>
                <button className="btn-primary" onClick={() => setShowDocUpload(true)}>
                  Upload a document →
                </button>
              </>
            )}
          </div>
        </div>
        <BottomNav />
        {showDocUpload && (
          <DocumentUploadSheet
            onClose={() => setShowDocUpload(false)}
            onSuccess={() => { setShowDocUpload(false); setToast("Document submitted! We'll review it within 24 hours 💛"); }}
          />
        )}
        <Toast message={toast} onClose={() => setToast(null)} />
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">
        <div style={{ background: "var(--white)", padding: "16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)" }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg)", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>←</button>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700 }}>Create Register</div>
        </div>

        <div style={{ padding: "20px 16px 120px" }}>
          {/* Override status banner */}
          {overrideStatus && (
            <div style={{ background: overrideStatus.overridesRemaining > 0 ? "var(--yellow-light)" : "var(--terra-light)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: overrideStatus.overridesRemaining > 0 ? "#b8860b" : "var(--terra)", fontWeight: 600 }}>
              ⚡ Urgent overrides this month: {overrideStatus.overridesUsed}/{overrideStatus.overrideLimit} used · {overrideStatus.overridesRemaining} remaining
            </div>
          )}

          <div style={{ background: "var(--green-light)", borderRadius: 12, padding: "12px 14px", marginBottom: 20, fontSize: 13, color: "var(--green)", fontWeight: 600 }}>
            💛 Only your first name and city will be shown publicly.
          </div>

          <div className="form-group">
            <label className="form-label">Register title</label>
            <input className="form-input" placeholder="e.g. Baby things for March arrival" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Your city</label>
            <input className="form-input" placeholder="e.g. Lagos" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Due date</label>
            <input className="form-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
          </div>

          {/* Items */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Items needed</span>
              <span style={{ fontSize: 12, color: "var(--mid)", fontWeight: 600 }}>{items.length} item{items.length !== 1 ? "s" : ""}</span>
            </div>

            {items.map((item, i) => {
              const cd = getCooldown(item.category);
              const isInCooldown = cd?.inCooldown;
              const usingOverride = overridingCategories.has(item.category);

              return (
                <div key={i} style={{ background: "var(--white)", borderRadius: 12, padding: "14px", marginBottom: 10, boxShadow: "var(--shadow)", border: isInCooldown && !usingOverride ? "1.5px solid var(--terra)" : "1.5px solid transparent" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--mid)" }}>Item {i + 1}</span>
                    {items.length > 1 && <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", color: "var(--terra)", fontSize: 18, cursor: "pointer", padding: 0 }}>×</button>}
                  </div>

                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <input className="form-input" placeholder="Item name (e.g. Newborn diapers)" value={item.name} onChange={(e) => updateItem(i, "name", e.target.value)} />
                  </div>

                  {/* Category selector */}
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <select className="form-input" value={item.category} onChange={(e) => updateItem(i, "category", e.target.value)}
                      style={{ fontFamily: "Nunito, sans-serif" }}>
                      {ALL_CATEGORIES.map((cat) => {
                        const c = getCooldown(cat);
                        return <option key={cat} value={cat}>{cat}{c?.inCooldown ? ` (cooldown: ${c.daysLeft}d)` : ""}</option>;
                      })}
                    </select>
                  </div>

                  {/* Cooldown warning */}
                  {isInCooldown && (
                    <div style={{ background: usingOverride ? "var(--yellow-light)" : "var(--terra-light)", borderRadius: 8, padding: "8px 12px", marginBottom: 8, fontSize: 12 }}>
                      {usingOverride ? (
                        <>
                          <div style={{ fontWeight: 700, color: "#b8860b", marginBottom: 4 }}>⚡ Using urgent override ({overrideStatus?.overridesRemaining ?? 0} remaining)</div>
                          <input
                            className="form-input"
                            placeholder="Reason (e.g. ran out early)"
                            value={overrideReasons[item.category] ?? ""}
                            onChange={(e) => setOverrideReasons((p) => ({ ...p, [item.category]: e.target.value }))}
                            style={{ fontSize: 12, padding: "6px 10px" }}
                          />
                        </>
                      ) : (
                        <>
                          <div style={{ fontWeight: 700, color: "var(--terra)", marginBottom: 4 }}>
                            ⏳ Cooldown: {cd?.daysLeft} days left
                          </div>
                          <div style={{ color: "var(--terra)", marginBottom: 6 }}>
                            Next request available: {cd?.nextEligibleAt ? new Date(cd.nextEligibleAt).toLocaleDateString([], { month: "short", day: "numeric" }) : "—"}
                          </div>
                          {(overrideStatus?.overridesRemaining ?? 0) > 0 ? (
                            <button onClick={() => toggleOverride(item.category)}
                              style={{ fontSize: 12, fontWeight: 700, background: "var(--terra)", color: "white", border: "none", padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                              Use urgent override
                            </button>
                          ) : (
                            <span style={{ color: "var(--terra)", fontSize: 11 }}>No overrides remaining this month.</span>
                          )}
                        </>
                      )}
                      {usingOverride && (
                        <button onClick={() => toggleOverride(item.category)}
                          style={{ marginTop: 6, fontSize: 11, background: "none", border: "none", color: "#b8860b", cursor: "pointer", fontFamily: "Nunito, sans-serif", textDecoration: "underline", display: "block" }}>
                          Cancel override
                        </button>
                      )}
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <input className="form-input" placeholder="Qty (e.g. 2 packs)" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} />
                    <input className="form-input" placeholder="Note (optional)" value={item.note} onChange={(e) => updateItem(i, "note", e.target.value)} />
                  </div>
                  <input className="form-input" placeholder="Store links (optional, comma-separated)" value={item.storeLinks} onChange={(e) => updateItem(i, "storeLinks", e.target.value)} />
                </div>
              );
            })}

            <button onClick={addItem} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "1.5px dashed var(--border)", background: "var(--white)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "var(--green)" }}>
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
