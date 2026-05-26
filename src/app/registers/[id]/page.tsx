"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle, Package, Loader2, Users, Heart,
  BadgeCheck, MapPin, Square, SquareDot, ChevronRight,
  ShieldCheck, ImageOff, HandHeart, AlertCircle,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import Toast from "@/components/Toast";
import HowKradelWorks from "@/components/HowKradelWorks";
import TrustAndSafety from "@/components/TrustAndSafety";
import { calculateNeedLevel } from "@/lib/need-levels";
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
  status: "AVAILABLE" | "PENDING_APPROVAL" | "RESERVED" | "FULFILLED" | "DELIVERED" | "CANCELLED" | "AWAITING_ADDRESS" | "AWAITING_PURCHASE";
  standardPriceCents: number;
  totalFundedCents: number;
  fundingStatus: "UNFUNDED" | "PARTIAL" | "FULLY_FUNDED" | "IN_FULFILLMENT" | "FULFILLED";
  _count?: { funding: number };
  catalogItem: { imageUrl: string | null; sku: string | null } | null;
}

interface RegisterData {
  id: string;
  title: string;
  city: string;
  dueDate: string;
  status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CLOSED";
  addressMode: "ASK_PER_SHIPMENT" | "SAVED_PER_REGISTER";
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
  const [processing, setProcessing]         = useState(false);
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
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closingRegister, setClosingRegister] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);

  // Address confirmation flow
  const [confirmMode,       setConfirmMode]       = useState(false);
  const [showAddressSheet,  setShowAddressSheet]  = useState(false);
  const [addressItem,       setAddressItem]       = useState<RegisterItemData | null>(null);
  const [addrFullName,      setAddrFullName]      = useState("");
  const [addrStreet,        setAddrStreet]        = useState("");
  const [addrUnit,          setAddrUnit]          = useState("");
  const [addrCity,          setAddrCity]          = useState("");
  const [addrProvince,      setAddrProvince]      = useState("");
  const [addrPostal,        setAddrPostal]        = useState("");
  const [addrPhone,         setAddrPhone]         = useState("");
  const [confirmingAddress, setConfirmingAddress] = useState(false);

  const fetchRegister = useCallback(async () => {
    const res = await fetch(`/api/registers/${id}`);
    if (res.ok) { const data = await res.json(); setRegister(data.register); }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchRegister(); }, [fetchRegister]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success") {
      setToast("Payment confirmed! Kradəl will purchase and deliver this item soon.");
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      url.searchParams.delete("item");
      window.history.replaceState({}, "", url.toString());
    } else if (payment === "cancel") {
      setToast("Payment cancelled. Your contribution was not processed.");
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("confirm") === "true") {
      setConfirmMode(true);
      const itemParam = params.get("item");
      if (itemParam && register) {
        const target = register.items.find((i) => i.id === itemParam && i.status === "AWAITING_ADDRESS");
        if (target) { setAddressItem(target); setShowAddressSheet(true); }
      }
    }
  }, [register]);

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
    setProcessing(true);
    const res = await fetch(`/api/registers/${id}/items/${selectedItem.id}/fund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents: cents }),
    });
    if (res.ok) {
      const { sessionUrl } = await res.json();
      window.location.href = sessionUrl;
    } else {
      setProcessing(false);
      const d = await res.json();
      setToast(d.error ?? "Failed to initiate payment");
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

  const handleRemoveItem = async (itemId: string) => {
    setRemovingItemId(itemId);
    const res = await fetch(`/api/registers/${id}/items/${itemId}`, { method: "DELETE" });
    setRemovingItemId(null);
    if (res.ok) {
      await fetchRegister();
      setToast("Item removed");
    } else {
      const d = await res.json();
      setToast(d.error ?? "Failed to remove item");
    }
  };

  const handleCloseRegister = async () => {
    setClosingRegister(true);
    const res = await fetch(`/api/registers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CLOSED" }),
    });
    setClosingRegister(false);
    setShowCloseConfirm(false);
    if (res.ok) {
      await fetchRegister();
      setToast("Register closed");
    } else {
      const d = await res.json();
      setToast(d.error ?? "Failed to close register");
    }
  };

  const handleConfirmAddress = async () => {
    if (!addressItem) return;
    if (!addrFullName.trim() || !addrStreet.trim() || !addrCity.trim() || !addrProvince || !addrPostal.trim() || !addrPhone.trim()) {
      setToast("Please fill in all required address fields");
      return;
    }
    setConfirmingAddress(true);
    const res = await fetch(`/api/registers/${id}/items/${addressItem.id}/confirm-address`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: addrFullName, streetAddress: addrStreet, unit: addrUnit || null,
        city: addrCity, province: addrProvince, postalCode: addrPostal, phone: addrPhone,
      }),
    });
    setConfirmingAddress(false);
    if (res.ok) {
      setShowAddressSheet(false);
      setConfirmMode(false);
      setAddressItem(null);
      const url = new URL(window.location.href);
      url.searchParams.delete("confirm");
      url.searchParams.delete("item");
      window.history.replaceState({}, "", url.toString());
      await fetchRegister();
      setToast("Address confirmed! We'll begin fulfilling your item.");
    } else {
      const d = await res.json();
      if (d.code === "NEEDS_IDENTITY_VERIFICATION") {
        router.push("/profile");
      } else {
        setToast(d.error ?? "Failed to confirm address");
      }
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
  const isClosed     = register.status === "CLOSED";
  const firstName    = register.creator.name.split(" ")[0];
  const isVerified   = (register.creator.verificationLevel ?? 0) >= 2;
  const stageLine    = getStageLine(register.dueDate);

  // Donors never see PENDING_APPROVAL items (belt and suspenders — API already filters)
  const visibleItems = isDonorView
    ? register.items.filter((i) => i.status !== "PENDING_APPROVAL" && i.status !== "CANCELLED")
    : register.items;

  const totalFunded  = visibleItems.reduce((s, i) => s + i.totalFundedCents, 0);
  const totalNeeded  = visibleItems.reduce((s, i) => s + i.standardPriceCents, 0);
  const fulfilledCount = visibleItems.filter((i) => i.fundingStatus === "FULFILLED").length;
  const totalItems   = visibleItems.length;
  const totalDonors  = visibleItems.reduce((s, i) => s + (i._count?.funding ?? 0), 0);
  const pct          = totalNeeded > 0 ? Math.min(1, totalFunded / totalNeeded) : 0;
  const isFullyFunded = totalNeeded > 0 && totalFunded >= totalNeeded;
  const allFulfilled  = totalItems > 0 && fulfilledCount === totalItems;

  const awaitingItems = register.items.filter((i) => i.status === "AWAITING_ADDRESS");

  const groupedItems = groupByCategory(visibleItems);

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
            {isClosed && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#c0392b", background: "rgba(192,57,43,0.1)", padding: "3px 10px", borderRadius: 20 }}>
                Closed
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
            <HandHeart size={18} color="#1a7a5e" strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 2 }} />
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

        {/* ── Address confirmation prompt (mom only) ──────── */}
        {isMom && awaitingItems.length > 0 && (
          <div style={{ margin: "16px 16px 0", background: "#fff8e6", borderRadius: 12, border: "1.5px solid #f59e0b", padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <AlertCircle size={18} color="#d97706" strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#7a4f00", fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>
                  Shipping address needed
                </div>
                <div style={{ fontSize: 12, color: "#7a5500", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, marginBottom: 10 }}>
                  {awaitingItems.length === 1
                    ? `Your ${awaitingItems[0].name} is fully funded! Confirm your shipping address so we can send it to you.`
                    : `${awaitingItems.length} items are fully funded and waiting for your shipping address.`}
                </div>
                <button
                  onClick={() => { setAddressItem(awaitingItems[0]); setShowAddressSheet(true); }}
                  style={{ padding: "8px 16px", borderRadius: 20, border: "none", background: "#d97706", color: "white", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                >
                  Confirm shipping address
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Part 5: Grouped checklist ───────────────────── */}
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700 }}>What she needs</div>
            {isMom && !isClosed && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setAddingItem(true)}
                  style={{ background: "var(--green)", color: "white", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                >+ Add item</button>
                <button
                  onClick={() => setShowCloseConfirm(true)}
                  style={{ background: "none", color: "var(--terra)", border: "1.5px solid var(--terra)", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                >Close register</button>
              </div>
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
                  const isPending       = item.status === "PENDING_APPROVAL";
                  const isCancelledItem = item.status === "CANCELLED";
                  const canRemove       = isMom && !isClosed && item.fundingStatus === "UNFUNDED" && !isFulfilled && !isCancelledItem;
                  const whyText         = getWhyItMatters(item.category, item.name);
                  const needLevel       = calculateNeedLevel(item.catalogItem?.sku);
                  const needCfg         = needLevel === "HIGH"
                    ? { bg: "#fef3c7", color: "#c0392b", label: "High need" }
                    : needLevel === "LOW"
                    ? { bg: "#f3f4f6", color: "#555555", label: "Low need" }
                    : null;
                  const itemPct         = item.standardPriceCents > 0
                    ? Math.min(100, (item.totalFundedCents / item.standardPriceCents) * 100)
                    : 0;

                  return (
                    <div
                      key={item.id}
                      onClick={() => !isPending && !isCancelledItem && openItem(item)}
                      style={{
                        background:   "var(--white)",
                        borderRadius: 12,
                        border:       `1.5px solid ${isFulfilled ? "#c6e9de" : isPending ? "#fde68a" : isCancelledItem ? "#fee2e2" : "var(--border)"}`,
                        padding:      "14px",
                        marginBottom: 8,
                        cursor:       isPending || isCancelledItem ? "default" : "pointer",
                        opacity:      isFulfilled || isCancelledItem ? 0.75 : 1,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        {/* Catalog image with status overlay (Section 4A) */}
                        <div style={{ position: "relative", width: 48, height: 48, flexShrink: 0 }}>
                          {item.catalogItem?.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.catalogItem.imageUrl}
                              alt=""
                              style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: "1px solid #e0e0e0" }}
                            />
                          ) : (
                            <div style={{ width: 48, height: 48, borderRadius: 8, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <ImageOff size={24} color="#9ca3af" strokeWidth={1.75} />
                            </div>
                          )}
                          {/* Status icon overlaid bottom-right */}
                          <div style={{ position: "absolute", bottom: -4, right: -4, background: "white", borderRadius: "50%", padding: 2, boxShadow: "0 1px 3px rgba(0,0,0,0.15)", lineHeight: 0 }}>
                            {isPending
                              ? <span style={{ fontSize: 12, lineHeight: 1 }}>⏳</span>
                              : isCancelledItem
                              ? <span style={{ fontSize: 12, lineHeight: 1 }}>✕</span>
                              : <ItemStateIcon status={item.fundingStatus} />
                            }
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div style={{
                              fontSize: 14, fontWeight: 700,
                              textDecoration: isFulfilled || isCancelledItem ? "line-through" : "none",
                              color: isFulfilled || isCancelledItem ? "var(--mid)" : "var(--ink)",
                              fontFamily: "Nunito, sans-serif",
                            }}>
                              {item.name}
                              {item.quantity && item.quantity !== "1" && (
                                <span style={{ fontWeight: 600, color: "var(--mid)", marginLeft: 4 }}>× {item.quantity}</span>
                              )}
                            </div>
                            {canFundThis && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 800, color: "#1a7a5e", border: "1.5px solid #1a7a5e", borderRadius: 20, padding: "3px 10px", flexShrink: 0, fontFamily: "Nunito, sans-serif" }}>
                                Help provide this
                              </span>
                            )}
                          </div>

                          {/* Mom-only status badges */}
                          {isMom && isPending && (
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#d97706", background: "#fff8e6", borderRadius: 8, padding: "3px 8px", marginTop: 4, display: "inline-block" }}>
                              Pending admin review
                            </div>
                          )}
                          {isMom && isCancelledItem && (
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#c0392b", background: "#fee2e2", borderRadius: 8, padding: "3px 8px", marginTop: 4, display: "inline-block" }}>
                              Not approved
                            </div>
                          )}

                          {/* Need level badge — only for HIGH and LOW items */}
                          {isDonorView && !isFulfilled && !isPending && !isCancelledItem && needCfg && (
                            <span style={{ display: "inline-block", marginTop: 4, marginBottom: 4, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: needCfg.bg, color: needCfg.color, fontFamily: "Nunito, sans-serif" }}>
                              {needCfg.label}
                            </span>
                          )}

                          {/* Why it matters */}
                          {isDonorView && !isFulfilled && (
                            <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginTop: 3, lineHeight: 1.5 }}>
                              {whyText}
                            </div>
                          )}

                          {/* Funding bar */}
                          {item.standardPriceCents > 0 && !isFulfilled && !isPending && !isCancelledItem && (
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
                        {canRemove ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.id); }}
                            disabled={removingItemId === item.id}
                            style={{ flexShrink: 0, background: "none", border: "none", color: "var(--terra)", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}
                          >
                            {removingItemId === item.id ? "…" : "×"}
                          </button>
                        ) : (
                          !isPending && !isCancelledItem && <ChevronRight size={14} color="var(--light)" style={{ flexShrink: 0, marginTop: 2 }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* ── Part 7: Trust & safety + How it works + Closing strip ── */}
        {isDonorView && register.items.length > 0 && (
          <>
            <div style={{ marginTop: 8 }}><TrustAndSafety /></div>
            <div style={{ padding: "0 16px" }}><HowKradelWorks /></div>
            <div style={{ margin: "0 16px 140px", padding: "16px", background: "#e8f5f1", borderRadius: 12, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Heart size={16} color="#1a7a5e" strokeWidth={1.75} />
                <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 600, color: "#1a7a5e" }}>Every contribution makes a real difference.</span>
              </div>
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: "#555555" }}>Thank you for helping mothers feel supported, not alone.</span>
            </div>
          </>
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
                {/* Hero image — full-width 1:1 square (Section 7) */}
                <div style={{ width: "100%", aspectRatio: "1", background: "#f5f1ec", borderRadius: 16, marginBottom: 16, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {selectedItem.catalogItem?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedItem.catalogItem.imageUrl}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <ImageOff size={48} color="#9ca3af" strokeWidth={1.75} />
                  )}
                </div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "#1a3a2e", textAlign: "center", marginBottom: 2 }}>
                  {selectedItem.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif", fontWeight: 600, textAlign: "center", marginBottom: 6 }}>
                  {selectedItem.category}
                  {selectedItem.quantity && selectedItem.quantity !== "1" && ` · Qty: ${selectedItem.quantity}`}
                </div>

                {/* Verified badge line (Section 3) */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 14, fontSize: 12, fontWeight: 600, color: isVerified ? "#1a7a5e" : "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                  {isVerified && <ShieldCheck size={16} color="#1a7a5e" strokeWidth={1.75} />}
                  {isVerified ? `Helping ${firstName} — Verified mother` : `Helping ${firstName}`}
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
                      <ShieldCheck size={14} color="#1a7a5e" strokeWidth={1.75} />
                      <span style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                        Secure payment via Stripe. Your card details never touch our servers.
                      </span>
                    </div>

                    {user ? (
                      <button
                        onClick={handleFund}
                        disabled={processing || !fundAmount || parseFloat(fundAmount) <= 0}
                        style={{
                          width: "100%", padding: "14px", borderRadius: 12, border: "none",
                          background: processing || !fundAmount || parseFloat(fundAmount) <= 0 ? "#9ca3af" : "var(--green)",
                          color: "white", fontSize: 14, fontWeight: 800,
                          cursor: processing || !fundAmount || parseFloat(fundAmount) <= 0 ? "default" : "pointer",
                          fontFamily: "Nunito, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        }}
                      >
                        {processing ? "Redirecting to payment…" : fundAmount && parseFloat(fundAmount) > 0 ? "Contribute via Stripe" : "Enter an amount to contribute"}
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

      {/* ── Close register confirmation modal ───────────── */}
      {showCloseConfirm && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCloseConfirm(false); }}
        >
          <div style={{ background: "var(--white)", borderRadius: 16, padding: "24px 20px", width: "100%", maxWidth: 380 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Close this register?</div>
            <p style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.6, marginBottom: 20 }}>
              All unfunded items will be cancelled. Items that already have contributions will not be affected. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowCloseConfirm(false)}
                style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--white)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "var(--mid)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCloseRegister}
                disabled={closingRegister}
                style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: closingRegister ? "#9ca3af" : "var(--terra)", color: "white", fontSize: 14, fontWeight: 800, cursor: closingRegister ? "default" : "pointer", fontFamily: "Nunito, sans-serif" }}
              >
                {closingRegister ? "Closing…" : "Close register"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Address confirmation sheet (mom only) ───────── */}
      {showAddressSheet && addressItem && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddressSheet(false); }}
        >
          <div style={{ background: "var(--white)", borderRadius: "24px 24px 0 0", padding: "20px 16px 40px", width: "100%", maxWidth: 430, maxHeight: "92vh", overflowY: "auto", animation: "sheetUp 0.3s ease" }}>
            <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 4, margin: "0 auto 16px" }} />
            <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Confirm shipping address</div>
            <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 16 }}>
              For: <strong>{addressItem.name}</strong>
            </div>

            <div className="form-group">
              <label className="form-label">Full name *</label>
              <input className="form-input" placeholder="As it appears on ID" value={addrFullName} onChange={(e) => setAddrFullName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Street address *</label>
              <input className="form-input" placeholder="123 Main Street" value={addrStreet} onChange={(e) => setAddrStreet(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Apt / Unit (optional)</label>
              <input className="form-input" placeholder="Unit 4B" value={addrUnit} onChange={(e) => setAddrUnit(e.target.value)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div className="form-group">
                <label className="form-label">City *</label>
                <input className="form-input" placeholder="Toronto" value={addrCity} onChange={(e) => setAddrCity(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Province *</label>
                <select className="form-input" value={addrProvince} onChange={(e) => setAddrProvince(e.target.value)} style={{ background: "var(--white)" }}>
                  <option value="">Select…</option>
                  <option value="AB">Alberta</option>
                  <option value="BC">British Columbia</option>
                  <option value="MB">Manitoba</option>
                  <option value="NB">New Brunswick</option>
                  <option value="NL">Newfoundland and Labrador</option>
                  <option value="NS">Nova Scotia</option>
                  <option value="NT">Northwest Territories</option>
                  <option value="NU">Nunavut</option>
                  <option value="ON">Ontario</option>
                  <option value="PE">Prince Edward Island</option>
                  <option value="QC">Quebec</option>
                  <option value="SK">Saskatchewan</option>
                  <option value="YT">Yukon</option>
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div className="form-group">
                <label className="form-label">Postal code *</label>
                <input className="form-input" placeholder="M5V 2T6" value={addrPostal} onChange={(e) => setAddrPostal(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone *</label>
                <input className="form-input" type="tel" placeholder="416-555-0100" value={addrPhone} onChange={(e) => setAddrPhone(e.target.value)} />
              </div>
            </div>

            <div style={{ background: "#e8f5f1", borderRadius: 10, padding: "10px 12px", marginBottom: 16, fontSize: 12, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
              Your address is only used to ship this item and is never shared with donors.
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowAddressSheet(false)}
                className="btn-clear" style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                onClick={handleConfirmAddress}
                disabled={confirmingAddress}
                style={{
                  flex: 2, padding: "14px", borderRadius: 12, border: "none",
                  background: confirmingAddress ? "#9ca3af" : "var(--green)",
                  color: "white", fontSize: 14, fontWeight: 800,
                  cursor: confirmingAddress ? "default" : "pointer",
                  fontFamily: "Nunito, sans-serif",
                }}>
                {confirmingAddress ? "Confirming…" : "Confirm address"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
