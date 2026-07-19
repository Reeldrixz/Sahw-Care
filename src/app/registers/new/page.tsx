"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import Toast from "@/components/Toast";
import { canCreateRegister } from "@/lib/access";

interface CatalogEntry {
  id: string;
  name: string;
  category: string;
  standardPriceCents: number;
  imageUrl: string | null;
  ageStage: string | null;
  requiresSize: boolean;
  requiresApproval: boolean;
}

interface DraftItem {
  catalogItemId: string;
  customName: string;
  isCustom: boolean;
  quantity: string;
  note: string;
  sizeNote: string;
}

interface SavedAddress {
  fullName: string;
  streetAddress: string;
  unit: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
}

const PROVINCES = [
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
];

export default function NewRegisterPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [addressMode, setAddressMode] = useState<"ASK_PER_SHIPMENT" | "SAVED_PER_REGISTER">("ASK_PER_SHIPMENT");
  const [savedAddress, setSavedAddress] = useState<SavedAddress>({ fullName: "", streetAddress: "", unit: "", city: "", province: "", postalCode: "", phone: "" });
  const [items, setItems] = useState<DraftItem[]>([{ catalogItemId: "", customName: "", isCustom: false, quantity: "1", note: "", sizeNote: "" }]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [catalogSearch, setCatalogSearch] = useState<Record<number, string>>({});
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Suggestion modal
  const [showSuggest,      setShowSuggest]      = useState(false);
  const [suggestName,      setSuggestName]      = useState("");
  const [suggestCategory,  setSuggestCategory]  = useState("");
  const [suggestNotes,     setSuggestNotes]     = useState("");
  const [suggestBusy,      setSuggestBusy]      = useState(false);
  const [suggestDone,      setSuggestDone]      = useState(false);
  const [suggestError,     setSuggestError]     = useState<string | null>(null);

  useEffect(() => { if (!user) router.push("/auth?mode=signup"); }, [user, router]);
  useEffect(() => { if (user?.location && !city) setCity(user.location.split(",")[0].trim()); }, [user, city]);

  useEffect(() => {
    fetch("/api/catalog").then((r) => r.json()).then((d) => setCatalog(d.items ?? [])).catch(() => {});
  }, []);

  const addItem = () => setItems((p) => [...p, { catalogItemId: "", customName: "", isCustom: false, quantity: "1", note: "", sizeNote: "" }]);
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));
  const updateItem = <K extends keyof DraftItem>(i: number, field: K, val: DraftItem[K]) =>
    setItems((p) => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  // Group catalog by category for the picker
  const catalogByCategory = catalog.reduce<Record<string, CatalogEntry[]>>((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {});

  const handleSubmit = async () => {
    if (!title || !city || !dueDate) { setToast("Title, city and due date are required"); return; }

    if (addressMode === "SAVED_PER_REGISTER") {
      const { fullName, streetAddress, city: addrCity, province, postalCode, phone } = savedAddress;
      if (!fullName || !streetAddress || !addrCity || !province || !postalCode || !phone) {
        setToast("All address fields are required for saved address mode");
        return;
      }
    }

    const validItems = items.filter((i) => i.catalogItemId || (i.isCustom && i.customName.trim()));
    if (validItems.length === 0) { setToast("Add at least one item from the catalog"); return; }

    setLoading(true);
    try {
      const body: Record<string, unknown> = { title, city, dueDate, addressMode };
      if (addressMode === "SAVED_PER_REGISTER") body.savedAddress = savedAddress;

      const res = await fetch("/api/registers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
      const { register } = await res.json();

      await Promise.all(
        validItems.map((item) => {
          const payload: Record<string, unknown> = item.isCustom
            ? { name: item.customName, quantity: item.quantity || "1", note: item.note || null }
            : { catalogItemId: item.catalogItemId, quantity: item.quantity || "1", note: item.note || null };
          if (item.sizeNote) payload.note = [item.note, item.sizeNote].filter(Boolean).join(" · ");
          return fetch(`/api/registers/${register.id}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        })
      );

      router.push(`/registers/${register.id}`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  if (!user) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;

  const layer1Done = (user.phoneVerified || user.emailVerified) && !!user.avatar;
  const createAccess = canCreateRegister(user);

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
              Before creating a Register, please verify your phone or email and add a profile photo.
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
            <button className="btn-primary" onClick={() => router.push("/profile")}>Go to profile settings →</button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!createAccess.allowed) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
        <div className="discover-desktop">
          <div style={{ background: "var(--white)", padding: "16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)" }}>
            <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg)", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>←</button>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700 }}>Create Register</div>
          </div>
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            {user.manualReviewStatus === "REJECTED" ? (
              <>
                <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Profile review unsuccessful</div>
                <p style={{ fontSize: 14, color: "var(--mid)", lineHeight: 1.7, marginBottom: 24 }}>
                  {user.manualReviewRejectionReason ?? "We were unable to approve your profile. Please visit your profile for more details and to re-submit."}
                </p>
              </>
            ) : (
              <>
                <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 10 }}>One step before creating a Register</div>
                <p style={{ fontSize: 14, color: "var(--mid)", lineHeight: 1.7, marginBottom: 24 }}>
                  To create a Register of Needs, please submit your profile for our team to review first. Head to your profile and tap &apos;Submit for review&apos;. It usually takes just a short while.
                </p>
              </>
            )}
            <button className="btn-primary" onClick={() => router.push("/profile")}>Go to your profile →</button>
          </div>
        </div>
        <BottomNav />
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

          {/* ── Address mode ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>Delivery address</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              {([
                { val: "ASK_PER_SHIPMENT", title: "Ask per shipment", desc: "We'll ask you for the address when each item is ready to ship. Most private." },
                { val: "SAVED_PER_REGISTER", title: "Save one address", desc: "One address is used for all deliveries on this register. We delete it when the register closes." },
              ] as const).map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => setAddressMode(opt.val)}
                  style={{
                    textAlign: "left", padding: "12px 14px", borderRadius: 12,
                    border: `2px solid ${addressMode === opt.val ? "var(--green)" : "var(--border)"}`,
                    background: addressMode === opt.val ? "var(--green-light)" : "var(--white)",
                    cursor: "pointer", fontFamily: "Nunito, sans-serif",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800, color: addressMode === opt.val ? "var(--green)" : "var(--ink)", marginBottom: 3 }}>{opt.title}</div>
                  <div style={{ fontSize: 11, color: "var(--mid)", lineHeight: 1.4 }}>{opt.desc}</div>
                </button>
              ))}
            </div>

            <div style={{ fontSize: 12, color: "var(--mid)", marginBottom: 12, fontFamily: "Nunito, sans-serif" }}>
              🔒 Donors never see your address. Only Kradəl uses it to ship.
            </div>

            {addressMode === "SAVED_PER_REGISTER" && (
              <div style={{ background: "var(--white)", borderRadius: 12, padding: "14px", boxShadow: "var(--shadow)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--mid)", marginBottom: 12 }}>Your delivery address (kept private)</div>
                <div className="form-group">
                  <label className="form-label">Full name</label>
                  <input className="form-input" placeholder="Recipient's full name" value={savedAddress.fullName} onChange={(e) => setSavedAddress((p) => ({ ...p, fullName: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Street address</label>
                  <input className="form-input" placeholder="123 Main Street" value={savedAddress.streetAddress} onChange={(e) => setSavedAddress((p) => ({ ...p, streetAddress: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit / Apt (optional)</label>
                  <input className="form-input" placeholder="Unit 4B" value={savedAddress.unit} onChange={(e) => setSavedAddress((p) => ({ ...p, unit: e.target.value }))} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input className="form-input" placeholder="City" value={savedAddress.city} onChange={(e) => setSavedAddress((p) => ({ ...p, city: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Province</label>
                    <select className="form-input" value={savedAddress.province} onChange={(e) => setSavedAddress((p) => ({ ...p, province: e.target.value }))}>
                      <option value="">Select</option>
                      {PROVINCES.map((pv) => <option key={pv} value={pv}>{pv}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div className="form-group">
                    <label className="form-label">Postal code</label>
                    <input className="form-input" placeholder="A1B 2C3" value={savedAddress.postalCode} onChange={(e) => setSavedAddress((p) => ({ ...p, postalCode: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" type="tel" placeholder="+1 555 000 0000" value={savedAddress.phone} onChange={(e) => setSavedAddress((p) => ({ ...p, phone: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Items ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Items needed</span>
              <span style={{ fontSize: 12, color: "var(--mid)", fontWeight: 600 }}>{items.length} item{items.length !== 1 ? "s" : ""}</span>
            </div>

            {items.map((item, i) => {
              const selectedCatalogEntry = catalog.find((c) => c.id === item.catalogItemId);
              const search = catalogSearch[i] ?? "";

              const filteredByCategory = search
                ? catalog.filter((c) =>
                    c.name.toLowerCase().includes(search.toLowerCase()) ||
                    c.category.toLowerCase().includes(search.toLowerCase())
                  ).reduce<Record<string, CatalogEntry[]>>((acc, c) => {
                    if (!acc[c.category]) acc[c.category] = [];
                    acc[c.category].push(c);
                    return acc;
                  }, {})
                : catalogByCategory;

              return (
                <div key={i} style={{ background: "var(--white)", borderRadius: 12, padding: "14px", marginBottom: 10, boxShadow: "var(--shadow)", border: "1.5px solid transparent" }}>
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

                      {/* Category-grouped picker */}
                      {(search || !item.catalogItemId) && (
                        <div style={{ border: "1px solid var(--border)", borderRadius: 8, marginBottom: 8, maxHeight: 280, overflowY: "auto" }}>
                          {Object.entries(filteredByCategory).map(([catName, catItems]) => {
                            const isExpanded = expandedCategories.has(catName) || !!search;
                            return (
                              <div key={catName}>
                                <button
                                  onClick={() => toggleCategory(catName)}
                                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "#f9fafb", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "Nunito, sans-serif" }}
                                >
                                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--mid)" }}>{catName}</span>
                                  <span style={{ fontSize: 11, color: "var(--mid)" }}>{isExpanded ? "▲" : "▼"} {catItems.length}</span>
                                </button>
                                {isExpanded && catItems.map((c) => (
                                  <div
                                    key={c.id}
                                    onClick={() => {
                                      updateItem(i, "catalogItemId", c.id);
                                      setCatalogSearch((p) => ({ ...p, [i]: c.name }));
                                    }}
                                    style={{
                                      padding: "10px 12px", cursor: "pointer",
                                      borderBottom: "1px solid var(--border)",
                                      background: item.catalogItemId === c.id ? "#e8f5f1" : "var(--white)",
                                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                                      {c.imageUrl && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={c.imageUrl} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                                      )}
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                          {c.name}
                                          {c.requiresApproval && (
                                            <span style={{ fontSize: 10, fontWeight: 700, background: "#fff8e6", color: "#d97706", padding: "2px 6px", borderRadius: 10 }}>Needs review</span>
                                          )}
                                        </div>
                                        {c.ageStage && <div style={{ fontSize: 10, color: "var(--mid)" }}>{c.ageStage}</div>}
                                      </div>
                                    </div>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: "var(--green)", flexShrink: 0 }}>${(c.standardPriceCents / 100).toFixed(0)}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                          {Object.keys(filteredByCategory).length === 0 && (
                            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--mid)" }}>No items found</div>
                          )}
                        </div>
                      )}

                      {selectedCatalogEntry && (
                        <div style={{ background: "#e8f5f1", borderRadius: 8, padding: "8px 12px", marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: 12, color: "#1a7a5e", fontWeight: 700 }}>
                              ✓ {selectedCatalogEntry.name}
                              {selectedCatalogEntry.requiresApproval && (
                                <span style={{ marginLeft: 6, fontSize: 10, background: "#fff8e6", color: "#d97706", padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>Needs admin review</span>
                              )}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 800, color: "#1a7a5e" }}>${(selectedCatalogEntry.standardPriceCents / 100).toFixed(0)}</span>
                          </div>
                          {selectedCatalogEntry.requiresApproval && (
                            <div style={{ fontSize: 11, color: "#7a5500", marginTop: 4 }}>This item requires admin review before it appears on your register.</div>
                          )}
                        </div>
                      )}

                      {/* requiresSize dropdown */}
                      {selectedCatalogEntry?.requiresSize && (
                        <div className="form-group" style={{ marginBottom: 6 }}>
                          <label className="form-label">Size</label>
                          <input className="form-input" placeholder="e.g. Newborn, 0-3M, 3-6M" value={item.sizeNote} onChange={(e) => updateItem(i, "sizeNote", e.target.value)} />
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

          {/* Suggestion card — RECIPIENT only */}
          {user.role === "RECIPIENT" && (
            <div style={{ background: "#f5f3ff", border: "1px solid #d8d0f5", borderRadius: 14, padding: "16px", marginBottom: 20 }}>
              <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "#6d5acd", marginBottom: 4 }}>
                Can&apos;t find what you need?
              </div>
              <div style={{ fontSize: 12, color: "#555", fontFamily: "Nunito, sans-serif", lineHeight: 1.55, marginBottom: 12 }}>
                Suggest an item to add to our catalogue.
              </div>
              <button
                onClick={() => { setShowSuggest(true); setSuggestDone(false); setSuggestError(null); setSuggestName(""); setSuggestCategory(""); setSuggestNotes(""); }}
                style={{ background: "#6d5acd", color: "white", border: "none", borderRadius: 10, padding: "10px 18px", fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 800, cursor: "pointer" }}
              >
                Suggest an item →
              </button>
            </div>
          )}

          <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Creating..." : "Publish Register 📋"}
          </button>
        </div>
      </div>

      <BottomNav />
      <Toast message={toast} onClose={() => setToast(null)} />

      {/* Suggestion modal */}
      {showSuggest && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSuggest(false); }}
        >
          <div style={{ width: "100%", maxWidth: 540, background: "white", borderRadius: "20px 20px 0 0", maxHeight: "85vh", overflowY: "auto", padding: "20px 20px 40px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, color: "#1a1a1a" }}>Suggest a catalogue item</div>
              <button onClick={() => setShowSuggest(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>✕</button>
            </div>

            {suggestDone ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>💜</div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 10 }}>
                  Thank you for the suggestion.
                </div>
                <div style={{ fontSize: 13, color: "#555", fontFamily: "Nunito, sans-serif", lineHeight: 1.65, marginBottom: 24, maxWidth: 320, margin: "0 auto 24px" }}>
                  Your suggestion helps us understand what mothers need. We review suggestions regularly and add the most-requested items to the catalogue.
                </div>
                <button
                  onClick={() => setShowSuggest(false)}
                  style={{ background: "#1a7a5e", color: "white", border: "none", borderRadius: 12, padding: "12px 28px", fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: "Nunito, sans-serif", fontStyle: "italic", fontSize: 12, color: "#6d5acd", lineHeight: 1.6, marginBottom: 18, background: "#f5f3ff", borderRadius: 10, padding: "10px 14px" }}>
                  Suggestions should be maternal or infant essentials. Examples: feeding supplies, diapers, postpartum care, baby clothing.
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#1a1a1a", marginBottom: 5, fontFamily: "Nunito, sans-serif" }}>Item name *</label>
                  <input
                    style={{ display: "block", width: "100%", padding: "10px 12px", border: "1.5px solid #e0e0e0", borderRadius: 10, fontSize: 14, fontFamily: "Nunito, sans-serif", outline: "none", boxSizing: "border-box" }}
                    placeholder="e.g. Lansinoh nipple cream"
                    maxLength={80}
                    value={suggestName}
                    onChange={(e) => setSuggestName(e.target.value)}
                  />
                  <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "right", marginTop: 2 }}>{suggestName.length}/80</div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#1a1a1a", marginBottom: 5, fontFamily: "Nunito, sans-serif" }}>Category *</label>
                  <select
                    style={{ display: "block", width: "100%", padding: "10px 12px", border: "1.5px solid #e0e0e0", borderRadius: 10, fontSize: 14, fontFamily: "Nunito, sans-serif", outline: "none", background: "white" }}
                    value={suggestCategory}
                    onChange={(e) => setSuggestCategory(e.target.value)}
                  >
                    <option value="">Select a category…</option>
                    <option value="postpartum">Postpartum</option>
                    <option value="newborn">Newborn</option>
                    <option value="pregnancy">Pregnancy</option>
                    <option value="labour">Labour &amp; Delivery</option>
                  </select>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#1a1a1a", marginBottom: 5, fontFamily: "Nunito, sans-serif" }}>Notes (optional)</label>
                  <textarea
                    style={{ display: "block", width: "100%", padding: "10px 12px", border: "1.5px solid #e0e0e0", borderRadius: 10, fontSize: 13, fontFamily: "Nunito, sans-serif", outline: "none", resize: "vertical", minHeight: 72, boxSizing: "border-box" }}
                    placeholder="Anything we should know? (size, brand preference, etc.)"
                    maxLength={300}
                    value={suggestNotes}
                    onChange={(e) => setSuggestNotes(e.target.value)}
                  />
                  <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "right", marginTop: 2 }}>{suggestNotes.length}/300</div>
                </div>

                {suggestError && (
                  <div style={{ background: "#fdecea", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#c0392b", fontFamily: "Nunito, sans-serif", marginBottom: 14 }}>
                    {suggestError}
                  </div>
                )}

                <button
                  disabled={suggestBusy}
                  onClick={async () => {
                    setSuggestBusy(true); setSuggestError(null);
                    try {
                      const r = await fetch("/api/register/suggestions", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ itemName: suggestName, category: suggestCategory, notes: suggestNotes || null }),
                      });
                      const d = await r.json().catch(() => ({}));
                      if (!r.ok) { setSuggestError(d.error ?? "Something went wrong."); }
                      else       { setSuggestDone(true); }
                    } catch { setSuggestError("Network error. Please try again."); }
                    setSuggestBusy(false);
                  }}
                  style={{ width: "100%", padding: "14px", background: suggestBusy ? "#9ca3af" : "#1a7a5e", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, color: "white", cursor: suggestBusy ? "default" : "pointer", fontFamily: "Nunito, sans-serif" }}
                >
                  {suggestBusy ? "Submitting…" : "Submit suggestion"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
