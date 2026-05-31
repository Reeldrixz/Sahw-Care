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


interface RegisterListItem {
  id: string;
  name: string;
  status: string;
  fundingStatus: string;
  standardPriceCents: number;
  totalFundedCents: number;
  _count: { funding: number };
  catalogItem: { imageUrl: string | null } | null;
}

interface RegisterData {
  id: string;
  title: string;
  city: string;
  dueDate: string;
  createdAt: string;
  savedByMe: boolean;
  creator: { id: string; name: string; location: string | null; verificationLevel: number; circleContext: string | null };
  items: RegisterListItem[];
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

const TABS: { key: TabKey; label: string }[] = [
  { key: "all",      label: "All"      },
  { key: "nearby",   label: "Nearby"   },
  { key: "due-soon", label: "Due Soon" },
  { key: "verified", label: "Verified" },
];

const TAB_EMPTY: Record<TabKey, string> = {
  "all":      "No registers yet — be the first to create one.",
  "nearby":   "No registers in this city yet.",
  "due-soon": "No registers due in the next 6 weeks.",
  "verified": "No verified registers yet.",
};

export default function RegistersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { activeCity, activeRadius, activeSetByGPS, handleLocationSelect } = useUserLocation();

  const [registers, setRegisters]           = useState<RegisterData[]>([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState("");
  const [tab, setTab]                       = useState<TabKey>("all");
  const [savedState, setSavedState]         = useState<Record<string, boolean>>({});
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [toast, setToast]                   = useState<string | null>(null);

  const savedCount = Object.values(savedState).filter(Boolean).length;

  const fetchRegisters = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/registers");
    if (res.ok) {
      const data = await res.json();
      const regs: RegisterData[] = data.registers ?? [];
      setRegisters(regs);
      const init: Record<string, boolean> = {};
      for (const r of regs) { init[r.id] = r.savedByMe ?? false; }
      setSavedState(init);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRegisters(); }, [fetchRegisters]);

  const handleToggleSave = async (e: React.MouseEvent, registerId: string) => {
    e.stopPropagation();
    if (!user) { router.push("/auth"); return; }
    const prev = savedState[registerId] ?? false;
    setSavedState((s) => ({ ...s, [registerId]: !prev }));
    const res = await fetch(`/api/registers/${registerId}/save`, { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      setSavedState((s) => ({ ...s, [registerId]: d.saved }));
    } else {
      setSavedState((s) => ({ ...s, [registerId]: prev }));
      setToast("Failed to save register");
    }
  };

  const filtered = registers.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.city.toLowerCase().includes(search.toLowerCase()) ||
      r.creator.name.toLowerCase().includes(search.toLowerCase())
  );

  const tabFiltered = filtered.filter((r) => {
    if (tab === "all") return true;
    if (tab === "nearby") {
      if (!activeCity) return false;
      return r.city.toLowerCase() === activeCity.toLowerCase();
    }
    if (tab === "due-soon") {
      const diffDays = Math.round((new Date(r.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return diffDays <= 42;
    }
    if (tab === "verified") {
      return (r.creator?.verificationLevel ?? 0) >= 2;
    }
    return true;
  });

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
                placeholder="Search by name or city..."
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

        {/* List */}
        <div style={{ padding: "16px 16px 0" }}>
          {loading ? (
            <div className="loading" style={{ marginTop: 60 }}><div className="spinner" /></div>
          ) : tab === "nearby" && !activeCity ? (
            <div className="empty" style={{ marginTop: 40 }}>
              <div className="empty-icon">📍</div>
              <div className="empty-title">Set your location</div>
              <div style={{ marginBottom: 20, fontSize: 13, color: "var(--mid)" }}>See registers in your area.</div>
              <button
                className="btn-primary"
                style={{ width: "auto", padding: "10px 24px" }}
                onClick={() => setShowLocationSheet(true)}
              >
                Set location
              </button>
            </div>
          ) : tabFiltered.length === 0 ? (
            <div className="empty" style={{ marginTop: 40 }}>
              <div className="empty-icon">📋</div>
              <div className="empty-title">
                {tab === "nearby" && activeCity
                  ? `No registers in ${activeCity} yet.`
                  : TAB_EMPTY[tab]}
              </div>
              {tab === "all" && user && user.journeyType !== "donor" && (
                <button className="btn-primary" style={{ width: "auto", padding: "10px 24px", marginTop: 16 }} onClick={() => router.push("/registers/new")}>
                  + Create Register
                </button>
              )}
            </div>
          ) : (
            tabFiltered.map((reg) => {
              const firstName   = reg.creator.name.split(" ")[0];
              const isVerified  = (reg.creator.verificationLevel ?? 0) >= 2;
              const isSaved     = savedState[reg.id] ?? false;
              const dueLabel    = formatDueDate(reg.dueDate);

              const neededItems  = reg.items.filter(
                (i) => i.fundingStatus !== "FULFILLED" && i.status !== "CANCELLED" && i.status !== "PENDING_APPROVAL"
              );
              const displayItems = neededItems.length > 0 ? neededItems : reg.items;
              const previewNames = displayItems.slice(0, 3).map((i) => i.name);
              const extraCount   = Math.max(0, displayItems.length - 3);

              return (
                <div
                  key={reg.id}
                  onClick={() => {
                    // TODO: navigate to item-level donation flow when built
                    router.push(`/registers/${reg.id}`);
                  }}
                  style={{
                    position: "relative",
                    background: "#faf8f3", borderRadius: 16, padding: "18px 16px 16px",
                    marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                    border: "1px solid #ede8df", cursor: "pointer", transition: "box-shadow 0.2s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.07)"; }}
                >
                  {/* Bookmark save button */}
                  <button
                    onClick={(e) => handleToggleSave(e, reg.id)}
                    aria-label={isSaved ? "Unsave register" : "Save register"}
                    style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", padding: 4, zIndex: 1, lineHeight: 0 }}
                  >
                    <Bookmark size={20} strokeWidth={1.75} color="#1a7a5e" fill={isSaved ? "#1a7a5e" : "none"} />
                  </button>

                  {/* Mom's first name */}
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/registers/${reg.id}`); }}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", display: "block", fontFamily: "Lora, serif", fontSize: 19, fontWeight: 700, color: "#1a7a5e", marginBottom: 3, paddingRight: 32, lineHeight: 1.3 }}
                  >
                    {firstName}
                  </button>

                  {/* Optional identity label */}
                  {reg.creator.circleContext && (
                    <div style={{ fontSize: 12, color: "#6b7a70", fontFamily: "Nunito, sans-serif", marginBottom: 8, lineHeight: 1.4 }}>
                      {reg.creator.circleContext}
                    </div>
                  )}

                  {/* Item names — inline plain text, dot-separated */}
                  {previewNames.length > 0 && (
                    <div style={{ fontSize: 12, color: "#555555", fontFamily: "Nunito, sans-serif", marginBottom: 10, lineHeight: 1.5 }}>
                      {previewNames.join(" · ")}
                      {extraCount > 0 && <span style={{ color: "#8a8a8a" }}> +{extraCount} more</span>}
                    </div>
                  )}

                  {/* Due date + verified badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#7a5a2a", fontFamily: "Nunito, sans-serif" }}>{dueLabel}</span>
                    {isVerified && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "#1a7a5e" }}>
                        <BadgeCheck size={11} strokeWidth={1.75} /> Verified
                      </span>
                    )}
                  </div>
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
