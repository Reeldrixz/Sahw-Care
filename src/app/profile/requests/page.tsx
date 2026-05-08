"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";

type Status = "all" | "pending" | "fulfilled" | "cancelled";

interface MyRequest {
  id: string;
  status: string;
  createdAt: string;
  notes: string | null;
  coordinationId: string | null;
  item: { id: string; title: string; images: string[]; donor?: { name: string } | null } | null;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: "#fff8ed", color: "#d97706" },
  ACCEPTED:  { bg: "#e8f5f1", color: "#1a7a5e" },
  DECLINED:  { bg: "#fdecea", color: "#c0392b" },
  FULFILLED: { bg: "#f0fdf4", color: "#16a34a" },
  ACTIVE:    { bg: "#e8f5f1", color: "#1a7a5e" },
  CANCELLED: { bg: "#f5f5f5", color: "#9ca3af" },
};

const TABS: { key: Status; label: string }[] = [
  { key: "all",       label: "All"       },
  { key: "pending",   label: "Pending"   },
  { key: "fulfilled", label: "Fulfilled" },
  { key: "cancelled", label: "Cancelled" },
];

export default function RequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<Status>("all");

  useEffect(() => {
    if (authLoading || !user) return;
    fetch("/api/requests")
      .then(r => r.json())
      .then(d => { setRequests(d.requests ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user, authLoading]);

  const visible = tab === "all"
    ? requests
    : tab === "fulfilled"
    ? requests.filter(r => r.status === "FULFILLED" || r.status === "CONFIRMED")
    : requests.filter(r => r.status.toLowerCase() === tab);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "20px 16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.back()}
            style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}
          >
            <ArrowLeft size={16} strokeWidth={2} color="white" />
          </button>
          <div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "white" }}>My Requests</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{requests.length} total</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, padding: "14px 16px 0", overflowX: "auto" }}>
        {TABS.map(({ key, label }) => {
          const count = key === "all" ? requests.length : requests.filter(r => r.status.toLowerCase() === key).length;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                flexShrink: 0, padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                border: "1.5px solid", fontFamily: "Nunito, sans-serif", cursor: "pointer",
                borderColor: tab === key ? "#1a7a5e" : "var(--border)",
                background: tab === key ? "#e8f5f1" : "white",
                color: tab === key ? "#1a7a5e" : "var(--mid)",
              }}
            >
              {label} {count > 0 && <span style={{ marginLeft: 3, background: tab === key ? "#1a7a5e" : "var(--mid)", color: "white", fontSize: 10, borderRadius: 20, padding: "1px 5px" }}>{count}</span>}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "12px 16px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}><div className="spinner" /></div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--mid)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No requests here</div>
            <div style={{ fontSize: 13 }}>
              {tab === "all" ? "Browse the discover page to find items to request." : `No ${tab} requests.`}
            </div>
          </div>
        ) : visible.map(req => {
          const sc = STATUS_COLORS[req.status] ?? STATUS_COLORS.PENDING;
          const isAccepted = req.status === "ACCEPTED" && !!req.coordinationId;
          return (
            <div
              key={req.id}
              onClick={() => isAccepted && router.push(`/coordination/${req.id}`)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px", borderRadius: 14, marginBottom: 8,
                background: "white", border: "1px solid var(--border)",
                cursor: isAccepted ? "pointer" : "default",
              }}
            >
              <div style={{ width: 44, height: 44, background: "var(--bg)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20 }}>
                📦
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {req.item?.title ?? "Item removed"}
                </div>
                <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginTop: 2 }}>
                  {req.status === "PENDING"
                    ? "Waiting for donor to respond"
                    : new Date(req.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })
                      + (req.item?.donor ? ` · from ${req.item.donor.name}` : "")}
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: sc.bg, color: sc.color, flexShrink: 0, fontFamily: "Nunito, sans-serif", whiteSpace: "nowrap" }}>
                {isAccepted ? "Coordinate →" : req.status.charAt(0) + req.status.slice(1).toLowerCase()}
              </span>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
