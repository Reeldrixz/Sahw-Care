"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";

interface RegisterData {
  id: string;
  title: string;
  city: string;
  dueDate: string;
  createdAt: string;
  creator: { id: string; name: string; location: string | null };
  items: { id: string; status: string }[];
}

function progressColor(pct: number) {
  if (pct >= 1) return "var(--green)";
  if (pct >= 0.5) return "#f6c90e";
  return "var(--terra)";
}

export default function RegistersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [registers, setRegisters] = useState<RegisterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchRegisters = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/registers");
    if (res.ok) {
      const data = await res.json();
      setRegisters(data.registers ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRegisters(); }, [fetchRegisters]);

  const filtered = registers.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.city.toLowerCase().includes(search.toLowerCase()) ||
      r.creator.name.toLowerCase().includes(search.toLowerCase())
  );

  const getDaysLeft = (dueDate: string) => {
    const diff = new Date(dueDate).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) return "Overdue";
    if (days === 0) return "Due today";
    return `${days}d left`;
  };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">
        {/* Header */}
        <div style={{ background: "var(--white)", padding: "16px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700 }}>📋 Registers</div>
            {user && (
              <button
                onClick={() => router.push("/registers/new")}
                style={{ background: "var(--green)", color: "white", border: "none", borderRadius: 20, padding: "8px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
              >
                + Create
              </button>
            )}
          </div>
          <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 14 }}>
            Moms share what they need. Donors choose what to give. 💛
          </p>
          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
            <span style={{ fontSize: 16, color: "var(--light)" }}>🔍</span>
            <input
              placeholder="Search by name or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: "none", background: "transparent", fontFamily: "Nunito, sans-serif", fontSize: 14, color: "var(--ink)", outline: "none", flex: 1 }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ padding: "16px 16px 100px" }}>
          {loading ? (
            <div className="loading" style={{ marginTop: 60 }}><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty" style={{ marginTop: 40 }}>
              <div className="empty-icon">📋</div>
              <div className="empty-title">No registers yet</div>
              <div style={{ marginBottom: 20 }}>Be the first to create one!</div>
              {user && (
                <button className="btn-primary" style={{ width: "auto", padding: "10px 24px" }} onClick={() => router.push("/registers/new")}>
                  + Create Register
                </button>
              )}
            </div>
          ) : (
            filtered.map((reg) => {
              const total = reg.items.length;
              const fulfilled = reg.items.filter((i) => i.status === "FULFILLED").length;
              const reserved = reg.items.filter((i) => i.status === "RESERVED").length;
              const pct = total > 0 ? fulfilled / total : 0;
              const firstName = reg.creator.name.split(" ")[0];
              const daysLeft = getDaysLeft(reg.dueDate);
              const isOverdue = daysLeft === "Overdue";

              return (
                <div
                  key={reg.id}
                  onClick={() => router.push(`/registers/${reg.id}`)}
                  style={{
                    background: "var(--white)", borderRadius: "var(--r)", padding: "16px",
                    marginBottom: 12, boxShadow: "var(--shadow)", cursor: "pointer",
                    transition: "transform 0.2s, box-shadow 0.2s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-lg)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow)"; }}
                >
                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{reg.title}</div>
                      <div style={{ fontSize: 12, color: "var(--mid)", fontWeight: 600 }}>
                        👤 {firstName} · 📍 {reg.city}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, flexShrink: 0,
                      background: isOverdue ? "var(--terra-light)" : "var(--yellow-light)",
                      color: isOverdue ? "var(--terra)" : "#b8860b",
                    }}>
                      {isOverdue ? "⚠️ " : "⏳ "}{daysLeft}
                    </span>
                  </div>

                  {/* Progress bar */}
                  {total > 0 && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontSize: 12, color: "var(--mid)", fontWeight: 600 }}>
                        <span>{fulfilled}/{total} fulfilled</span>
                        {reserved > 0 && <span style={{ color: "var(--terra)" }}>{reserved} reserved</span>}
                      </div>
                      <div style={{ background: "var(--bg)", borderRadius: 6, height: 8, overflow: "hidden" }}>
                        <div style={{ width: `${pct * 100}%`, height: "100%", background: progressColor(pct), borderRadius: 6, transition: "width 0.4s" }} />
                      </div>
                    </>
                  )}

                  {total === 0 && (
                    <div style={{ fontSize: 12, color: "var(--light)", fontStyle: "italic" }}>No items added yet</div>
                  )}

                  <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green)" }}>View register →</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
