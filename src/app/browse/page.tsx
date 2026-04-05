"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import ListCard, { ItemData } from "@/components/ListCard";
import FilterSheet from "@/components/FilterSheet";
import Toast from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";

const CATS = ["All", "Baby Milk", "Diapers", "Maternity", "Clothing", "Accessories"];
const CONDITIONS = ["New", "Slightly used", "Well used"];

export default function BrowsePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ItemData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("All");
  const [condition, setCondition] = useState("");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [showFilter, setShowFilter] = useState(false);
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [favs, setFavs] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (cat !== "All") params.set("category", cat);
    if (search) params.set("search", search);
    const res = await fetch(`/api/items?${params}`);
    if (res.ok) {
      const data = await res.json();
      let result: ItemData[] = data.items ?? [];
      if (condition) result = result.filter((i) => i.condition === condition);
      setItems(result);
      setTotal(data.total ?? result.length);
    }
    setLoading(false);
  }, [cat, search, condition]);

  useEffect(() => {
    const t = setTimeout(fetchItems, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchItems, search]);

  const handleRequest = async (item: ItemData) => {
    if (!user) { router.push("/auth"); return; }
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id }),
    });
    if (res.ok) {
      setRequested((r) => ({ ...r, [item.id]: true }));
      setToast("Requested! 🎉");
    } else {
      const d = await res.json();
      setToast(d.error ?? "Something went wrong");
    }
  };

  const itemGrid = (
    <>
      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🔍</div>
          <div className="empty-title">No items found</div>
          <div>Try a different category or search term</div>
        </div>
      ) : (
        <div className="browse-main-grid">
          {items.map((item) => (
            <ListCard
              key={item.id}
              item={item}
              requested={requested[item.id]}
              favourited={favs[item.id]}
              onRequest={(e) => { e.stopPropagation(); handleRequest(item); }}
              onFavourite={() => setFavs((f) => ({ ...f, [item.id]: !f[item.id] }))}
              onClick={() => router.push(`/items/${item.id}`)}
            />
          ))}
        </div>
      )}
    </>
  );

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>

      {/* ---- MOBILE LAYOUT ---- */}
      <div className="browse-mobile">
        <div className="browse-header">
          <div className="browse-title">Browse</div>
          <div className="view-toggle">
            <button className={`view-btn ${viewMode === "list" ? "active" : ""}`} onClick={() => setViewMode("list")}>List</button>
            <button className={`view-btn ${viewMode === "map" ? "active" : ""}`} onClick={() => setViewMode("map")}>Map</button>
          </div>
          <button className="filter-btn" style={{ marginLeft: 8 }} onClick={() => setShowFilter(true)}>⚙️</button>
        </div>
        <div style={{ background: "var(--white)" }}>
          <div className="search-wrap" style={{ paddingTop: 12 }}>
            <div className="search-row">
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="cats">
            {CATS.map((c) => (
              <button key={c} className={`cat-chip ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
          <div className="sort-row">Sort by: <span className="sort-val">Nearest ▾</span> &nbsp;·&nbsp; {total} items</div>
        </div>
        <div className="scroll" style={{ height: "calc(100vh - 210px)" }}>
          {viewMode === "map" ? (
            <div className="empty"><div className="empty-icon">🗺️</div><div className="empty-title">Map view</div><div>Connect Google Maps API to enable this</div></div>
          ) : (
            <div style={{ padding: "12px 16px 20px" }}>{itemGrid}</div>
          )}
        </div>
      </div>

      {/* ---- DESKTOP LAYOUT ---- */}
      <div className="browse-desktop">
        <div className="browse-desktop-header">
          <div className="browse-desktop-title">Browse Items</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div className="search-box" style={{ width: 280 }}>
              <span className="search-icon">🔍</span>
              <input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="view-toggle">
              <button className={`view-btn ${viewMode === "list" ? "active" : ""}`} onClick={() => setViewMode("list")}>List</button>
              <button className={`view-btn ${viewMode === "map" ? "active" : ""}`} onClick={() => setViewMode("map")}>Map</button>
            </div>
          </div>
        </div>

        <div className="browse-desktop-layout">
          {/* Sidebar filters */}
          <aside className="browse-sidebar">
            <div className="browse-sidebar-title">Filters</div>

            <div className="browse-sidebar-group">
              <div className="browse-sidebar-group-label">Category</div>
              <div className="browse-sidebar-chips">
                {CATS.map((c) => (
                  <button key={c} className={`browse-sidebar-chip ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>{c}</button>
                ))}
              </div>
            </div>

            <div className="browse-sidebar-group">
              <div className="browse-sidebar-group-label">Condition</div>
              <div className="browse-sidebar-chips">
                <button className={`browse-sidebar-chip ${condition === "" ? "active" : ""}`} onClick={() => setCondition("")}>Any</button>
                {CONDITIONS.map((c) => (
                  <button key={c} className={`browse-sidebar-chip ${condition === c ? "active" : ""}`} onClick={() => setCondition(c)}>{c}</button>
                ))}
              </div>
            </div>

            <div style={{ fontSize: 12, color: "var(--mid)", fontWeight: 600, marginTop: 8 }}>{total} items found</div>
          </aside>

          {/* Main content */}
          <main>
            {viewMode === "map" ? (
              <div className="empty"><div className="empty-icon">🗺️</div><div className="empty-title">Map view</div><div>Connect Google Maps API to enable this</div></div>
            ) : itemGrid}
          </main>
        </div>
      </div>

      <BottomNav />
      {showFilter && (
        <FilterSheet
          category={cat} condition={condition}
          onCategoryChange={setCat} onConditionChange={setCondition}
          onApply={() => setShowFilter(false)}
          onClear={() => { setCat("All"); setCondition(""); setShowFilter(false); }}
          onClose={() => setShowFilter(false)}
        />
      )}
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
