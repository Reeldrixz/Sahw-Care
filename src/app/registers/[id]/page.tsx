"use client";

import { useEffect, useState, useCallback, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { Square, CheckSquare, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import Toast from "@/components/Toast";
import ShareImpactModal from "@/components/ShareImpactModal";
import { useAuth } from "@/contexts/AuthContext";

interface RegisterMessage {
  id: string; text: string; createdAt: string;
  sender: { id: string; name: string };
}

interface RegisterItemData {
  id: string; name: string; category: string; quantity: string;
  note: string | null; storeLinks: string[];
  status: "AVAILABLE" | "RESERVED" | "FULFILLED";
  assignment: {
    id: string;
    status: "RESERVED" | "PURCHASED" | "DELIVERED";
    donor: { id: string; name: string };
    fulfillmentLog?: {
      momConfirmed: boolean;
      mismatch: boolean;
    } | null;
    messages?: RegisterMessage[];
  } | null;
}

interface RegisterData {
  id: string; title: string; city: string; dueDate: string;
  creator: { id: string; name: string; location: string | null };
  items: RegisterItemData[];
}

function effectiveStatus(item: RegisterItemData): "AVAILABLE" | "RESERVED" | "FULFILLED" | "DISPUTED" {
  if (item.assignment?.fulfillmentLog?.mismatch) return "DISPUTED";
  return item.status;
}

// Left-side checkbox icon
function getLeftIcon(item: RegisterItemData, isSelected: boolean, isDonorView: boolean) {
  const es = effectiveStatus(item);
  if (es === "DISPUTED")  return <AlertTriangle size={22} color="#c0392b" strokeWidth={2} style={{ flexShrink: 0 }} />;
  if (es === "FULFILLED") return <CheckSquare   size={22} color="#1a7a5e" strokeWidth={2} style={{ flexShrink: 0 }} />;
  if (item.status !== "AVAILABLE") return <CheckSquare size={22} color="#1a7a5e" strokeWidth={2} style={{ flexShrink: 0 }} />;
  // AVAILABLE
  if (isDonorView && isSelected) return <CheckSquare size={22} color="#1a7a5e" strokeWidth={2} style={{ flexShrink: 0 }} />;
  return <Square size={22} color="#9ca3af" strokeWidth={2} style={{ flexShrink: 0 }} />;
}

// Right-side status indicator — only shown when relevant
function getRightBadge(item: RegisterItemData) {
  const es = effectiveStatus(item);
  if (es === "FULFILLED") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#e8f5f1", color: "#1a7a5e", fontFamily: "Nunito, sans-serif", whiteSpace: "nowrap", flexShrink: 0 }}>
      <CheckCircle size={11} strokeWidth={2.5} /> Fulfilled
    </span>
  );
  if (es === "DISPUTED") return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#fdecea", color: "#c0392b", fontFamily: "Nunito, sans-serif", whiteSpace: "nowrap", flexShrink: 0 }}>
      <AlertTriangle size={11} strokeWidth={2.5} /> Disputed
    </span>
  );
  if (item.status !== "AVAILABLE") return (
    <Loader2 size={18} color="#d97706" strokeWidth={2} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
  );
  return null;
}

export default function RegisterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [register, setRegister]         = useState<RegisterData | null>(null);
  const [loading, setLoading]           = useState(true);
  const [selectedItem, setSelectedItem] = useState<RegisterItemData | null>(null);
  const [messages, setMessages]         = useState<RegisterMessage[]>([]);
  const [msgText, setMsgText]           = useState("");
  const [sendingMsg, setSendingMsg]     = useState(false);
  const [assigning, setAssigning]       = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [confirming, setConfirming]     = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason]     = useState("");
  const [showShareImpact, setShowShareImpact] = useState(false);
  const [toast, setToast]               = useState<string | null>(null);
  const [addingItem, setAddingItem]     = useState(false);
  const [newItemName, setNewItemName]   = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Other");
  const [newItemQty, setNewItemQty]     = useState("1");
  const [newItemNote, setNewItemNote]   = useState("");
  // Multi-select for donors
  const [selectedItems, setSelectedItems]       = useState<Set<string>>(new Set());
  const [claimingMultiple, setClaimingMultiple] = useState(false);
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpFired = useRef(false);

  const fetchRegister = useCallback(async () => {
    const res = await fetch(`/api/registers/${id}`);
    if (res.ok) { const data = await res.json(); setRegister(data.register); }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchRegister(); }, [fetchRegister]);

  const openItem = async (item: RegisterItemData) => {
    setSelectedItem(item);
    setMsgText(""); setShowDisputeForm(false); setDisputeReason("");
    if (item.assignment && user) {
      const isMomCheck = register?.creator.id === user.id;
      const isDonor    = item.assignment.donor.id === user.id;
      if (isMomCheck || isDonor) {
        const res = await fetch(`/api/registers/${id}/items/${item.id}/messages`);
        if (res.ok) { const data = await res.json(); setMessages(data.messages ?? []); }
        else setMessages([]);
      } else setMessages([]);
    } else setMessages([]);
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleMultiClaim = async () => {
    if (!user) { router.push("/auth"); return; }
    if (selectedItems.size === 0) return;
    setClaimingMultiple(true);
    let claimed = 0;
    let failed  = 0;
    for (const itemId of selectedItems) {
      const res = await fetch(`/api/registers/${id}/items/${itemId}/assign`, { method: "POST" });
      if (res.ok) claimed++;
      else failed++;
    }
    setClaimingMultiple(false);
    setSelectedItems(new Set());
    if (claimed > 0) {
      setToast(`Committed to ${claimed} item${claimed !== 1 ? "s" : ""}! 🎉 Chat with the family to coordinate.`);
      fetchRegister();
    } else if (failed > 0) {
      setToast("Some items were already claimed — try others.");
    }
  };

  const handleAssign = async () => {
    if (!user) { router.push("/auth"); return; }
    if (!selectedItem) return;
    setAssigning(true);
    const res = await fetch(`/api/registers/${id}/items/${selectedItem.id}/assign`, { method: "POST" });
    if (res.ok) {
      setToast("Committed! 🎉 Chat with the mom to coordinate.");
      await fetchRegister(); setSelectedItem(null);
    } else { const d = await res.json(); setToast(d.error ?? "Failed"); }
    setAssigning(false);
  };

  const handleStatusUpdate = async (status: "PURCHASED" | "DELIVERED") => {
    if (!selectedItem) return;
    setUpdatingStatus(true);
    const res = await fetch(`/api/registers/${id}/items/${selectedItem.id}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      if (status === "DELIVERED") {
        setToast("Marked as delivered! 🎁 Share your impact.");
        await fetchRegister(); setSelectedItem(null);
        setShowShareImpact(true);
      } else {
        setToast("Marked as purchased!");
        await fetchRegister(); setSelectedItem(null);
      }
    } else { const d = await res.json(); setToast(d.error ?? "Failed"); }
    setUpdatingStatus(false);
  };

  const handleConfirmReceived = async () => {
    if (!selectedItem?.assignment) return;
    setConfirming(true);
    const res = await fetch(`/api/fulfillment/${selectedItem.assignment.id}/confirm`, { method: "POST" });
    setConfirming(false);
    if (res.ok) {
      setToast("✅ Confirmed received! Trust scores updated.");
      setSelectedItem(null);
      fetchRegister();
    } else { const d = await res.json(); setToast(d.error ?? "Failed"); }
  };

  const handleDispute = async () => {
    if (!selectedItem?.assignment || !disputeReason.trim()) return;
    setConfirming(true);
    const res = await fetch(`/api/fulfillment/${selectedItem.assignment.id}/confirm`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: disputeReason }),
    });
    setConfirming(false);
    if (res.ok) {
      setToast("Dispute filed. Our team will review it.");
      setSelectedItem(null);
      fetchRegister();
    } else { const d = await res.json(); setToast(d.error ?? "Failed"); }
  };

  const handleSendMessage = async () => {
    if (!msgText.trim() || !selectedItem) return;
    setSendingMsg(true);
    const res = await fetch(`/api/registers/${id}/items/${selectedItem.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msgText }),
    });
    if (res.ok) { const data = await res.json(); setMessages((p) => [...p, data.message]); setMsgText(""); }
    else { const d = await res.json(); setToast(d.error ?? "Failed"); }
    setSendingMsg(false);
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    const res = await fetch(`/api/registers/${id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newItemName, category: newItemCategory, quantity: newItemQty || "1", note: newItemNote || null }),
    });
    if (res.ok) {
      setNewItemName(""); setNewItemQty("1"); setNewItemNote(""); setNewItemCategory("Other");
      setAddingItem(false); await fetchRegister(); setToast("Item added!");
    } else { const d = await res.json(); setToast(d.error ?? "Failed"); }
  };

  if (loading) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;
  if (!register) return <div className="empty" style={{ paddingTop: 80 }}><div className="empty-icon">📋</div><div className="empty-title">Register not found</div></div>;

  const isMom       = user?.id === register.creator.id;
  const isDonorView = !isMom && !!user;
  const total       = register.items.length;
  const fulfilled   = register.items.filter((i) => i.status === "FULFILLED").length;
  const pct         = total > 0 ? fulfilled / total : 0;
  const firstName   = register.creator.name.split(" ")[0];
  const dueDate     = new Date(register.dueDate).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });

  const handlePressStart = (itemId: string) => {
    if (!isDonorView) return;
    lpFired.current = false;
    lpTimer.current = setTimeout(() => {
      lpFired.current = true;
      toggleItemSelection(itemId);
    }, 500);
  };

  const handlePressEnd = () => {
    if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; }
  };

  const handleItemClick = (item: RegisterItemData) => {
    if (lpFired.current) { lpFired.current = false; return; }
    openItem(item);
  };

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
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>👤 {firstName} · 📍 {register.city} · 📅 {dueDate}</div>
          {total > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, opacity: 0.9, fontWeight: 600 }}>
                <span>{fulfilled}/{total} items fulfilled</span><span>{Math.round(pct * 100)}%</span>
              </div>
              <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 6, height: 8 }}>
                <div style={{ width: `${pct * 100}%`, height: "100%", background: "white", borderRadius: 6, transition: "width 0.4s" }} />
              </div>
            </>
          )}
        </div>

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
              {isMom && <div>Add items you need for your baby</div>}
            </div>
          ) : (
            register.items.map((item) => {
              const es = effectiveStatus(item);
              const isSelected      = selectedItems.has(item.id);
              const needsMomConfirm = isMom
                && item.assignment?.status === "DELIVERED"
                && !item.assignment?.fulfillmentLog?.momConfirmed
                && !item.assignment?.fulfillmentLog?.mismatch;
              const isFulfilled = es === "FULFILLED";
              const isDisputed  = es === "DISPUTED";

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  onMouseDown={() => handlePressStart(item.id)}
                  onTouchStart={() => handlePressStart(item.id)}
                  onMouseUp={handlePressEnd}
                  onTouchEnd={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  style={{
                    background:   isSelected ? "#f0faf6" : "var(--white)",
                    borderRadius: 12,
                    border:       isSelected
                      ? "2px solid #1a7a5e"
                      : needsMomConfirm
                        ? "2px solid var(--green)"
                        : "1.5px solid var(--border)",
                    padding:      "14px 14px 14px 12px",
                    marginBottom: 8,
                    cursor:       "pointer",
                    display:      "flex",
                    alignItems:   "center",
                    gap:          12,
                    minHeight:    44,
                    opacity:      isFulfilled ? 0.65 : 1,
                    transition:   "background 0.15s, border-color 0.15s",
                    userSelect:   "none",
                  }}
                >
                  {getLeftIcon(item, isSelected, isDonorView)}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, marginBottom: 1,
                      textDecoration: isFulfilled ? "line-through" : "none",
                      color: isDisputed ? "#c0392b" : "var(--ink)",
                      fontFamily: "Nunito, sans-serif",
                    }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                      {item.category} · Qty: {item.quantity}
                      {item.note && <> · {item.note}</>}
                    </div>
                    {item.assignment && !isFulfilled && !isDisputed && (
                      <div style={{ fontSize: 11, color: "#d97706", fontWeight: 600, marginTop: 2, fontFamily: "Nunito, sans-serif" }}>
                        {item.assignment.donor.name.split(" ")[0]} is on it
                      </div>
                    )}
                    {needsMomConfirm && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", marginTop: 2, fontFamily: "Nunito, sans-serif" }}>
                        Tap to confirm you received this
                      </div>
                    )}
                  </div>

                  {getRightBadge(item)}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Multi-select donate bar — shown to logged-in donors when items are selected */}
      {isDonorView && selectedItems.size > 0 && (
        <div style={{
          position: "fixed", bottom: 64, left: 0, right: 0,
          padding: "12px 16px",
          background: "var(--white)",
          borderTop: "1.5px solid var(--border)",
          boxShadow: "0 -4px 16px rgba(0,0,0,0.08)",
          zIndex: 100,
          display: "flex", alignItems: "center", gap: 12,
          maxWidth: 430, margin: "0 auto",
        }}>
          <button
            onClick={() => setSelectedItems(new Set())}
            style={{ background: "none", border: "none", color: "var(--mid)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", padding: "0 4px", flexShrink: 0 }}
          >
            Clear
          </button>
          <button
            onClick={handleMultiClaim}
            disabled={claimingMultiple}
            style={{
              flex: 1, padding: "13px 0", borderRadius: 12, border: "none",
              background: "var(--green)", color: "white",
              fontSize: 14, fontWeight: 800, cursor: claimingMultiple ? "default" : "pointer",
              fontFamily: "Nunito, sans-serif", opacity: claimingMultiple ? 0.7 : 1,
            }}
          >
            {claimingMultiple
              ? "Committing…"
              : `Donate ${selectedItems.size} item${selectedItems.size !== 1 ? "s" : ""} 💛`}
          </button>
        </div>
      )}

      {/* Add Item sheet */}
      {addingItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "var(--white)", borderRadius: "24px 24px 0 0", padding: "20px 16px 40px", width: "100%", maxWidth: 430, animation: "sheetUp 0.3s ease" }}>
            <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 4, margin: "0 auto 16px" }} />
            <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Add item</div>
            <div className="form-group">
              <label className="form-label">Item name</label>
              <input className="form-input" placeholder="e.g. Newborn diapers" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-input" value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)} style={{ fontFamily: "Nunito, sans-serif" }}>
                {["Diapering","Feeding","Clothing","Maternity","Hygiene","Other"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div className="form-group"><label className="form-label">Qty</label><input className="form-input" placeholder="e.g. 2 packs" value={newItemQty} onChange={(e) => setNewItemQty(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Note</label><input className="form-input" placeholder="Optional" value={newItemNote} onChange={(e) => setNewItemNote(e.target.value)} /></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={() => setAddingItem(false)} className="btn-clear" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleAddItem} className="btn-apply" style={{ flex: 2 }}>Add Item</button>
            </div>
          </div>
        </div>
      )}

      {/* Item detail sheet */}
      {selectedItem && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedItem(null); }}
        >
          <div style={{ background: "var(--white)", borderRadius: "24px 24px 0 0", padding: "20px 16px 40px", width: "100%", maxWidth: 430, maxHeight: "90vh", overflowY: "auto", animation: "sheetUp 0.3s ease" }}>
            <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 4, margin: "0 auto 16px" }} />

            {/* Item info */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 19, fontWeight: 700 }}>{selectedItem.name}</div>
                {(() => {
                  const es = effectiveStatus(selectedItem);
                  if (es === "FULFILLED") return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: "#e8f5f1", color: "#1a7a5e", flexShrink: 0, fontFamily: "Nunito, sans-serif" }}>
                      <CheckCircle size={11} strokeWidth={2.5} /> Fulfilled
                    </span>
                  );
                  if (es === "DISPUTED") return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: "#fdecea", color: "#c0392b", flexShrink: 0, fontFamily: "Nunito, sans-serif" }}>
                      <AlertTriangle size={11} strokeWidth={2.5} /> Disputed
                    </span>
                  );
                  if (selectedItem.status !== "AVAILABLE") return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: "#fff8e6", color: "#d97706", flexShrink: 0, fontFamily: "Nunito, sans-serif" }}>
                      <Loader2 size={11} strokeWidth={2.5} style={{ animation: "spin 1s linear infinite" }} /> In progress
                    </span>
                  );
                  return null;
                })()}
              </div>
              <div style={{ fontSize: 13, color: "var(--mid)", fontWeight: 600, fontFamily: "Nunito, sans-serif" }}>{selectedItem.category} · Qty: {selectedItem.quantity}</div>
              {selectedItem.note && <div style={{ fontSize: 13, color: "var(--mid)", marginTop: 4, fontFamily: "Nunito, sans-serif" }}>{selectedItem.note}</div>}
              {selectedItem.storeLinks.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, fontFamily: "Nunito, sans-serif" }}>Suggested stores:</div>
                  {selectedItem.storeLinks.map((link, i) => (
                    <a key={i} href={link} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: 12, color: "var(--green)", fontWeight: 600, marginBottom: 4 }}>🔗 {link}</a>
                  ))}
                </div>
              )}
            </div>

            {/* Donor: claim single item from sheet (for non-logged-in visitors) */}
            {!isMom && user && selectedItem.status === "AVAILABLE" && (
              <button className="btn-big" onClick={handleAssign} disabled={assigning} style={{ marginBottom: 16 }}>
                {assigning ? "Committing..." : "💛 I will provide this"}
              </button>
            )}

            {/* Donor: status update */}
            {!isMom && user && selectedItem.assignment?.donor.id === user.id && selectedItem.status !== "FULFILLED" && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>Update your progress:</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {selectedItem.assignment?.status === "RESERVED" && (
                    <button
                      onClick={() => handleStatusUpdate("PURCHASED")} disabled={updatingStatus}
                      style={{ flex: 1, padding: "12px", borderRadius: 10, border: "2px solid var(--green)", background: "var(--white)", color: "var(--green)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", minHeight: 44 }}
                    >
                      🛍️ Purchased
                    </button>
                  )}
                  <button
                    onClick={() => handleStatusUpdate("DELIVERED")} disabled={updatingStatus}
                    style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "var(--green)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", minHeight: 44 }}
                  >
                    ✅ Delivered
                  </button>
                </div>
              </div>
            )}

            {/* Mom: confirmation section */}
            {isMom && selectedItem.assignment?.status === "DELIVERED"
              && !selectedItem.assignment?.fulfillmentLog?.momConfirmed
              && !selectedItem.assignment?.fulfillmentLog?.mismatch && (
              <div style={{ marginBottom: 16, background: "var(--green-light)", borderRadius: 12, padding: "14px" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--green)", marginBottom: 6, fontFamily: "Nunito, sans-serif" }}>
                  🎁 {selectedItem.assignment.donor.name.split(" ")[0]} marked this as delivered!
                </div>
                <p style={{ fontSize: 13, color: "var(--green)", marginBottom: 12, fontFamily: "Nunito, sans-serif" }}>Did you receive it?</p>
                {!showDisputeForm ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={handleConfirmReceived} disabled={confirming}
                      style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: "var(--green)", color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif", minHeight: 44 }}
                    >
                      {confirming ? "…" : "✅ Yes, I received it!"}
                    </button>
                    <button
                      onClick={() => setShowDisputeForm(true)}
                      style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1.5px solid var(--terra)", background: "var(--white)", color: "var(--terra)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", minHeight: 44 }}
                    >
                      ❌ No
                    </button>
                  </div>
                ) : (
                  <>
                    <textarea
                      placeholder="What went wrong? (e.g. item not received, wrong item)"
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1.5px solid var(--border)", fontFamily: "Nunito, sans-serif", fontSize: 13, resize: "none", minHeight: 70, outline: "none", marginBottom: 10, boxSizing: "border-box" }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => setShowDisputeForm(false)}
                        style={{ flex: 1, padding: "11px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--white)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "var(--mid)", minHeight: 44 }}
                      >Back</button>
                      <button
                        onClick={handleDispute} disabled={confirming || !disputeReason.trim()}
                        style={{ flex: 2, padding: "11px", borderRadius: 10, border: "none", background: "var(--terra)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", minHeight: 44 }}
                      >
                        {confirming ? "…" : "Submit dispute"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Fulfilment confirmed banner */}
            {selectedItem.assignment?.fulfillmentLog?.momConfirmed && (
              <div style={{ background: "#e8f5f1", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#1a7a5e", fontWeight: 700, textAlign: "center", fontFamily: "Nunito, sans-serif" }}>
                🎁 Fully confirmed — thank you!
              </div>
            )}

            {/* Chat */}
            {selectedItem.assignment && user && (isMom || selectedItem.assignment.donor.id === user.id) && (
              <div>
                <div style={{ height: 1, background: "var(--border)", margin: "12px 0" }} />
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10, fontFamily: "Nunito, sans-serif" }}>
                  💬 Chat with {isMom ? selectedItem.assignment.donor.name.split(" ")[0] : firstName}
                </div>
                <div style={{ background: "var(--bg)", borderRadius: 12, padding: "10px", minHeight: 80, maxHeight: 200, overflowY: "auto", marginBottom: 10 }}>
                  {messages.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--light)", textAlign: "center", padding: "20px 0" }}>No messages yet. Say hello!</div>
                  ) : messages.map((msg) => {
                    const isMe = msg.sender.id === user.id;
                    return (
                      <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: 8 }}>
                        <div style={{ maxWidth: "80%", padding: "8px 12px", borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: isMe ? "var(--green)" : "var(--white)", color: isMe ? "white" : "var(--ink)", fontSize: 13, fontWeight: 500, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="form-input" placeholder="Type a message…" value={msgText} onChange={(e) => setMsgText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendMessage()} style={{ flex: 1, margin: 0 }} />
                  <button onClick={handleSendMessage} disabled={sendingMsg || !msgText.trim()} style={{ padding: "10px 16px", background: "var(--green)", color: "white", border: "none", borderRadius: 10, fontSize: 14, cursor: "pointer", fontWeight: 700, fontFamily: "Nunito, sans-serif" }}>Send</button>
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedItem(null)}
              style={{ width: "100%", marginTop: 16, padding: "13px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--white)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "var(--mid)", minHeight: 44 }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <BottomNav />
      <Toast message={toast} onClose={() => setToast(null)} />
      {showShareImpact && <ShareImpactModal onClose={() => setShowShareImpact(false)} />}
    </div>
  );
}
