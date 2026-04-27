"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import Toast from "@/components/Toast";
import DocumentUploadSheet from "@/components/DocumentUploadSheet";
import { ALL_CATEGORIES } from "@/lib/cooldown";

interface CatalogEntry {
  id: string;
  name: string;
  category: string;
  standardPriceCents: number;
}

interface DraftItem {
  catalogItemId: string;
  customName: string;
  isCustom: boolean;
  quantity: string;
  note: string;
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
  const [items, setItems] = useState<DraftItem[]>([{ catalogItemId: "", customName: "", isCustom: false, quantity: "1", note: "" }]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [catalogSearch, setCatalogSearch] = useState<Record<number, string>>({});
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

  useEffect(() => {
    fetch("/api/catalog").then((r) => r.json()).then((d) => setCatalog(d.items ?? [])).catch(() => {});
  }, []);

  const getCooldown = (cat: string) => cooldowns.find((c) => c.category === cat);

  const addItem = () => setItems((p) => [...p, { catalogItemId: "", customName: "", isCustom: false, quantity: "1", note: "" }]);
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));
  const updateItem = <K extends keyof DraftItem>(i: number, field: K, val: DraftItem[K]) =>
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
    const validItems = items.filter((i) => i.catalogItemId || (i.isCustom && i.customName.trim()));
    if (validItems.length === 0) { setToast("Add at least one item from the catalog"); return; }

    // Cooldown check uses catalog item category
    const blockedItems = validItems.filter((item) => {
      const cat = item.catalogItemId
        ? (catalog.find((c) => c.id === item.catalogItemId)?.category ?? "Other")
        : "Other";
      const cd = getCooldown(cat);
      return cd?.inCooldown && !overridingCategories.has(cat);
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
            body: JSON.stringify(
              item.isCustom
                ? { name: item.customName, quantity: item.quantity || "1", note: item.note || null }
                : { catalogItemId: item.catalogItemId, quantity: item.quantity || "1", note: item.note || null }
            ),
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

  // verificationLevel >= 2 is a full bypass (manually verified accounts)
  const fullyVerified = user.verificationLevel >= 2;
  const layer1Done = fullyVerified || ((user.phoneVerified || user.emailVerified) && !!user.avatar);
  const layer2Done = fullyVerified || user.docStatus === "VERIFIED";

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
              const selectedCatalogEntry = catalog.find((c) => c.id === item.catalogItemId);
              const cat    = selectedCatalogEntry?.category ?? "Other";
              const cd     = getCooldown(cat);
              const isInCooldown  = cd?.inCooldown && !item.isCustom;
              const usingOverride = overridingCategories.has(cat);
              const search = catalogSearch[i] ?? "";
              const filtered = catalog.filter((c) =>
                c.name.toLowerCase().includes(search.toLowerCase()) ||
                c.category.toLowerCase().includes(search.toLowerCase())
              );

              return (
                <div key={i} style={{ background: "var(--white)", borderRadius: 12, padding: "14px", marginBottom: 10, boxShadow: "var(--shadow)", border: isInCooldown && !usingOverride ? "1.5px solid var(--terra)" : "1.5px solid transparent" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--mid)" }}>Item {i + 1}</span>
                    {items.length > 1 && <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", color: "var(--terra)", fontSize: 18, cursor: "pointer", padding: 0 }}>×</button>}
                  </div>

                  {!item.isCustom ? (
                    <>
                      <div className="form-group" style={{ marginBottom: 6 }}>
                        <input
                          className="form-input"
                          placeholder="Search catalog (e.g. Diapers, Onesies…)"
                          value={search}
                          onChange={(e) => {
                            setCatalogSearch((p) => ({ ...p, [i]: e.target.value }));
                            updateItem(i, "catalogItemId", "");
                          }}
                        />
                      </div>
                      {search && !item.catalogItemId && (
                        <div style={{ border: "1px solid var(--border)", borderRadius: 8, marginBottom: 8, maxHeight: 160, overflowY: "auto" }}>
                          {filtered.map((c) => (
                            <div key={c.id} onClick={() => {
                              updateItem(i, "catalogItemId", c.id);
                              setCatalogSearch((p) => ({ ...p, [i]: c.name }));
                            }}
                              style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif" }}>{c.name}</div>
                                <div style={{ fontSize: 11, color: "var(--mid)" }}>{c.category}</div>
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--green)" }}>${(c.standardPriceCents / 100).toFixed(0)}</span>
                            </div>
                          ))}
                          {filtered.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--mid)" }}>No items found</div>}
                        </div>
                      )}
                      {selectedCatalogEntry && (
                        <div style={{ background: "#e8f5f1", borderRadius: 8, padding: "8px 12px", marginBottom: 8, fontSize: 12, color: "#1a7a5e", fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
                          <span>✓ {selectedCatalogEntry.name} — {selectedCatalogEntry.category}</span>
                          <span>${(selectedCatalogEntry.standardPriceCents / 100).toFixed(0)}</span>
                        </div>
                      )}
                      <button onClick={() => updateItem(i, "isCustom", true)}
                        style={{ fontSize: 11, color: "var(--mid)", background: "none", border: "none", cursor: "pointer", fontFamily: "Nunito, sans-serif", textDecoration: "underline", marginBottom: 8 }}>
                        + Add custom item instead
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="form-group" style={{ marginBottom: 6 }}>
                        <input className="form-input" placeholder="Custom item name" value={item.customName} onChange={(e) => updateItem(i, "customName", e.target.value)} />
                      </div>
                      <div style={{ background: "#fff8e6", borderRadius: 8, padding: "6px 10px", marginBottom: 8, fontSize: 11, color: "#7a5500", fontFamily: "Nunito, sans-serif" }}>
                        Custom items go to admin review and may not have a fixed price.
                      </div>
                      <button onClick={() => { updateItem(i, "isCustom", false); updateItem(i, "customName", ""); }}
                        style={{ fontSize: 11, color: "var(--mid)", background: "none", border: "none", cursor: "pointer", fontFamily: "Nunito, sans-serif", textDecoration: "underline", marginBottom: 8 }}>
                        ← Back to catalog
                      </button>
                    </>
                  )}

                  {/* Cooldown warning */}
                  {isInCooldown && (
                    <div style={{ background: usingOverride ? "var(--yellow-light)" : "var(--terra-light)", borderRadius: 8, padding: "8px 12px", marginBottom: 8, fontSize: 12 }}>
                      {usingOverride ? (
                        <>
                          <div style={{ fontWeight: 700, color: "#b8860b", marginBottom: 4 }}>⚡ Using urgent override ({overrideStatus?.overridesRemaining ?? 0} remaining)</div>
                          <input className="form-input" placeholder="Reason (e.g. ran out early)"
                            value={overrideReasons[cat] ?? ""}
                            onChange={(e) => setOverrideReasons((p) => ({ ...p, [cat]: e.target.value }))}
                            style={{ fontSize: 12, padding: "6px 10px" }} />
                        </>
                      ) : (
                        <>
                          <div style={{ fontWeight: 700, color: "var(--terra)", marginBottom: 4 }}>⏳ Cooldown: {cd?.daysLeft} days left</div>
                          <div style={{ color: "var(--terra)", marginBottom: 6 }}>
                            Next: {cd?.nextEligibleAt ? new Date(cd.nextEligibleAt).toLocaleDateString([], { month: "short", day: "numeric" }) : "—"}
                          </div>
                          {(overrideStatus?.overridesRemaining ?? 0) > 0 ? (
                            <button onClick={() => toggleOverride(cat)} style={{ fontSize: 12, fontWeight: 700, background: "var(--terra)", color: "white", border: "none", padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                              Use urgent override
                            </button>
                          ) : (
                            <span style={{ color: "var(--terra)", fontSize: 11 }}>No overrides remaining this month.</span>
                          )}
                        </>
                      )}
                      {usingOverride && (
                        <button onClick={() => toggleOverride(cat)} style={{ marginTop: 6, fontSize: 11, background: "none", border: "none", color: "#b8860b", cursor: "pointer", fontFamily: "Nunito, sans-serif", textDecoration: "underline", display: "block" }}>
                          Cancel override
                        </button>
                      )}
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <input className="form-input" placeholder="Qty (e.g. 2 packs)" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} />
                    <input className="form-input" placeholder="Note (optional)" value={item.note} onChange={(e) => updateItem(i, "note", e.target.value)} />
                  </div>
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
