"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
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

const STATUS_CONFIG = {
  AVAILABLE: { label: "Available", bg: "var(--green-light)", color: "var(--green)",  icon: "✅" },
  RESERVED:  { label: "Reserved",  bg: "var(--yellow-light)", color: "#b8860b",      icon: "⏳" },
  FULFILLED: { label: "Fulfilled", bg: "#e8f5f1",             color: "#1a7a5e",      icon: "🎁" },
  DISPUTED:  { label: "Disputed",  bg: "#fdecea",             color: "#c0392b",      icon: "⚠️" },
};

function effectiveStatus(item: RegisterItemData): keyof typeof STATUS_CONFIG {
  if (item.assignment?.fulfillmentLog?.mismatch) return "DISPUTED";
  return item.status;
}

export default function RegisterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [register, setRegister] = useState<RegisterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<RegisterItemData | null>(null);
  const [messages, setMessages] = useState<RegisterMessage[]>([]);
  const [msgText, setMsgText] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [showShareImpact, setShowShareImpact] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Other");
  const [newItemQty, setNewItemQty] = useState("1");
  const [newItemNote, setNewItemNote] = useState("");

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
      const isMom = register?.creator.id === user.id;
      const isDonor = item.assignment.donor.id === user.id;
      if (isMom || isDonor) {
        const res = await fetch(`/api/registers/${id}/items/${item.id}/messages`);
        if (res.ok) { const data = await res.json(); setMessages(data.messages ?? []); }
        else setMessages([]);
      } else setMessages([]);
    } else setMessages([]);
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
        setToast("Marked as delivered! 🎁 Share your impact with the world.");
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
      setSelectedItem(null);  // close immediately
      fetchRegister();        // refresh list in background
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
      setSelectedItem(null);  // close immediately
      fetchRegister();        // refresh list in background (badge → Disputed)
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

  const isMom = user?.id === register.creator.id;
  const total = register.items.length;
  const fulfilled = register.items.filter((i) => i.status === "FULFILLED").length;
  const pct = total > 0 ? fulfilled / total : 0;
  const firstName = register.creator.name.split(" ")[0];
  const dueDate = new Date(register.dueDate).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">
        {/* Header */}
        <div style={{ background: "var(--green)", padding: "16px 16px 24px", color: "white" }}>
          <button onClick={() => router.push("/registers")} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 36, height: 36, fontSize: 18, cursor: "pointer", color: "white", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
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
        <div style={{ padding: "16px 16px 120px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700 }}>Needs checklist</div>
            {isMom && (
              <button onClick={() => setAddingItem(true)} style={{ background: "var(--green)", color: "white", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>+ Add item</button>
            )}
          </div>

          {register.items.length === 0 ? (
            <div className="empty"><div className="empty-icon">🛍️</div><div className="empty-title">No items yet</div>{isMom && <div>Add items you need for your baby</div>}</div>
          ) : (
            register.items.map((item) => {
              const cfg = STATUS_CONFIG[effectiveStatus(item)];
              const needsMomConfirm = isMom && item.assignment?.status === "DELIVERED"
                && !item.assignment?.fulfillmentLog?.momConfirmed
                && !item.assignment?.fulfillmentLog?.mismatch;
              return (
                <div key={item.id} onClick={() => openItem(item)} style={{
                  background: "var(--white)", borderRadius: 12, padding: "14px", marginBottom: 10,
                  boxShadow: needsMomConfirm ? "0 0 0 2px var(--green)" : "var(--shadow)",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                  opacity: item.status === "FULFILLED" && !item.assignment?.fulfillmentLog?.mismatch ? 0.7 : 1,
                }}>
                  <div style={{ fontSize: 22, flexShrink: 0 }}>{cfg.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2, textDecoration: item.status === "FULFILLED" && !item.assignment?.fulfillmentLog?.mismatch ? "line-through" : "none" }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: "var(--mid)", fontWeight: 600 }}>
                      {item.category} · Qty: {item.quantity}
                      {item.note && <> · {item.note}</>}
                    </div>
                    {item.assignment && (
                      <div style={{ fontSize: 11, color: "var(--mid)", marginTop: 2 }}>
                        By {item.assignment.donor.name.split(" ")[0]} · {item.assignment.status.toLowerCase()}
                      </div>
                    )}
                    {needsMomConfirm && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", marginTop: 2 }}>👆 Tap to confirm received</div>
                    )}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: cfg.bg, color: cfg.color, flexShrink: 0 }}>{cfg.label}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedItem(null); }}>
          <div style={{ background: "var(--white)", borderRadius: "24px 24px 0 0", padding: "20px 16px 40px", width: "100%", maxWidth: 430, maxHeight: "90vh", overflowY: "auto", animation: "sheetUp 0.3s ease" }}>
            <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 4, margin: "0 auto 16px" }} />

            {/* Item info */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 19, fontWeight: 700 }}>{selectedItem.name}</div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: STATUS_CONFIG[effectiveStatus(selectedItem)].bg, color: STATUS_CONFIG[effectiveStatus(selectedItem)].color, flexShrink: 0 }}>
                  {STATUS_CONFIG[effectiveStatus(selectedItem)].icon} {STATUS_CONFIG[effectiveStatus(selectedItem)].label}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "var(--mid)", fontWeight: 600 }}>{selectedItem.category} · Qty: {selectedItem.quantity}</div>
              {selectedItem.note && <div style={{ fontSize: 13, color: "var(--mid)", marginTop: 4 }}>{selectedItem.note}</div>}
              {selectedItem.storeLinks.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Suggested stores:</div>
                  {selectedItem.storeLinks.map((link, i) => (
                    <a key={i} href={link} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: 12, color: "var(--green)", fontWeight: 600, marginBottom: 4 }}>🔗 {link}</a>
                  ))}
                </div>
              )}
            </div>

            {/* ── Donor: claim button ── */}
            {!isMom && user && selectedItem.status === "AVAILABLE" && (
              <button className="btn-big" onClick={handleAssign} disabled={assigning} style={{ marginBottom: 16 }}>
                {assigning ? "Committing..." : "💛 I will provide this"}
              </button>
            )}

            {/* ── Donor: status update ── */}
            {!isMom && user && selectedItem.assignment?.donor.id === user.id && selectedItem.status !== "FULFILLED" && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: "var(--mid)" }}>Update your progress:</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {selectedItem.assignment?.status === "RESERVED" && (
                    <button onClick={() => handleStatusUpdate("PURCHASED")} disabled={updatingStatus}
                      style={{ flex: 1, padding: "10px", borderRadius: 10, border: "2px solid var(--green)", background: "var(--white)", color: "var(--green)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                      🛍️ Purchased
                    </button>
                  )}
                  <button onClick={() => handleStatusUpdate("DELIVERED")} disabled={updatingStatus}
                    style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "var(--green)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                    ✅ Delivered
                  </button>
                </div>
              </div>
            )}

            {/* ── Mom: confirmation section ── */}
            {isMom && selectedItem.assignment?.status === "DELIVERED"
              && !selectedItem.assignment?.fulfillmentLog?.momConfirmed
              && !selectedItem.assignment?.fulfillmentLog?.mismatch && (
              <div style={{ marginBottom: 16, background: "var(--green-light)", borderRadius: 12, padding: "14px" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--green)", marginBottom: 6 }}>
                  🎁 {selectedItem.assignment.donor.name.split(" ")[0]} marked this as delivered!
                </div>
                <p style={{ fontSize: 13, color: "var(--green)", marginBottom: 12 }}>Did you receive it?</p>
                {!showDisputeForm ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleConfirmReceived} disabled={confirming}
                      style={{ flex: 2, padding: "10px", borderRadius: 10, border: "none", background: "var(--green)", color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                      {confirming ? "..." : "✅ Yes, I received it!"}
                    </button>
                    <button onClick={() => setShowDisputeForm(true)}
                      style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1.5px solid var(--terra)", background: "var(--white)", color: "var(--terra)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                      ❌ No
                    </button>
                  </div>
                ) : (
                  <>
                    <textarea
                      placeholder="What went wrong? (e.g. item not received, wrong item)"
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1.5px solid var(--border)", fontFamily: "Nunito, sans-serif", fontSize: 13, resize: "none", minHeight: 70, outline: "none", marginBottom: 10 }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setShowDisputeForm(false)} style={{ flex: 1, padding: "9px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--white)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "var(--mid)" }}>Back</button>
                      <button onClick={handleDispute} disabled={confirming || !disputeReason.trim()} style={{ flex: 2, padding: "9px", borderRadius: 10, border: "none", background: "var(--terra)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                        {confirming ? "..." : "Submit dispute"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Fulfilment confirmed badge */}
            {selectedItem.assignment?.fulfillmentLog?.momConfirmed && (
              <div style={{ background: "var(--green-light)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--green)", fontWeight: 700, textAlign: "center" }}>
                🎁 Fully confirmed — thank you!
              </div>
            )}

            {/* ── Chat ── */}
            {selectedItem.assignment && user && (isMom || selectedItem.assignment.donor.id === user.id) && (
              <div>
                <div style={{ height: 1, background: "var(--border)", margin: "12px 0" }} />
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>
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
                  <input className="form-input" placeholder="Type a message..." value={msgText} onChange={(e) => setMsgText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendMessage()} style={{ flex: 1, margin: 0 }} />
                  <button onClick={handleSendMessage} disabled={sendingMsg || !msgText.trim()} style={{ padding: "10px 16px", background: "var(--green)", color: "white", border: "none", borderRadius: 10, fontSize: 14, cursor: "pointer", fontWeight: 700, fontFamily: "Nunito, sans-serif" }}>Send</button>
                </div>
              </div>
            )}

            <button onClick={() => setSelectedItem(null)} style={{ width: "100%", marginTop: 16, padding: "12px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--white)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "var(--mid)" }}>
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
