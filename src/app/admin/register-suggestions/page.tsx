"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface SuggestionGroup {
  id: string;
  itemName: string;
  category: string;
  notes: string | null;
  status: string;
  createdAt: string;
  suggestedByCount: number;
  similarSuggestions: { id: string; notes: string | null; createdAt: string }[];
}

type FilterTab = "pending" | "promoted" | "declined" | "all";

const CAT_COLORS: Record<string, string> = {
  postpartum: "#9d174d",
  newborn:    "#1e50a2",
  pregnancy:  "#1a7a5e",
  labour:     "#b45309",
};

export default function RegisterSuggestionsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [filter,       setFilter]       = useState<FilterTab>("pending");
  const [suggestions,  setSuggestions]  = useState<SuggestionGroup[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [expanded,     setExpanded]     = useState<string | null>(null);
  const [promotingId,  setPromotingId]  = useState<string | null>(null);
  const [promoteForm,  setPromoteForm]  = useState({ sku: "", name: "", category: "", standardPriceCents: "", description: "" });
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [toast,        setToast]        = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "ADMIN")) router.push("/");
  }, [user, authLoading, router]);

  const fetchSuggestions = useCallback(async (tab: FilterTab) => {
    setLoading(true);
    const r = await fetch(`/api/admin/register/suggestions?status=${tab}`);
    if (r.ok) {
      const d = await r.json();
      setSuggestions(d.suggestions ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user?.role === "ADMIN") fetchSuggestions(filter);
  }, [filter, user, fetchSuggestions]);

  const act = useCallback(async (id: string, action: string, skuData?: object) => {
    const r = await fetch(`/api/admin/register/suggestions/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action, skuData }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return d.error ?? "Action failed";
    return null;
  }, []);

  const handleDecline   = async (id: string) => { await act(id, "decline");   fetchSuggestions(filter); setToast("Declined"); };
  const handleDuplicate = async (id: string) => { await act(id, "duplicate"); fetchSuggestions(filter); setToast("Marked as duplicate"); };

  const handlePromote = async (id: string) => {
    setPromoteError(null);
    const err = await act(id, "promote", promoteForm);
    if (err) { setPromoteError(err); return; }
    setPromotingId(null);
    fetchSuggestions(filter);
    setToast("Promoted to catalogue");
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  if (authLoading || !user) {
    return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      {/* Header */}
      <div className="browse-header">
        <button
          onClick={() => router.push("/admin")}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--mid)", fontFamily: "Nunito, sans-serif", padding: "0 16px 0 0" }}
        >
          ← Admin
        </button>
        <div className="browse-title">Register Suggestions</div>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "24px 16px" }}>
        <p style={{ fontSize: 13, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 24 }}>
          Items mothers would like added to the catalogue. Groups identical names so you can see demand at a glance.
        </p>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
          {(["pending", "promoted", "declined", "all"] as const).map((tab) => (
            <button key={tab} onClick={() => setFilter(tab)} style={{
              padding: "8px 18px", background: "none", border: "none",
              borderBottom: `2px solid ${filter === tab ? "var(--green)" : "transparent"}`,
              fontSize: 13, fontWeight: 700,
              color: filter === tab ? "var(--green)" : "var(--mid)",
              cursor: "pointer", fontFamily: "Nunito, sans-serif", textTransform: "capitalize",
            }}>
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : suggestions.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center", fontSize: 14, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
            No {filter} suggestions.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {suggestions.map((s) => {
              const isExpanded  = expanded === s.id;
              const isPromoting = promotingId === s.id;
              const catColor    = CAT_COLORS[s.category] ?? "var(--mid)";

              return (
                <div key={s.id} style={{ background: "white", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
                  {/* Row */}
                  <div
                    style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                    onClick={() => setExpanded(isExpanded ? null : s.id)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 800, color: "var(--ink)", marginBottom: 3 }}>
                        {s.itemName}
                        {s.suggestedByCount > 1 && (
                          <span style={{ marginLeft: 8, fontSize: 11, background: "#e8f5f1", color: "var(--green)", fontWeight: 800, padding: "2px 8px", borderRadius: 20 }}>
                            {s.suggestedByCount} mothers
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: catColor, textTransform: "capitalize" }}>{s.category}</span>
                        {s.notes && <span style={{ fontSize: 11, color: "var(--mid)" }}>· {s.notes.slice(0, 60)}{s.notes.length > 60 ? "…" : ""}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                      {s.status === "pending" && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); setPromotingId(s.id); setPromoteError(null); setPromoteForm({ sku: "", name: s.itemName, category: s.category, standardPriceCents: "", description: "" }); }}
                            style={{ background: "#e8f5f1", color: "var(--green)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                          >
                            Promote to SKU
                          </button>
                          <button
                            onClick={async (e) => { e.stopPropagation(); await handleDecline(s.id); }}
                            style={{ background: "#fef2f2", color: "#c0392b", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                          >
                            Decline
                          </button>
                          <button
                            onClick={async (e) => { e.stopPropagation(); await handleDuplicate(s.id); }}
                            style={{ background: "#f3f4f6", color: "var(--mid)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                          >
                            Duplicate
                          </button>
                        </>
                      )}
                      {s.status !== "pending" && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: s.status === "promoted" ? "#e8f5f1" : "#f3f4f6", color: s.status === "promoted" ? "var(--green)" : "var(--mid)", textTransform: "capitalize" }}>
                          {s.status}
                        </span>
                      )}
                      <span style={{ fontSize: 13, color: "var(--mid)" }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Promote form */}
                  {isPromoting && s.status === "pending" && (
                    <div style={{ borderTop: "1px solid var(--border)", padding: "16px", background: "#f8faf9" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", fontFamily: "Nunito, sans-serif", marginBottom: 12 }}>Promote to catalogue SKU</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--mid)", marginBottom: 4, fontFamily: "Nunito, sans-serif" }}>SKU *</label>
                          <input style={{ width: "100%", padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "Nunito, sans-serif", boxSizing: "border-box" }} placeholder="e.g. F11" value={promoteForm.sku} onChange={(e) => setPromoteForm(p => ({ ...p, sku: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--mid)", marginBottom: 4, fontFamily: "Nunito, sans-serif" }}>Category *</label>
                          <input style={{ width: "100%", padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "Nunito, sans-serif", boxSizing: "border-box" }} value={promoteForm.category} onChange={(e) => setPromoteForm(p => ({ ...p, category: e.target.value }))} />
                        </div>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--mid)", marginBottom: 4, fontFamily: "Nunito, sans-serif" }}>Item name *</label>
                        <input style={{ width: "100%", padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "Nunito, sans-serif", boxSizing: "border-box" }} value={promoteForm.name} onChange={(e) => setPromoteForm(p => ({ ...p, name: e.target.value }))} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--mid)", marginBottom: 4, fontFamily: "Nunito, sans-serif" }}>Price (cents) *</label>
                          <input type="number" style={{ width: "100%", padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "Nunito, sans-serif", boxSizing: "border-box" }} placeholder="e.g. 1650" value={promoteForm.standardPriceCents} onChange={(e) => setPromoteForm(p => ({ ...p, standardPriceCents: e.target.value }))} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--mid)", marginBottom: 4, fontFamily: "Nunito, sans-serif" }}>Description (optional)</label>
                          <input style={{ width: "100%", padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "Nunito, sans-serif", boxSizing: "border-box" }} value={promoteForm.description} onChange={(e) => setPromoteForm(p => ({ ...p, description: e.target.value }))} />
                        </div>
                      </div>
                      {promoteError && <div style={{ fontSize: 12, color: "#c0392b", marginBottom: 8 }}>{promoteError}</div>}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => handlePromote(s.id)}
                          style={{ background: "var(--green)", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                        >
                          Create SKU
                        </button>
                        <button
                          onClick={() => setPromotingId(null)}
                          style={{ background: "var(--bg)", color: "var(--mid)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expanded individual submissions */}
                  {isExpanded && s.similarSuggestions.length > 0 && (
                    <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px", background: "var(--bg)" }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        All submissions ({s.similarSuggestions.length})
                      </div>
                      {s.similarSuggestions.map((sub, i) => (
                        <div key={sub.id} style={{ padding: "8px 0", borderBottom: i < s.similarSuggestions.length - 1 ? "1px solid var(--border)" : "none", fontSize: 12, fontFamily: "Nunito, sans-serif", color: "var(--mid)" }}>
                          <span style={{ color: "var(--ink)" }}>{sub.notes ?? <em>No notes</em>}</span>
                          <span style={{ marginLeft: 8, fontSize: 11 }}>· {new Date(sub.createdAt).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "var(--ink)", color: "white", padding: "10px 20px", borderRadius: 10, fontSize: 13, fontFamily: "Nunito, sans-serif", fontWeight: 700, zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
