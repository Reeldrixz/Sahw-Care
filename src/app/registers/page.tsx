"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Heart, Bookmark, SlidersHorizontal } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import HowKradelWorks from "@/components/HowKradelWorks";
import TrustAndSafety from "@/components/TrustAndSafety";
import LocationSelector from "@/components/LocationSelector";
import Toast from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";
import { useUserLocation } from "@/hooks/useUserLocation";

interface RegisterItemData {
  id: string;
  name: string;
  quantity: string;
  status: string;
  fundingStatus: string;
  standardPriceCents: number;
  totalFundedCents: number;
  savedByMe: boolean;
  _count: { funding: number };
  catalogItem: { imageUrl: string | null } | null;
}

interface RegisterData {
  id: string;
  title: string;
  city: string;
  dueDate: string;
  createdAt: string;
  creator: {
    id: string;
    name: string;
    location: string | null;
    verificationLevel: number;
    circleContext: string | null;
  };
  items: RegisterItemData[];
}

interface AisleItem extends RegisterItemData {
  register: RegisterData;
}

type TabKey = "all" | "nearby" | "due-soon" | "verified";

function formatDueDate(dueDate: string) {
  const due = new Date(dueDate);
  const diffDays = Math.round((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    const weeksOld = Math.abs(Math.round(diffDays / 7));
    return `Newborn · ${weeksOld}w old`;
  }
  if (diffDays <= 7) return "Due this week";
  return `Due ${due.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
}

function fmtMoney(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function interleave(registers: RegisterData[]): AisleItem[] {
  const queues = registers
    .map((reg) => ({
      reg,
      items: reg.items.filter(
        (i) =>
          i.fundingStatus !== "FULFILLED" &&
          i.status !== "CANCELLED" &&
          i.status !== "PENDING_APPROVAL"
      ),
    }))
    .filter((q) => q.items.length > 0);

  const result: AisleItem[] = [];
  let round = 0;
  while (true) {
    let added = false;
    for (const { reg, items } of queues) {
      if (round < items.length) {
        result.push({ ...items[round], register: reg });
        added = true;
      }
    }
    if (!added) break;
    round++;
  }
  return result;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "all",      label: "All"      },
  { key: "nearby",   label: "Nearby"   },
  { key: "due-soon", label: "Due Soon" },
  { key: "verified", label: "Verified" },
];

const TAB_EMPTY: Record<TabKey, string> = {
  "all":      "No items available right now.",
  "nearby":   "No items in this city yet.",
  "due-soon": "No items from registers due in the next 6 weeks.",
  "verified": "No items from verified mothers yet.",
};

export default function RegistersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { activeCity, activeRadius, activeSetByGPS, handleLocationSelect } = useUserLocation();

  const [registers, setRegisters]   = useState<RegisterData[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [tab, setTab]               = useState<TabKey>("all");
  const [savedState, setSavedState] = useState<Record<string, boolean>>({});
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [toast, setToast]           = useState<string | null>(null);

  const fetchRegisters = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/registers");
    if (res.ok) {
      const data = await res.json();
      const regs: RegisterData[] = data.registers ?? [];
      setRegisters(regs);
      const init: Record<string, boolean> = {};
      for (const r of regs) {
        for (const i of r.items) { init[i.id] = i.savedByMe ?? false; }
      }
      setSavedState(init);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRegisters(); }, [fetchRegisters]);

  const handleToggleSave = async (e: React.MouseEvent, item: AisleItem) => {
    e.stopPropagation();
    if (!user) { router.push("/auth"); return; }
    const prev = savedState[item.id] ?? false;
    setSavedState((s) => ({ ...s, [item.id]: !prev }));
    const res = await fetch(
      `/api/registers/${item.register.id}/items/${item.id}/save`,
      { method: "POST" }
    );
    if (res.ok) {
      const d = await res.json();
      setSavedState((s) => ({ ...s, [item.id]: d.saved }));
    } else {
      setSavedState((s) => ({ ...s, [item.id]: prev }));
      setToast("Failed to save item");
    }
  };

  // Build interleaved aisle from all registers, then filter/search
  const allItems = interleave(registers);

  const searchLower = search.toLowerCase();
  const filtered = allItems.filter((item) => {
    if (!searchLower) return true;
    return (
      item.name.toLowerCase().includes(searchLower) ||
      item.register.creator.name.toLowerCase().includes(searchLower) ||
      item.register.city.toLowerCase().includes(searchLower)
    );
  });

  const tabFiltered = filtered.filter((item) => {
    if (tab === "all") return true;
    if (tab === "nearby") {
      if (!activeCity) return false;
      return item.register.city.toLowerCase() === activeCity.toLowerCase();
    }
    if (tab === "due-soon") {
      const diffDays = Math.round(
        (new Date(item.register.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      return diffDays <= 42;
    }
    if (tab === "verified") {
      return (item.register.creator.verificationLevel ?? 0) >= 2;
    }
    return true;
  });

  const savedCount = Object.values(savedState).filter(Boolean).length;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">

        {/* Header */}
        <div style={{ background: "var(--white)", padding: "16px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700 }}>Registers</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {user && (
                <button
                  onClick={() => router.push("/registers/saved")}
                  style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", padding: "4px 0" }}
                >
                  <Bookmark size={15} strokeWidth={1.75} />
                  Saved{savedCount > 0 ? ` (${savedCount})` : ""}
                </button>
              )}
              {user && user.journeyType !== "donor" && (
                <button
                  onClick={() => router.push("/registers/new")}
                  style={{ background: "var(--green)", color: "white", border: "none", borderRadius: 20, padding: "8px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                >
                  + Create
                </button>
              )}
            </div>
          </div>
          <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 14 }}>
            Mothers share what they need. You choose what to give.
          </p>

          {/* Search + filter icon */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", borderRadius: 12, padding: "10px 14px", flex: 1 }}>
              <span style={{ fontSize: 14, color: "var(--light)" }}>🔍</span>
              <input
                placeholder="Search by item, name or city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ border: "none", background: "transparent", fontFamily: "Nunito, sans-serif", fontSize: 14, color: "var(--ink)", outline: "none", flex: 1 }}
              />
            </div>
            <button
              onClick={() => setShowLocationSheet(true)}
              style={{ background: "var(--bg)", border: "none", borderRadius: 12, padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <SlidersHorizontal size={20} strokeWidth={1.75} color="#555555" />
            </button>
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, scrollbarWidth: "none" }}>
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                style={{
                  padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                  cursor: "pointer", whiteSpace: "nowrap", fontFamily: "Nunito, sans-serif",
                  flexShrink: 0, transition: "all 0.15s",
                  background: tab === key ? "#1a7a5e" : "var(--white)",
                  color: tab === key ? "white" : "#555555",
                  border: tab === key ? "none" : "1px solid #e0e0e0",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Aisle feed */}
        <div style={{ padding: "16px 16px 0" }}>
          {loading ? (
            <div className="loading" style={{ marginTop: 60 }}><div className="spinner" /></div>
          ) : tab === "nearby" && !activeCity ? (
            <div className="empty" style={{ marginTop: 40 }}>
              <div className="empty-icon">📍</div>
              <div className="empty-title">Set your location</div>
              <div style={{ marginBottom: 20, fontSize: 13, color: "var(--mid)" }}>See items from mothers in your area.</div>
              <button className="btn-primary" style={{ width: "auto", padding: "10px 24px" }} onClick={() => setShowLocationSheet(true)}>
                Set location
              </button>
            </div>
          ) : tabFiltered.length === 0 ? (
            <div className="empty" style={{ marginTop: 40 }}>
              <div className="empty-icon">📋</div>
              <div className="empty-title">
                {tab === "nearby" && activeCity ? `No items in ${activeCity} yet.` : TAB_EMPTY[tab]}
              </div>
              {tab === "all" && user && user.journeyType !== "donor" && (
                <button className="btn-primary" style={{ width: "auto", padding: "10px 24px", marginTop: 16 }} onClick={() => router.push("/registers/new")}>
                  + Create Register
                </button>
              )}
            </div>
          ) : (
            tabFiltered.map((item) => {
              const reg        = item.register;
              const firstName  = reg.creator.name.split(" ")[0];
              const isVerified = (reg.creator.verificationLevel ?? 0) >= 2;
              const isSaved    = savedState[item.id] ?? false;
              const dueLabel   = formatDueDate(reg.dueDate);
              const qty        = parseInt(item.quantity, 10);
              const showQty    = !isNaN(qty) && qty > 1;

              // Build the "for …" byline
              const parts = [firstName];
              if (reg.creator.circleContext) parts.push(reg.creator.circleContext);
              parts.push(dueLabel);
              const byline = `for ${parts.join(" · ")}`;

              return (
                <div
                  key={`${reg.id}-${item.id}`}
                  onClick={() => {
                    // TODO: deep-link to dedicated per-item donation/checkout
                    router.push(`/registers/${reg.id}?item=${item.id}`);
                  }}
                  style={{
                    position: "relative",
                    background: "#faf8f3", borderRadius: 16, padding: "18px 16px 14px",
                    marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                    border: "1px solid #ede8df", cursor: "pointer", transition: "box-shadow 0.2s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.07)"; }}
                >
                  {/* Bookmark save button */}
                  <button
                    onClick={(e) => handleToggleSave(e, item)}
                    aria-label={isSaved ? "Unsave item" : "Save item"}
                    style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", padding: 4, zIndex: 1, lineHeight: 0 }}
                  >
                    <Bookmark size={20} strokeWidth={1.75} color="#1a7a5e" fill={isSaved ? "#1a7a5e" : "none"} />
                  </button>

                  {/* "for [name] · context · stage" */}
                  <div style={{ fontSize: 11, color: "#8a8a8a", fontFamily: "Nunito, sans-serif", marginBottom: 6, paddingRight: 32, lineHeight: 1.4 }}>
                    {byline}
                  </div>

                  {/* Item name — the headline */}
                  <div style={{ fontFamily: "Lora, serif", fontSize: 19, fontWeight: 700, color: "#1a1a1a", marginBottom: 8, lineHeight: 1.3, paddingRight: 32 }}>
                    {item.name}
                    {showQty && (
                      <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 600, color: "#6b7a70", marginLeft: 6 }}>
                        × {qty}
                      </span>
                    )}
                  </div>

                  {/* Metadata: price · verified */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    {item.standardPriceCents > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#7a5a2a", fontFamily: "Nunito, sans-serif" }}>
                        {fmtMoney(item.standardPriceCents)}
                      </span>
                    )}
                    {isVerified && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "#1a7a5e" }}>
                        <BadgeCheck size={11} strokeWidth={1.75} /> Verified
                      </span>
                    )}
                  </div>

                  {/* View full register link */}
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/registers/${reg.id}`); }}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", fontWeight: 600 }}
                  >
                    View full register →
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* How it works + Trust & Safety + Closing strip */}
        {!loading && tabFiltered.length > 0 && (
          <>
            <div style={{ padding: "0 16px" }}><HowKradelWorks /></div>
            <TrustAndSafety />
            <div style={{ margin: "24px 16px 100px", padding: "16px", background: "#e8f5f1", borderRadius: 12, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Heart size={16} color="#1a7a5e" strokeWidth={1.75} />
                <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 600, color: "#1a7a5e" }}>Every contribution makes a real difference.</span>
              </div>
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: "#555555" }}>Thank you for helping mothers feel supported, not alone.</span>
            </div>
          </>
        )}

        {(loading || tabFiltered.length === 0) && <div style={{ height: 100 }} />}
      </div>

      <BottomNav />
      <Toast message={toast} onClose={() => setToast(null)} />
      {showLocationSheet && (
        <LocationSelector
          currentCity={activeCity}
          setByGPS={activeSetByGPS}
          radius={activeRadius}
          onSelect={(city, radius, byGPS) => {
            handleLocationSelect(city, radius, byGPS);
            setShowLocationSheet(false);
          }}
          onClose={() => setShowLocationSheet(false)}
        />
      )}
    </div>
  );
}
