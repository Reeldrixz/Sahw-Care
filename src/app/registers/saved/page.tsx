"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, ArrowLeft, Bookmark } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import Toast from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";

interface SavedItemData {
  id: string;
  name: string;
  quantity: string;
  status: string;
  fundingStatus: string;
  standardPriceCents: number;
  totalFundedCents: number;
  savedByMe: boolean;
  register: {
    id: string;
    city: string;
    dueDate: string;
    creator: { id: string; name: string; verificationLevel: number; circleContext: string | null };
  };
}

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

export default function SavedItemsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [items, setItems]   = useState<SavedItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]   = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth");
  }, [authLoading, user, router]);

  const fetchSaved = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/registers/saved");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && user) fetchSaved();
  }, [authLoading, user, fetchSaved]);

  const handleUnsave = async (e: React.MouseEvent, item: SavedItemData) => {
    e.stopPropagation();
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const res = await fetch(
      `/api/registers/${item.register.id}/items/${item.id}/save`,
      { method: "POST" }
    );
    if (!res.ok) {
      setToast("Failed to unsave item");
      fetchSaved();
    }
  };

  if (authLoading || (!authLoading && !user)) {
    return <div className="loading" style={{ marginTop: 80 }}><div className="spinner" /></div>;
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">

        {/* Header */}
        <div style={{ background: "var(--white)", padding: "16px 16px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <button
              onClick={() => router.back()}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 0", display: "flex", alignItems: "center", color: "#555555" }}
            >
              <ArrowLeft size={20} strokeWidth={1.75} />
            </button>
            <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700 }}>Saved Items</div>
          </div>
          <p style={{ fontSize: 13, color: "var(--mid)", margin: 0 }}>
            Items you&apos;ve saved to come back to.
          </p>
        </div>

        {/* List */}
        <div style={{ padding: "16px 16px 0" }}>
          {loading ? (
            <div className="loading" style={{ marginTop: 60 }}><div className="spinner" /></div>
          ) : items.length === 0 ? (
            <div className="empty" style={{ marginTop: 40 }}>
              <div className="empty-icon">🔖</div>
              <div className="empty-title">No saved items yet</div>
              <div style={{ marginBottom: 20, fontSize: 13, color: "var(--mid)" }}>
                Save an item from the aisle to see it here.
              </div>
              <button
                className="btn-primary"
                style={{ width: "auto", padding: "10px 24px" }}
                onClick={() => router.push("/registers")}
              >
                Browse Items
              </button>
            </div>
          ) : (
            items.map((item) => {
              const reg        = item.register;
              const firstName  = reg.creator.name.split(" ")[0];
              const isVerified = (reg.creator.verificationLevel ?? 0) >= 2;
              const dueLabel   = formatDueDate(reg.dueDate);
              const qty        = parseInt(item.quantity, 10);
              const showQty    = !isNaN(qty) && qty > 1;

              const parts = [firstName];
              if (reg.creator.circleContext) parts.push(reg.creator.circleContext);
              parts.push(dueLabel);
              const byline = `for ${parts.join(" · ")}`;

              return (
                <div
                  key={item.id}
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
                  {/* Unsave button — always filled */}
                  <button
                    onClick={(e) => handleUnsave(e, item)}
                    aria-label="Unsave item"
                    style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", padding: 4, zIndex: 1, lineHeight: 0 }}
                  >
                    <Bookmark size={20} strokeWidth={1.75} color="#1a7a5e" fill="#1a7a5e" />
                  </button>

                  {/* "for [name] · context · stage" */}
                  <div style={{ fontSize: 11, color: "#8a8a8a", fontFamily: "Nunito, sans-serif", marginBottom: 6, paddingRight: 32, lineHeight: 1.4 }}>
                    {byline}
                  </div>

                  {/* Item name */}
                  <div style={{ fontFamily: "Lora, serif", fontSize: 19, fontWeight: 700, color: "#1a1a1a", marginBottom: 8, lineHeight: 1.3, paddingRight: 32 }}>
                    {item.name}
                    {showQty && (
                      <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 600, color: "#6b7a70", marginLeft: 6 }}>
                        × {qty}
                      </span>
                    )}
                  </div>

                  {/* Metadata */}
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

                  {/* View full register */}
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

        {(loading || items.length === 0) && <div style={{ height: 100 }} />}
        {items.length > 0 && <div style={{ height: 100 }} />}
      </div>

      <BottomNav />
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
