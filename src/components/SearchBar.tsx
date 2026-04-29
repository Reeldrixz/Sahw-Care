"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, Gift, ClipboardList, Package } from "lucide-react";

const SUGGESTIONS = ["Diapers", "Formula", "Lagos", "Toronto", "Newborn bundle", "Feeding kit", "Maternity"];

const CAT_BG: Record<string, string> = {
  "Feeding": "#e8f5f1", "Diapering": "#fff8ed", "Maternity": "#f5f3ff",
  "Clothing": "#eff6ff", "Hygiene": "#f0fdf4", "Other": "#f5f5f5",
};

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(${escaped})`, "gi"), "<strong>$1</strong>");
}

interface SearchResults {
  items: Array<{ id: string; title: string; category: string; location: string }>;
  bundles: Array<{ id: string; name: string; targetStage: string | null }>;
  registers: Array<{ id: string; title: string; city: string }>;
  total: number;
  query: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function SearchBar({ value, onChange }: Props) {
  const router = useRouter();
  const [focused, setFocused] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (value.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(value)}`, { signal: ctrl.signal });
        if (r.ok) setResults(await r.json());
      } catch { /* aborted */ }
      finally { setSearching(false); }
    }, 300);
    return () => { clearTimeout(t); };
  }, [value]);

  useEffect(() => {
    if (!focused) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [focused]);

  const goToResults = useCallback(() => {
    if (!value.trim()) return;
    setFocused(false);
    router.push(`/search?q=${encodeURIComponent(value.trim())}`);
  }, [value, router]);

  const showDropdown = focused;
  const hasResults = results && results.total > 0;
  const showEmpty = focused && value.length >= 2 && !searching && results && !hasResults;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Input */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "9px 12px", borderRadius: 12,
        border: `1.5px solid ${focused ? "#1a7a5e" : "#e5e7eb"}`,
        background: "white", transition: "border-color 0.15s",
      }}>
        {searching
          ? <Loader2 size={15} color="#1a7a5e" strokeWidth={2} style={{ flexShrink: 0, animation: "spin 0.8s linear infinite" }} />
          : <Search size={15} color={value ? "#1a7a5e" : "#9ca3af"} strokeWidth={2} style={{ flexShrink: 0 }} />
        }
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") goToResults();
            if (e.key === "Escape") setFocused(false);
          }}
          placeholder="Search for something a mother needs..."
          style={{ flex: 1, border: "none", outline: "none", fontSize: 13, fontFamily: "Nunito, sans-serif", background: "transparent", color: "#1a1a1a", minWidth: 0 }}
        />
        {value && (
          <button
            onClick={() => { onChange(""); setResults(null); }}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 2, flexShrink: 0 }}
          >
            <X size={14} color="#9ca3af" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.12)", zIndex: 49 }}
            onClick={() => setFocused(false)}
          />
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
            background: "white", borderRadius: 16, zIndex: 50,
            boxShadow: "0 8px 40px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb",
            maxHeight: "60vh", overflowY: "auto",
          }}>

            {/* Suggestions — shown when input is empty */}
            {value.length === 0 && (
              <div style={{ padding: "14px 16px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", fontFamily: "Nunito, sans-serif", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Popular searches
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => onChange(s)}
                      style={{
                        padding: "6px 14px", borderRadius: 20, border: "1.5px solid #e5e7eb",
                        background: "#f9fafb", fontSize: 12, fontWeight: 700, color: "#555555",
                        cursor: "pointer", fontFamily: "Nunito, sans-serif",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Searching spinner (no results yet) */}
            {value.length >= 2 && searching && !results && (
              <div style={{ padding: "28px", textAlign: "center" }}>
                <Loader2 size={22} color="#1a7a5e" strokeWidth={2} style={{ animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
              </div>
            )}

            {/* Empty state */}
            {showEmpty && (
              <div style={{ padding: "28px 20px", textAlign: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <Search size={22} color="#1a7a5e" />
                </div>
                <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 14, color: "#1a1a1a", marginBottom: 6 }}>
                  Nothing found for &ldquo;{value}&rdquo;
                </div>
                <div style={{ fontSize: 12, color: "#555555", fontFamily: "Nunito, sans-serif" }}>
                  Try a different word or browse by category.
                </div>
              </div>
            )}

            {/* Results */}
            {hasResults && (
              <>
                {/* Items */}
                {results.items.length > 0 && (
                  <div>
                    <div style={{ padding: "12px 16px 4px", fontSize: 11, fontWeight: 700, color: "#9ca3af", fontFamily: "Nunito, sans-serif", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Items
                    </div>
                    {results.items.slice(0, 5).map(item => (
                      <button
                        key={item.id}
                        onClick={() => { setFocused(false); router.push(`/items/${item.id}`); }}
                        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "9px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: CAT_BG[item.category] ?? "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Package size={15} color="#555555" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            dangerouslySetInnerHTML={{ __html: highlight(item.title, value) }}
                          />
                          <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "Nunito, sans-serif" }}>{item.location}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {results.items.length > 0 && results.bundles.length > 0 && (
                  <div style={{ height: 1, background: "#f3f4f6", margin: "4px 0" }} />
                )}

                {/* Bundles */}
                {results.bundles.length > 0 && (
                  <div>
                    <div style={{ padding: "12px 16px 4px", fontSize: 11, fontWeight: 700, color: "#9ca3af", fontFamily: "Nunito, sans-serif", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Bundles
                    </div>
                    {results.bundles.slice(0, 3).map(bundle => (
                      <button
                        key={bundle.id}
                        onClick={() => { setFocused(false); router.push("/bundles"); }}
                        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "9px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Gift size={15} color="#1a7a5e" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {bundle.name}
                          </div>
                          {bundle.targetStage && (
                            <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "Nunito, sans-serif" }}>{bundle.targetStage}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {(results.items.length > 0 || results.bundles.length > 0) && results.registers.length > 0 && (
                  <div style={{ height: 1, background: "#f3f4f6", margin: "4px 0" }} />
                )}

                {/* Registers */}
                {results.registers.length > 0 && (
                  <div>
                    <div style={{ padding: "12px 16px 4px", fontSize: 11, fontWeight: 700, color: "#9ca3af", fontFamily: "Nunito, sans-serif", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      Registers
                    </div>
                    {results.registers.slice(0, 3).map(reg => (
                      <button
                        key={reg.id}
                        onClick={() => { setFocused(false); router.push(`/registers/${reg.id}`); }}
                        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "9px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <ClipboardList size={15} color="#1565c0" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", fontFamily: "Nunito, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {reg.title}
                          </div>
                          <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "Nunito, sans-serif" }}>{reg.city}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <button
                  onClick={goToResults}
                  style={{
                    display: "block", width: "100%", padding: "12px 16px",
                    background: "none", border: "none",
                    borderTop: "1px solid #f3f4f6",
                    fontSize: 13, fontWeight: 700, color: "#1a7a5e",
                    cursor: "pointer", fontFamily: "Nunito, sans-serif", textAlign: "center",
                  }}
                >
                  See all results for &ldquo;{value}&rdquo; →
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
