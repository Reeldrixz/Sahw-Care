"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Coins, Package, Loader2, Users } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import Toast from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";

interface FundingEntry {
  firstName: string;
  amountCents: number;
}

interface RegisterItemData {
  id: string;
  name: string;
  category: string;
  quantity: string;
  note: string | null;
  standardPriceCents: number;
  totalFundedCents: number;
  fundingStatus: "UNFUNDED" | "PARTIAL" | "FULLY_FUNDED" | "IN_FULFILLMENT" | "FULFILLED";
  _count?: { funding: number };
}

interface RegisterData {
  id: string;
  title: string;
  city: string;
  dueDate: string;
  creator: { id: string; name: string; location: string | null };
  items: RegisterItemData[];
}

function fmtMoney(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function FundingBar({ item }: { item: RegisterItemData }) {
  const pct = item.standardPriceCents > 0
    ? Math.min(100, (item.totalFundedCents / item.standardPriceCents) * 100)
    : 0;

  const isFulfilled    = item.fundingStatus === "FULFILLED";
  const isInFulfillment = item.fundingStatus === "IN_FULFILLMENT" || item.fundingStatus === "FULLY_FUNDED";
  const isPartial      = item.fundingStatus === "PARTIAL";
  const isUnfunded     = item.fundingStatus === "UNFUNDED";

  return (
    <div style={{ marginTop: 6 }}>
      {/* Progress bar */}
      <div style={{ height: 6, borderRadius: 6, background: "#e5e7eb", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          borderRadius: 6,
          background: isFulfilled || isInFulfillment ? "#1a7a5e" : isPartial ? "#1a7a5e" : "#e5e7eb",
          transition: "width 0.4s",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <span style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", fontWeight: 600 }}>
          {isUnfunded && item.standardPriceCents > 0 ? `${fmtMoney(0)} / ${fmtMoney(item.standardPriceCents)} funded` : null}
          {isPartial ? `${fmtMoney(item.totalFundedCents)} / ${fmtMoney(item.standardPriceCents)} funded (${Math.round(pct)}%)` : null}
          {(isFulfilled || isInFulfillment || item.fundingStatus === "FULLY_FUNDED") ? `${fmtMoney(item.standardPriceCents)} funded` : null}
        </span>
        {isFulfilled && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#e8f5f1", color: "#1a7a5e", fontFamily: "Nunito, sans-serif", flexShrink: 0 }}>
            <CheckCircle size={10} strokeWidth={2.5} /> Delivered
          </span>
        )}
        {isInFulfillment && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#fff8e6", color: "#d97706", fontFamily: "Nunito, sans-serif", flexShrink: 0 }}>
            <Loader2 size={10} strokeWidth={2.5} style={{ animation: "spin 1s linear infinite" }} /> In fulfillment
          </span>
        )}
      </div>
    </div>
  );
}

export default function RegisterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const [register, setRegister]       = useState<RegisterData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [selectedItem, setSelectedItem] = useState<RegisterItemData | null>(null);
  const [fundingDetails, setFundingDetails] = useState<{ donorCount: number; contributors: FundingEntry[] } | null>(null);
  const [fundAmount, setFundAmount]   = useState("");
  const [funding, setFunding]         = useState(false);
  const [addingItem, setAddingItem]   = useState(false);
  const [catalog, setCatalog]         = useState<{ id: string; name: string; category: string; standardPriceCents: number }[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [customMode, setCustomMode]   = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty]   = useState("1");
  const [newItemNote, setNewItemNote] = useState("");
  const [showContributors, setShowContributors] = useState(false);
  const [toast, setToast]             = useState<string | null>(null);

  const fetchRegister = useCallback(async () => {
    const res = await fetch(`/api/registers/${id}`);
    if (res.ok) { const data = await res.json(); setRegister(data.register); }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchRegister(); }, [fetchRegister]);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((d) => setCatalog(d.items ?? []))
      .catch(() => {});
  }, []);

  const openItem = async (item: RegisterItemData) => {
    setSelectedItem(item);
    setFundingDetails(null);
    setShowContributors(false);
    const remaining = item.standardPriceCents - item.totalFundedCents;
    setFundAmount(remaining > 0 ? String(Math.ceil(remaining / 100)) : "");

    if (item._count && item._count.funding > 0 && user) {
      const res = await fetch(`/api/registers/${id}/items/${item.id}/funding`);
      if (res.ok) {
        const d = await res.json();
        setFundingDetails({ donorCount: d.donorCount, contributors: d.contributors });
      }
    }
  };

  const handleFund = async () => {
    if (!user) { router.push("/auth"); return; }
    if (!selectedItem || !fundAmount) return;
    const cents = Math.round(parseFloat(fundAmount) * 100);
    if (!cents || cents <= 0) { setToast("Enter a valid amount"); return; }
    setFunding(true);
    const res = await fetch(`/api/registers/${id}/items/${selectedItem.id}/fund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents: cents }),
    });
    setFunding(false);
    if (res.ok) {
      const d = await res.json();
      await fetchRegister();
      setSelectedItem(null);
      if (d.isFullyFunded) {
        setToast("This item is now fully funded! Kradəl will fulfill it soon 🎉");
      } else {
        setToast(`Thank you! Your $${(cents / 100).toFixed(0)} contribution has been added 💛`);
      }
    } else {
      const d = await res.json();
      setToast(d.error ?? "Failed to fund item");
    }
  };

  const handleAddItem = async () => {
    if (!selectedCatalogId && !customMode) { setToast("Select an item from the catalog"); return; }
    if (customMode && !newItemName.trim()) { setToast("Item name is required"); return; }
    const body = customMode
      ? { name: newItemName, quantity: newItemQty || "1", note: newItemNote || null }
      : { catalogItemId: selectedCatalogId, quantity: newItemQty || "1", note: newItemNote || null };
    const res = await fetch(`/api/registers/${id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setAddingItem(false);
      setSelectedCatalogId(""); setCatalogSearch(""); setNewItemName("");
      setNewItemQty("1"); setNewItemNote(""); setCustomMode(false);
      await fetchRegister();
      setToast("Item added!");
    } else {
      const d = await res.json();
      setToast(d.error ?? "Failed to add item");
    }
  };

  if (loading) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;
  if (!register) return (
    <div className="empty" style={{ paddingTop: 80 }}>
      <div className="empty-icon">📋</div>
      <div className="empty-title">Register not found</div>
    </div>
  );

  const isMom       = user?.id === register.creator.id;
  const isDonorView = !isMom;
  const total       = register.items.length;
  const fulfilled   = register.items.filter((i) => i.fundingStatus === "FULFILLED").length;
  const pct         = total > 0 ? fulfilled / total : 0;
  const firstName   = register.creator.name.split(" ")[0];
  const dueDate     = new Date(register.dueDate).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });

  const filteredCatalog = catalog.filter((c) =>
    c.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    c.category.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  const selectedCatalogItem = catalog.find((c) => c.id === selectedCatalogId);

  const canFund = selectedItem &&
    ["UNFUNDED", "PARTIAL"].includes(selectedItem.fundingStatus) &&
    isDonorView;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">
        {/* Header */}
        <div style={{ background: "var(--green)", padding: "16px 16px 24px", color: "white" }}>
          <button
            onClick={() => router.push("/registers")}
            style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 36, height: 36, fontSize: 18, cursor: "pointer", color: "white", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
          >←</button>
          <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{register.title}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>
            👤 {firstName} · 📍 {register.city} · 📅 {dueDate}
          </div>
          {total > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, opacity: 0.9, fontWeight: 600 }}>
                <span>{fulfilled}/{total} items fulfilled</span>
                <span>{Math.round(pct * 100)}%</span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 6, height: 8 }}>
                <div style={{ width: `${pct * 100}%`, height: "100%", background: "white", borderRadius: 6, transition: "width 0.4s" }} />
              </div>
            </>
          )}
        </div>

        {/* Donor info banner */}
        {isDonorView && (
          <div style={{ background: "#e8f5f1", padding: "10px 16px", borderBottom: "1px solid #c6e9de", fontSize: 12, color: "#1a7a5e", fontWeight: 600, fontFamily: "Nunito, sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
            <Coins size={13} />
            Fund items below — Kradəl purchases and delivers them to {firstName}.
          </div>
        )}

        {/* Checklist */}
        <div style={{ padding: "16px 16px 140px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700 }}>Needs checklist</div>
            {isMom && (
              <button
                onClick={() => setAddingItem(true)}
                style={{ background: "var(--green)", color: "white", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
              >+ Add item</button>
            )}
          </div>

          {register.items.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🛍️</div>
              <div className="empty-title">No items yet</div>
              {isMom && <div style={{ color: "var(--mid)", fontSize: 13 }}>Add items you need for your baby</div>}
            </div>
          ) : (
            register.items.map((item) => {
              const isFulfilled    = item.fundingStatus === "FULFILLED";
              const isInFulfillment = item.fundingStatus === "IN_FULFILLMENT" || item.fundingStatus === "FULLY_FUNDED";
              const canFundThis    = ["UNFUNDED", "PARTIAL"].includes(item.fundingStatus);

              return (
                <div
                  key={item.id}
                  onClick={() => openItem(item)}
                  style={{
                    background:   "var(--white)",
                    borderRadius: 12,
                    border:       "1.5px solid var(--border)",
                    padding:      "14px",
                    marginBottom: 8,
                    cursor:       "pointer",
                    opacity:      isFulfilled ? 0.7 : 1,
                    transition:   "border-color 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 700,
                        textDecoration: isFulfilled ? "line-through" : "none",
                        color: "var(--ink)", fontFamily: "Nunito, sans-serif", marginBottom: 2,
                      }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                        {item.category} · Qty: {item.quantity}
                        {item.note && <> · {item.note}</>}
                      </div>
                    </div>
                    {!isFulfilled && !isInFulfillment && isDonorView && canFundThis && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#e8f5f1", borderRadius: 20, padding: "4px 10px", flexShrink: 0 }}>
                        <Coins size={12} color="#1a7a5e" />
                        <span style={{ fontSize: 11, fontWeight: 800, color: "#1a7a5e", fontFamily: "Nunito, sans-serif" }}>Fund</span>
                      </div>
                    )}
                  </div>
                  {item.standardPriceCents > 0 && <FundingBar item={item} />}
                  {(item._count?.funding ?? 0) > 0 && (
                    <div style={{ fontSize: 11, color: "var(--mid)", marginTop: 4, display: "flex", alignItems: "center", gap: 4, fontFamily: "Nunito, sans-serif" }}>
                      <Users size={11} />
                      Funded by {item._count?.funding} donor{item._count?.funding !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Item sheet (mom only) */}
      {addingItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setAddingItem(false); }}>
          <div style={{ background: "var(--white)", borderRadius: "24px 24px 0 0", padding: "20px 16px 40px", width: "100%", maxWidth: 430, maxHeight: "85vh", overflowY: "auto", animation: "sheetUp 0.3s ease" }}>
            <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 4, margin: "0 auto 16px" }} />
            <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Add item</div>

            {!customMode ? (
              <>
                <div className="form-group">
                  <label className="form-label">Search catalog</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Diapers, Onesies…"
                    value={catalogSearch}
                    onChange={(e) => { setCatalogSearch(e.target.value); setSelectedCatalogId(""); }}
                  />
                </div>
                <div style={{ maxHeight: 220, overflowY: "auto", borderRadius: 10, border: "1.5px solid var(--border)", marginBottom: 12 }}>
                  {filteredCatalog.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => { setSelectedCatalogId(c.id); setCatalogSearch(c.name); }}
                      style={{
                        padding: "10px 12px",
                        cursor: "pointer",
                        borderBottom: "1px solid var(--border)",
                        background: selectedCatalogId === c.id ? "#e8f5f1" : "var(--white)",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif" }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>{c.category}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--green)", fontFamily: "Nunito, sans-serif" }}>
                        {fmtMoney(c.standardPriceCents)}
                      </div>
                    </div>
                  ))}
                  {filteredCatalog.length === 0 && (
                    <div style={{ padding: "16px", textAlign: "center", fontSize: 13, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                      No items match your search
                    </div>
                  )}
                </div>
                {selectedCatalogItem && (
                  <div style={{ background: "#e8f5f1", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#1a7a5e", fontWeight: 700, fontFamily: "Nunito, sans-serif" }}>
                    Selected: {selectedCatalogItem.name} — {fmtMoney(selectedCatalogItem.standardPriceCents)}
                  </div>
                )}
                <button
                  onClick={() => setCustomMode(true)}
                  style={{ fontSize: 12, color: "var(--mid)", background: "none", border: "none", cursor: "pointer", fontFamily: "Nunito, sans-serif", textDecoration: "underline", marginBottom: 12 }}
                >
                  + Add custom item (not in catalog)
                </button>
              </>
            ) : (
              <>
                <div style={{ background: "#fff8e6", borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#7a5500", fontFamily: "Nunito, sans-serif" }}>
                  Custom items go to admin review and won't have a fixed price.
                </div>
                <div className="form-group">
                  <label className="form-label">Item name</label>
                  <input className="form-input" placeholder="e.g. Newborn diapers" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} />
                </div>
                <button
                  onClick={() => { setCustomMode(false); setNewItemName(""); }}
                  style={{ fontSize: 12, color: "var(--mid)", background: "none", border: "none", cursor: "pointer", fontFamily: "Nunito, sans-serif", textDecoration: "underline", marginBottom: 12 }}
                >
                  ← Back to catalog
                </button>
              </>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div className="form-group">
                <label className="form-label">Qty</label>
                <input className="form-input" placeholder="e.g. 2 packs" value={newItemQty} onChange={(e) => setNewItemQty(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Note (optional)</label>
                <input className="form-input" placeholder="e.g. Size newborn" value={newItemNote} onChange={(e) => setNewItemNote(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={() => { setAddingItem(false); setSelectedCatalogId(""); setCatalogSearch(""); setCustomMode(false); }} className="btn-clear" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleAddItem} className="btn-apply" style={{ flex: 2 }}>Add Item</button>
            </div>
          </div>
        </div>
      )}

      {/* Item detail / fund sheet */}
      {selectedItem && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedItem(null); }}
        >
          <div style={{ background: "var(--white)", borderRadius: "24px 24px 0 0", padding: "20px 16px 40px", width: "100%", maxWidth: 430, maxHeight: "90vh", overflowY: "auto", animation: "sheetUp 0.3s ease" }}>
            <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 4, margin: "0 auto 16px" }} />

            {/* Item info */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
              <div style={{ fontFamily: "Lora, serif", fontSize: 19, fontWeight: 700 }}>{selectedItem.name}</div>
              {selectedItem.fundingStatus === "FULFILLED" && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: "#e8f5f1", color: "#1a7a5e", flexShrink: 0, fontFamily: "Nunito, sans-serif" }}>
                  <CheckCircle size={11} strokeWidth={2.5} /> Delivered
                </span>
              )}
              {(selectedItem.fundingStatus === "IN_FULFILLMENT" || selectedItem.fundingStatus === "FULLY_FUNDED") && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: "#fff8e6", color: "#d97706", flexShrink: 0, fontFamily: "Nunito, sans-serif" }}>
                  <Package size={11} strokeWidth={2.5} /> In fulfillment
                </span>
              )}
            </div>

            <div style={{ fontSize: 13, color: "var(--mid)", fontWeight: 600, fontFamily: "Nunito, sans-serif", marginBottom: 8 }}>
              {selectedItem.category} · Qty: {selectedItem.quantity}
              {selectedItem.note && <> · {selectedItem.note}</>}
            </div>

            {/* Funding progress */}
            {selectedItem.standardPriceCents > 0 && (
              <div style={{ background: "#e8f5f1", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", color: "#1a7a5e" }}>Funding progress</span>
                  <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", color: "#1a7a5e" }}>
                    {fmtMoney(selectedItem.totalFundedCents)} / {fmtMoney(selectedItem.standardPriceCents)}
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 6, background: "rgba(255,255,255,0.5)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(100, selectedItem.standardPriceCents > 0 ? (selectedItem.totalFundedCents / selectedItem.standardPriceCents) * 100 : 0)}%`,
                    background: "#1a7a5e",
                    borderRadius: 6,
                    transition: "width 0.4s",
                  }} />
                </div>
                {fundingDetails && fundingDetails.donorCount > 0 && (
                  <button
                    onClick={() => setShowContributors((p) => !p)}
                    style={{ marginTop: 8, fontSize: 11, color: "#1a7a5e", background: "none", border: "none", cursor: "pointer", fontFamily: "Nunito, sans-serif", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}
                  >
                    <Users size={11} />
                    Funded by {fundingDetails.donorCount} donor{fundingDetails.donorCount !== 1 ? "s" : ""} {showContributors ? "▲" : "▼"}
                  </button>
                )}
                {showContributors && fundingDetails && (
                  <div style={{ marginTop: 6 }}>
                    {fundingDetails.contributors.map((c, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", fontWeight: 600, padding: "2px 0" }}>
                        {c.firstName} — {fmtMoney(c.amountCents)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fund button for donors */}
            {canFund && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "Nunito, sans-serif", marginBottom: 8 }}>
                  Fund this item
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>$</span>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      placeholder="Amount"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      style={{ paddingLeft: 24 }}
                    />
                  </div>
                  <button
                    onClick={handleFund}
                    disabled={funding || !fundAmount}
                    style={{
                      flex: 2, padding: "13px", borderRadius: 12, border: "none",
                      background: funding || !fundAmount ? "#9ca3af" : "var(--green)",
                      color: "white", fontSize: 14, fontWeight: 800, cursor: funding || !fundAmount ? "default" : "pointer",
                      fontFamily: "Nunito, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                  >
                    <Coins size={16} />
                    {funding ? "Processing…" : fundAmount ? `Fund $${fundAmount}` : "Fund this item"}
                  </button>
                </div>
                {!user && (
                  <button
                    onClick={() => router.push("/auth")}
                    style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: "var(--green)", color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                  >
                    <Coins size={16} /> Sign in to fund this item
                  </button>
                )}
              </div>
            )}

            {selectedItem.fundingStatus === "IN_FULFILLMENT" && (
              <div style={{ background: "#fff8e6", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontSize: 13, color: "#7a5500", fontFamily: "Nunito, sans-serif", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <Package size={16} color="#d97706" />
                Kradəl is processing this item for fulfillment.
              </div>
            )}

            {selectedItem.fundingStatus === "FULFILLED" && (
              <div style={{ background: "#e8f5f1", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontSize: 13, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle size={16} color="#1a7a5e" />
                This item has been delivered to {firstName} 🎁
              </div>
            )}

            <button
              onClick={() => setSelectedItem(null)}
              style={{ width: "100%", marginTop: 8, padding: "13px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--white)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "var(--mid)" }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <BottomNav />
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
