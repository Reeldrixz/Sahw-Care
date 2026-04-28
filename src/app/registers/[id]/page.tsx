"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle, Package, Loader2, Users, Heart, Shield, Eye,
  BadgeCheck, MapPin, Square, CheckSquare, SquareDot, ChevronRight,
} from "lucide-react";
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
  creator: { id: string; name: string; location: string | null; verificationLevel?: number };
  items: RegisterItemData[];
}

function fmtMoney(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function getStageLine(dueDate: string) {
  const due = new Date(dueDate);
  const now = new Date();
  const diffDays = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 0) {
    const weeks = Math.round(diffDays / 7);
    return weeks <= 1 ? "Due this week" : `Due in ${weeks} weeks`;
  }
  const weeksOld = Math.abs(Math.round(diffDays / 7));
  return `Newborn · ${weeksOld} weeks old`;
}

function getWhyItMatters(category: string, name: string): string {
  const cat = category.toLowerCase();
  const n = name.toLowerCase();
  if (cat.includes("diaper") || n.includes("diaper")) return "Newborns go through 8–12 diapers a day — this is one of the most urgent needs.";
  if (cat.includes("feeding") || n.includes("formula") || n.includes("breast")) return "Reliable feeding equipment is essential for a healthy start.";
  if (cat.includes("sleep") || n.includes("crib") || n.includes("bassinet") || n.includes("mattress")) return "Safe sleep is critical for newborns — this protects baby every night.";
  if (cat.includes("clothing") || cat.includes("onesie") || n.includes("outfit") || n.includes("clothing")) return "Babies grow fast and need warm, comfortable layers from day one.";
  if (cat.includes("bath") || n.includes("bath")) return "A safe bath setup makes hygiene routines easier for mum and baby.";
  if (cat.includes("health") || n.includes("thermometer") || n.includes("medication")) return "Having health essentials on hand gives mum peace of mind.";
  if (cat.includes("carrier") || n.includes("carrier") || n.includes("stroller") || n.includes("pram")) return "Mobility matters — this lets mum keep baby close while moving around.";
  return "Every item on this list was chosen because it will make a real difference in the first weeks.";
}

const CATEGORY_ORDER = [
  "Feeding", "Sleep", "Diapers & Hygiene", "Clothing", "Health", "Mobility", "Other",
];

function groupByCategory(items: RegisterItemData[]): [string, RegisterItemData[]][] {
  const map = new Map<string, RegisterItemData[]>();
  for (const item of items) {
    const cat = item.category || "Other";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }
  const ordered: [string, RegisterItemData[]][] = [];
  for (const cat of CATEGORY_ORDER) {
    if (map.has(cat)) { ordered.push([cat, map.get(cat)!]); map.delete(cat); }
  }
  for (const [cat, items] of map) { ordered.push([cat, items]); }
  return ordered;
}

function ItemStateIcon({ status }: { status: RegisterItemData["fundingStatus"] }) {
  if (status === "FULFILLED") return <CheckCircle size={18} color="#1a7a5e" strokeWidth={2} />;
  if (status === "IN_FULFILLMENT" || status === "FULLY_FUNDED") return <Loader2 size={18} color="#d97706" strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} />;
  if (status === "PARTIAL") return <SquareDot size={18} color="#1a7a5e" strokeWidth={2} />;
  return <Square size={18} color="#9ca3af" strokeWidth={1.5} />;
}

export default function RegisterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();

  const [register, setRegister]             = useState<RegisterData | null>(null);
  const [loading, setLoading]               = useState(true);
  const [selectedItem, setSelectedItem]     = useState<RegisterItemData | null>(null);
  const [fundingDetails, setFundingDetails] = useState<{ donorCount: number; contributors: FundingEntry[] } | null>(null);
  const [fundAmount, setFundAmount]         = useState("");
  const [funding, setFunding]               = useState(false);
  const [funded, setFunded]                 = useState(false);
  const [fundedAmount, setFundedAmount]     = useState(0);
  const [addingItem, setAddingItem]         = useState(false);
  const [catalog, setCatalog]               = useState<{ id: string; name: string; category: string; standardPriceCents: number }[]>([]);
  const [catalogSearch, setCatalogSearch]   = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [customMode, setCustomMode]         = useState(false);
  const [newItemName, setNewItemName]       = useState("");
  const [newItemQty, setNewItemQty]         = useState("1");
  const [newItemNote, setNewItemNote]       = useState("");
  const [toast, setToast]                   = useState<string | null>(null);

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
    setFunded(false);
    setFundedAmount(0);
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
      setFundedAmount(cents);
      setFunded(true);
      await fetchRegister();
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

  const isMom        = user?.id === register.creator.id;
  const isDonorView  = !isMom;
  const firstName    = register.creator.name.split(" ")[0];
  const isVerified   = (register.creator.verificationLevel ?? 0) >= 2;
  const stageLine    = getStageLine(register.dueDate);
  const totalFunded  = register.items.reduce((s, i) => s + i.totalFundedCents, 0);
  const totalNeeded  = register.items.reduce((s, i) => s + i.standardPriceCents, 0);
  const fulfilledCount = register.items.filter((i) => i.fundingStatus === "FULFILLED").length;
  const totalItems   = register.items.length;
  const totalDonors  = register.items.reduce((s, i) => s + (i._count?.funding ?? 0), 0);
  const pct          = totalNeeded > 0 ? Math.min(1, totalFunded / totalNeeded) : 0;
  const isFullyFunded = totalNeeded > 0 && totalFunded >= totalNeeded;
  const allFulfilled  = totalItems > 0 && fulfilledCount === totalItems;

  const groupedItems = groupByCategory(register.items);

  const filteredCatalog = catalog.filter((c) =>
    c.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    c.category.toLowerCase().includes(catalogSearch.toLowerCase())
  );
  const selectedCatalogItem = catalog.find((c) => c.id === selectedCatalogId);

  const canFund = selectedItem &&
    ["UNFUNDED", "PARTIAL"].includes(selectedItem.fundingStatus) &&
    isDonorView;

  const remaining = selectedItem
    ? Math.max(0, selectedItem.standardPriceCents - selectedItem.totalFundedCents)
    : 0;

  const quickPills = selectedItem && remaining > 0
    ? [
        { label: "Contribute $5", cents: 500 },
        { label: "Contribute $10", cents: 1000 },
        { label: `Complete it — ${fmtMoney(remaining)}`, cents: remaining },
      ].filter((p, i, arr) => i === arr.findIndex((q) => q.cents === p.cents) && p.cents > 0)
    : [];

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">

        {/* ── Part 2: Header ─────────────────────────────── */}
        <div style={{ background: "#e8f5f1", padding: "16px 16px 20px" }}>
          <button
            onClick={() => router.push("/registers")}
            style={{ background: "rgba(26,122,94,0.12)", border: "none", borderRadius: "50%", width: 36, height: 36, fontSize: 18, cursor: "pointer", color: "#1a7a5e", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}
          >←</button>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            {isVerified && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "#1a7a5e", background: "rgba(26,122,94,0.12)", padding: "3px 8px", borderRadius: 20 }}>
                <BadgeCheck size={11} strokeWidth={2.5} /> Verified mother
              </span>
            )}
            {allFulfilled && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#1a7a5e", background: "rgba(26,122,94,0.12)", padding: "3px 10px", borderRadius: 20 }}>
                Completed ✓
              </span>
            )}
          </div>

          <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: "#1a3a2e", marginBottom: 4 }}>
            {firstName}&apos;s Register
          </div>
          <div style={{ fontSize: 12, color: "#3d7a62", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <MapPin size={11} />
            {register.city}
            <span style={{ opacity: 0.5 }}>·</span>
            {stageLine}
          </div>
        </div>

        {/* ── Part 3: Emotional context card ─────────────── */}
        {isDonorView && (
          <div style={{ margin: "16px 16px 0", background: "var(--white)", borderRadius: 12, borderLeft: "3px solid #1a7a5e", padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Heart size={18} color="#1a7a5e" strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", color: "var(--ink)", marginBottom: 4 }}>
                {firstName} is preparing for her baby
              </div>
              <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
                Every item on this register is something {firstName} has identified as a real need — not a wish list, but a preparation list for her baby&apos;s first weeks. Your contribution goes directly to purchasing and delivering these items to her.
              </div>
            </div>
          </div>
        )}

        {/* ── Part 4: Progress section ────────────────────── */}
        {totalItems > 0 && totalNeeded > 0 && (
          <div style={{ margin: "16px 16px 0", background: "var(--white)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", color: "var(--ink)" }}>
                {isFullyFunded ? "Fully funded" : `${fmtMoney(totalFunded)} raised`}
              </span>
              <span style={{ fontSize: 12, color: "var(--mid)", fontWeight: 600, fontFamily: "Nunito, sans-serif" }}>
                of {fmtMoney(totalNeeded)} total
              </span>
            </div>
            <div style={{ height: 12, borderRadius: 8, background: "#e5e7eb", overflow: "hidden", marginBottom: 10 }}>
              <div style={{
                width: `${pct * 100}%`, height: "100%",
                background: isFullyFunded ? "#1a7a5e" : "linear-gradient(90deg, #1a7a5e 0%, #2ea87a 100%)",
                borderRadius: 8, transition: "width 0.4s",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--mid)", fontWeight: 600, fontFamily: "Nunito, sans-serif" }}>
              <span>{fulfilledCount} of {totalItems} needs completed</span>
              {totalDonors > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#1a7a5e" }}>
                  <Users size={11} />
                  {totalDonors} contributor{totalDonors !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Part 5: Grouped checklist ───────────────────── */}
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700 }}>What she needs</div>
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
              {isMom && <div style={{ color: "var(--mid)", fontSize: 13 }}>Add the things you need for your baby</div>}
            </div>
          ) : (
            groupedItems.map(([category, items]) => (
              <div key={category} style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em",
                  color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 8, paddingBottom: 4,
                  borderBottom: "1px solid var(--border)",
                }}>
                  {category}
                </div>
                {items.map((item) => {
                  const isFulfilled     = item.fundingStatus === "FULFILLED";
                  const isInFulfillment = item.fundingStatus === "IN_FULFILLMENT" || item.fundingStatus === "FULLY_FUNDED";
                  const canFundThis     = ["UNFUNDED", "PARTIAL"].includes(item.fundingStatus) && isDonorView;
                  const whyText         = getWhyItMatters(item.category, item.name);
                  const itemPct         = item.standardPriceCents > 0
                    ? Math.min(100, (item.totalFundedCents / item.standardPriceCents) * 100)
                    : 0;

                  return (
                    <div
                      key={item.id}
                      onClick={() => openItem(item)}
                      style={{
                        background:   "var(--white)",
                        borderRadius: 12,
                        border:       `1.5px solid ${isFulfilled ? "#c6e9de" : "var(--border)"}`,
                        padding:      "14px",
                        marginBottom: 8,
                        cursor:       "pointer",
                        opacity:      isFulfilled ? 0.8 : 1,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flexShrink: 0, marginTop: 1 }}>
                          <ItemStateIcon status={item.fundingStatus} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div style={{
                              fontSize: 14, fontWeight: 700,
                              textDecoration: isFulfilled ? "line-through" : "none",
                              color: isFulfilled ? "var(--mid)" : "var(--ink)",
                              fontFamily: "Nunito, sans-serif",
                            }}>
                              {item.name}
                              {item.quantity && item.quantity !== "1" && (
                                <span style={{ fontWeight: 600, color: "var(--mid)", marginLeft: 4 }}>× {item.quantity}</span>
                              )}
                            </div>
                            {canFundThis && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 800, color: "#1a7a5e", border: "1.5px solid #1a7a5e", borderRadius: 20, padding: "3px 10px", flexShrink: 0, fontFamily: "Nunito, sans-serif" }}>
                                Help fund this
                              </span>
                            )}
                          </div>

                          {/* Why it matters */}
                          {isDonorView && !isFulfilled && (
                            <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginTop: 3, lineHeight: 1.5 }}>
                              {whyText}
                            </div>
                          )}

                          {/* Funding bar */}
                          {item.standardPriceCents > 0 && !isFulfilled && (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ height: 4, borderRadius: 4, background: "#e5e7eb", overflow: "hidden" }}>
                                <div style={{ width: `${itemPct}%`, height: "100%", background: "#1a7a5e", borderRadius: 4, transition: "width 0.4s" }} />
                              </div>
                              <div style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600, marginTop: 3, fontFamily: "Nunito, sans-serif" }}>
                                {item.fundingStatus === "PARTIAL"
                                  ? `${fmtMoney(item.totalFundedCents)} of ${fmtMoney(item.standardPriceCents)}`
                                  : fmtMoney(item.standardPriceCents)}
                                {isInFulfillment && " · Being fulfilled"}
                                {(item._count?.funding ?? 0) > 0 && ` · ${item._count!.funding} contributor${item._count!.funding !== 1 ? "s" : ""}`}
                              </div>
                            </div>
                          )}

                          {isFulfilled && (
                            <div style={{ fontSize: 11, color: "#1a7a5e", fontWeight: 600, fontFamily: "Nunito, sans-serif", marginTop: 3 }}>
                              Delivered to {firstName}
                            </div>
                          )}
                        </div>
                        <ChevronRight size={14} color="var(--light)" style={{ flexShrink: 0, marginTop: 2 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* ── Part 7: Trust & safety footer ──────────────── */}
        {isDonorView && register.items.length > 0 && (
          <div style={{ margin: "8px 16px 140px", padding: "16px", background: "var(--white)", borderRadius: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ textAlign: "center" }}>
              <Shield size={18} color="#1a7a5e" style={{ margin: "0 auto 6px" }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)", fontFamily: "Nunito, sans-serif", marginBottom: 2 }}>Secure</div>
              <div style={{ fontSize: 10, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.4 }}>Payments processed safely. No card details shared.</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <Package size={18} color="#1a7a5e" style={{ margin: "0 auto 6px" }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)", fontFamily: "Nunito, sans-serif", marginBottom: 2 }}>Kradel delivers</div>
              <div style={{ fontSize: 10, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.4 }}>We purchase and deliver items directly — donors don't ship anything.</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <Eye size={18} color="#1a7a5e" style={{ margin: "0 auto 6px" }} />
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)", fontFamily: "Nunito, sans-serif", marginBottom: 2 }}>Verified</div>
              <div style={{ fontSize: 10, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.4 }}>Every mother is document-verified before creating a register.</div>
            </div>
          </div>
        )}

        {!isDonorView && <div style={{ height: 140 }} />}
      </div>

      {/* ── Add Item sheet (mom only) ────────────────────── */}
      {addingItem && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setAddingItem(false); }}
        >
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
                        padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid var(--border)",
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
                  Custom items go to admin review and won&apos;t have a fixed price.
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

      {/* ── Part 6: Item funding sheet ───────────────────── */}
      {selectedItem && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) { setSelectedItem(null); setFunded(false); } }}
        >
          <div style={{ background: "var(--white)", borderRadius: "24px 24px 0 0", padding: "20px 16px 40px", width: "100%", maxWidth: 430, maxHeight: "92vh", overflowY: "auto", animation: "sheetUp 0.3s ease" }}>
            <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 4, margin: "0 auto 16px" }} />

            {funded ? (
              /* ── Confirmation screen ── */
              <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <CheckCircle size={32} color="#1a7a5e" strokeWidth={2} />
                </div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#1a3a2e" }}>
                  Thank you!
                </div>
                <div style={{ fontSize: 14, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, marginBottom: 20 }}>
                  Your {fmtMoney(fundedAmount)} contribution to <strong>{selectedItem.name}</strong> has been recorded. Kradəl will purchase and deliver this item to {firstName}.
                </div>
                {selectedItem.totalFundedCents + fundedAmount >= selectedItem.standardPriceCents ? (
                  <div style={{ background: "#e8f5f1", borderRadius: 12, padding: "12px 14px", marginBottom: 20, fontSize: 13, color: "#1a7a5e", fontWeight: 600, fontFamily: "Nunito, sans-serif" }}>
                    This item is now fully funded. Kradəl will fulfill it soon.
                  </div>
                ) : null}
                <button
                  onClick={() => { setSelectedItem(null); setFunded(false); }}
                  style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "var(--green)", color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                >
                  See other needs
                </button>
              </div>
            ) : (
              <>
                {/* Item icon + heading */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Heart size={20} color="#1a7a5e" strokeWidth={2} />
                  </div>
                  <div>
                    <div style={{ fontFamily: "Lora, serif", fontSize: 19, fontWeight: 700, color: "#1a3a2e" }}>{selectedItem.name}</div>
                    <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif", fontWeight: 600 }}>
                      {selectedItem.category}
                      {selectedItem.quantity && selectedItem.quantity !== "1" && ` · Qty: ${selectedItem.quantity}`}
                    </div>
                  </div>
                </div>

                {/* Status badges */}
                {selectedItem.fundingStatus === "FULFILLED" && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: "#e8f5f1", color: "#1a7a5e", fontFamily: "Nunito, sans-serif", marginBottom: 12 }}>
                    <CheckCircle size={11} strokeWidth={2.5} /> Delivered to {firstName}
                  </span>
                )}
                {(selectedItem.fundingStatus === "IN_FULFILLMENT" || selectedItem.fundingStatus === "FULLY_FUNDED") && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: "#fff8e6", color: "#d97706", fontFamily: "Nunito, sans-serif", marginBottom: 12 }}>
                    <Package size={11} strokeWidth={2.5} /> Being fulfilled by Kradəl
                  </span>
                )}

                {/* Why it matters card */}
                {isDonorView && !["FULFILLED", "IN_FULFILLMENT", "FULLY_FUNDED"].includes(selectedItem.fundingStatus) && (
                  <div style={{ background: "#e8f5f1", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, fontWeight: 600 }}>
                    {getWhyItMatters(selectedItem.category, selectedItem.name)}
                  </div>
                )}

                {/* Funding progress */}
                {selectedItem.standardPriceCents > 0 && (
                  <div style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", color: "var(--ink)" }}>Progress</span>
                      <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", color: "#1a7a5e" }}>
                        {fmtMoney(selectedItem.totalFundedCents)} / {fmtMoney(selectedItem.standardPriceCents)}
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 6, background: "#e5e7eb", overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${Math.min(100, selectedItem.standardPriceCents > 0 ? (selectedItem.totalFundedCents / selectedItem.standardPriceCents) * 100 : 0)}%`,
                        background: "#1a7a5e", borderRadius: 6, transition: "width 0.4s",
                      }} />
                    </div>
                    {fundingDetails && fundingDetails.donorCount > 0 && (
                      <div style={{ marginTop: 8, fontSize: 11, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                        <Users size={11} />
                        {fundingDetails.donorCount} donor{fundingDetails.donorCount !== 1 ? "s" : ""} have contributed
                      </div>
                    )}
                  </div>
                )}

                {/* Fund input for donors */}
                {canFund && (
                  <div>
                    {/* Quick-select pills */}
                    {quickPills.length > 0 && (
                      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                        {quickPills.map((p) => (
                          <button
                            key={p.cents}
                            onClick={() => setFundAmount(String(p.cents / 100))}
                            style={{
                              padding: "8px 14px", borderRadius: 20, border: `1.5px solid ${parseFloat(fundAmount) * 100 === p.cents ? "#1a7a5e" : "var(--border)"}`,
                              background: parseFloat(fundAmount) * 100 === p.cents ? "#e8f5f1" : "var(--white)",
                              color: parseFloat(fundAmount) * 100 === p.cents ? "#1a7a5e" : "var(--ink)",
                              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif",
                            }}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Custom amount */}
                    <div style={{ position: "relative", marginBottom: 12 }}>
                      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>$</span>
                      <input
                        className="form-input"
                        type="number"
                        min="1"
                        placeholder="Custom amount"
                        value={fundAmount}
                        onChange={(e) => setFundAmount(e.target.value)}
                        style={{ paddingLeft: 28 }}
                      />
                    </div>

                    {/* Trust block */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f9fafb", borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
                      <Shield size={14} color="#1a7a5e" strokeWidth={2} />
                      <span style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                        Your contribution is secure. Kradəl buys and delivers directly — you never ship anything.
                      </span>
                    </div>

                    {user ? (
                      <button
                        onClick={handleFund}
                        disabled={funding || !fundAmount || parseFloat(fundAmount) <= 0}
                        style={{
                          width: "100%", padding: "14px", borderRadius: 12, border: "none",
                          background: funding || !fundAmount || parseFloat(fundAmount) <= 0 ? "#9ca3af" : "var(--green)",
                          color: "white", fontSize: 14, fontWeight: 800,
                          cursor: funding || !fundAmount || parseFloat(fundAmount) <= 0 ? "default" : "pointer",
                          fontFamily: "Nunito, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        }}
                      >
                        {funding ? "Processing…" : fundAmount && parseFloat(fundAmount) > 0 ? `Contribute ${fmtMoney(Math.round(parseFloat(fundAmount) * 100))}` : "Enter an amount to contribute"}
                      </button>
                    ) : (
                      <button
                        onClick={() => router.push("/auth")}
                        style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "var(--green)", color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                      >
                        Sign in to contribute
                      </button>
                    )}
                  </div>
                )}

                {selectedItem.fundingStatus === "FULFILLED" && (
                  <div style={{ background: "#e8f5f1", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontSize: 13, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckCircle size={16} color="#1a7a5e" />
                    This item has been delivered to {firstName}.
                  </div>
                )}

                {selectedItem.fundingStatus === "IN_FULFILLMENT" && (
                  <div style={{ background: "#fff8e6", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontSize: 13, color: "#7a5500", fontFamily: "Nunito, sans-serif", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    <Package size={16} color="#d97706" />
                    Kradəl is processing this item for delivery.
                  </div>
                )}

                <button
                  onClick={() => setSelectedItem(null)}
                  style={{ width: "100%", marginTop: 10, padding: "13px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--white)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "var(--mid)" }}
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <BottomNav />
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
