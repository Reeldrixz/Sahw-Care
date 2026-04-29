"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, ArrowLeft, Package, Gift, ClipboardList, Milk, Baby, Heart, Shirt, Sparkles, Stethoscope, Luggage, type LucideIcon } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import SearchBar from "@/components/SearchBar";
import { useAuth } from "@/contexts/AuthContext";

type FilterType = "all" | "items" | "bundles" | "registers";

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: "all",       label: "All"       },
  { key: "items",     label: "Items"     },
  { key: "bundles",   label: "Bundles"   },
  { key: "registers", label: "Registers" },
];

const CAT_BG: Record<string, string> = {
  "Feeding": "#e8f5f1", "Diapering": "#fff8ed", "Maternity": "#f5f3ff",
  "Clothing": "#eff6ff", "Hygiene": "#f0fdf4", "Recovery": "#fdf2f8",
  "Travel": "#f0f9ff", "Other": "#f5f5f5",
};
const CAT_ICONS: Record<string, LucideIcon> = {
  "Feeding": Milk, "Diapering": Baby, "Maternity": Heart,
  "Clothing": Shirt, "Hygiene": Sparkles, "Recovery": Stethoscope,
  "Travel": Luggage, "Other": Package,
};

interface SearchItem {
  id: string; title: string; category: string; condition: string;
  quantity: string; location: string; images: string[]; createdAt: string;
  donor: { id: string; name: string; avatar: string | null; verificationLevel?: number };
}
interface SearchBundle {
  id: string; name: string; description: string; targetStage: string | null; estimatedCost: number;
}
interface SearchRegister {
  id: string; title: string; city: string; dueDate: string;
  creator: { name: string; verificationLevel: number };
}
interface SearchResults {
  items: SearchItem[];
  bundles: SearchBundle[];
  registers: SearchRegister[];
  total: number;
  query: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div style={{ padding: "16px 16px 8px", fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>
      {title} <span style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", fontFamily: "Nunito, sans-serif" }}>({count})</span>
    </div>
  );
}

function ItemRow({ item, onClick }: { item: SearchItem; onClick: () => void }) {
  const CatIcon = CAT_ICONS[item.category] ?? Package;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        width: "100%", padding: "12px 16px",
        borderBottom: "1px solid #f3f4f6", background: "white",
        border: "none", cursor: "pointer", textAlign: "left",
      }}
    >
      <div style={{
        width: 46, height: 46, borderRadius: 12, flexShrink: 0,
        background: CAT_BG[item.category] ?? "#f5f5f5",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {item.images?.[0]
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={item.images[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
          : <CatIcon size={20} color="#555555" strokeWidth={1.5} />
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.title}
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "Nunito, sans-serif" }}>
          {item.location} · {item.condition} · {timeAgo(item.createdAt)}
        </div>
      </div>
      {(item.donor.verificationLevel ?? 0) >= 1 && (
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "#e8f5f1", color: "#1a7a5e", flexShrink: 0, fontFamily: "Nunito, sans-serif" }}>✓</span>
      )}
    </button>
  );
}

function BundleRow({ bundle, onClick }: { bundle: SearchBundle; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        width: "100%", padding: "12px 16px",
        borderBottom: "1px solid #f3f4f6", background: "white",
        border: "none", cursor: "pointer", textAlign: "left",
      }}
    >
      <div style={{ width: 46, height: 46, borderRadius: 12, background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Gift size={22} color="#1a7a5e" strokeWidth={1.5} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {bundle.name}
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "Nunito, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {bundle.description}
          {bundle.targetStage ? ` · ${bundle.targetStage}` : ""}
        </div>
      </div>
    </button>
  );
}

function RegisterRow({ reg, onClick }: { reg: SearchRegister; onClick: () => void }) {
  const isVerified = reg.creator.verificationLevel >= 1;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        width: "100%", padding: "12px 16px",
        borderBottom: "1px solid #f3f4f6", background: "white",
        border: "none", cursor: "pointer", textAlign: "left",
      }}
    >
      <div style={{ width: 46, height: 46, borderRadius: 12, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <ClipboardList size={22} color="#1565c0" strokeWidth={1.5} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {reg.title}
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "Nunito, sans-serif" }}>
          {reg.city} · by {isVerified ? "✓ " : ""}{reg.creator.name}
        </div>
      </div>
    </button>
  );
}

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const initialQ = searchParams.get("q") ?? "";
  const initialType = (searchParams.get("type") ?? "all") as FilterType;

  const [query, setQuery] = useState(initialQ);
  const [filter, setFilter] = useState<FilterType>(initialType);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async (q: string, t: FilterType) => {
    if (q.length < 2) { setResults(null); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=${t}`);
      if (r.ok) setResults(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync URL → local state on navigation (e.g. from dropdown "See all")
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    const t = (searchParams.get("type") ?? "all") as FilterType;
    setQuery(q);
    setFilter(t);
    doSearch(q, t);
  }, [searchParams, doSearch]);

  // Re-fetch when filter tab changes
  const handleFilter = (t: FilterType) => {
    setFilter(t);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("type", t);
    router.replace(`/search?${params}`);
  };

  // Re-fetch when search bar query changes
  const handleQueryChange = (q: string) => {
    setQuery(q);
    if (q.length >= 2) {
      const t = setTimeout(() => {
        const params = new URLSearchParams();
        params.set("q", q);
        if (filter !== "all") params.set("type", filter);
        router.replace(`/search?${params}`);
      }, 300);
      return () => clearTimeout(t);
    }
  };

  const showItems     = filter === "all" || filter === "items";
  const showBundles   = filter === "all" || filter === "bundles";
  const showRegisters = filter === "all" || filter === "registers";

  const items     = results?.items     ?? [];
  const bundles   = results?.bundles   ?? [];
  const registers = results?.registers ?? [];

  const visibleItems     = showItems     ? items     : [];
  const visibleBundles   = showBundles   ? bundles   : [];
  const visibleRegisters = showRegisters ? registers : [];
  const visibleTotal     = visibleItems.length + visibleBundles.length + visibleRegisters.length;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">

        {/* Sticky header */}
        <div style={{ background: "white", borderBottom: "1px solid #f3f4f6", position: "sticky", top: 0, zIndex: 10 }}>
          {/* Top row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px 10px" }}>
            <button
              onClick={() => router.back()}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4, flexShrink: 0 }}
            >
              <ArrowLeft size={20} color="#1a1a1a" />
            </button>
            <div style={{ flex: 1 }}>
              <SearchBar value={query} onChange={handleQueryChange} />
            </div>
          </div>

          {/* Result count */}
          {query.length >= 2 && !loading && results && (
            <div style={{ padding: "0 16px 8px", fontSize: 12, color: "#9ca3af", fontFamily: "Nunito, sans-serif" }}>
              {visibleTotal} result{visibleTotal !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 0, overflowX: "auto", scrollbarWidth: "none", borderTop: "1px solid #f3f4f6" }}>
            {FILTER_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleFilter(key)}
                style={{
                  padding: "8px 16px", background: "none", border: "none",
                  borderBottom: `2px solid ${filter === key ? "#1a7a5e" : "transparent"}`,
                  fontSize: 13, fontWeight: 700,
                  color: filter === key ? "#1a7a5e" : "#555555",
                  cursor: "pointer", whiteSpace: "nowrap",
                  fontFamily: "Nunito, sans-serif", transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ paddingBottom: 100 }}>
          {loading && (
            <div className="loading" style={{ paddingTop: 60 }}><div className="spinner" /></div>
          )}

          {!loading && query.length < 2 && (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Search size={26} color="#1a7a5e" strokeWidth={1.5} />
              </div>
              <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, marginBottom: 8, color: "#1a1a1a" }}>
                Start typing to search
              </div>
              <div style={{ fontSize: 13, color: "#555555", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
                Search for items, bundles, or registers
              </div>
            </div>
          )}

          {!loading && query.length >= 2 && visibleTotal === 0 && results && (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Search size={26} color="#1a7a5e" strokeWidth={1.5} />
              </div>
              <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, marginBottom: 8, color: "#1a1a1a" }}>
                Nothing found for &ldquo;{query}&rdquo;
              </div>
              <div style={{ fontSize: 13, color: "#555555", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, marginBottom: 24 }}>
                Try searching for: diapers, formula, Lagos, feeding kit
              </div>
              <button
                onClick={() => router.push("/")}
                style={{
                  padding: "11px 28px", borderRadius: 12,
                  border: "1.5px solid #1a7a5e", background: "white",
                  fontSize: 13, fontWeight: 700, color: "#1a7a5e",
                  cursor: "pointer", fontFamily: "Nunito, sans-serif",
                }}
              >
                Browse all items
              </button>
            </div>
          )}

          {!loading && visibleTotal > 0 && (
            <div style={{ background: "white" }}>
              {/* Items */}
              {visibleItems.length > 0 && (
                <>
                  <SectionHeader title="Items" count={visibleItems.length} />
                  {visibleItems.map(item => (
                    <ItemRow key={item.id} item={item} onClick={() => router.push(`/items/${item.id}`)} />
                  ))}
                </>
              )}

              {/* Bundles */}
              {visibleBundles.length > 0 && (
                <>
                  {visibleItems.length > 0 && <div style={{ height: 8, background: "var(--bg)" }} />}
                  <SectionHeader title="Bundles" count={visibleBundles.length} />
                  {visibleBundles.map(bundle => (
                    <BundleRow key={bundle.id} bundle={bundle} onClick={() => router.push("/bundles")} />
                  ))}
                </>
              )}

              {/* Registers */}
              {visibleRegisters.length > 0 && (
                <>
                  {(visibleItems.length > 0 || visibleBundles.length > 0) && <div style={{ height: 8, background: "var(--bg)" }} />}
                  <SectionHeader title="Registers" count={visibleRegisters.length} />
                  {visibleRegisters.map(reg => (
                    <RegisterRow key={reg.id} reg={reg} onClick={() => router.push(`/registers/${reg.id}`)} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>}>
      <SearchPageInner />
    </Suspense>
  );
}
