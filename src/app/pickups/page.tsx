"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, Package, Compass } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OtherParty {
  id: string;
  name: string;
}

interface LastMessage {
  senderId:    string;
  senderName:  string;
  messageType: string;
  content:     string | null;
  createdAt:   string;
}

interface PickupRow {
  coordinationId: string;
  requestId:      string;
  status:         string;
  updatedAt:      string;
  itemId:         string;
  itemTitle:      string;
  isUserDonor:    boolean;
  otherParty:     OtherParty;
  lastMessage:    LastMessage | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:            { bg: "#fff8ed", color: "#d97706", label: "Waiting" },
  LOCATION_CONFIRMED: { bg: "#e3f2fd", color: "#1565c0", label: "Location set" },
  TIME_PROPOSED:      { bg: "#e3f2fd", color: "#1565c0", label: "Time proposed" },
  SCHEDULED:          { bg: "#e8f5f1", color: "#1a7a5e", label: "Scheduled" },
  DONOR_READY:        { bg: "#e8f5f1", color: "#1a7a5e", label: "Donor ready" },
  DELIVERED:          { bg: "#e8f5f1", color: "#1a7a5e", label: "Delivered" },
  CONFIRMED:          { bg: "#f5f5f5", color: "#9ca3af", label: "Complete" },
  CANCELLED:          { bg: "#fdecea", color: "#c0392b", label: "Cancelled" },
  REPORTED:           { bg: "#fdecea", color: "#c0392b", label: "Under review" },
};

const ACTIVE_STATUSES    = new Set(["PENDING", "LOCATION_CONFIRMED", "TIME_PROPOSED", "SCHEDULED", "DONOR_READY", "DELIVERED"]);
const COMPLETED_STATUSES = new Set(["CONFIRMED"]);
const CANCELLED_STATUSES = new Set(["CANCELLED", "REPORTED"]);

type FilterTab = "active" | "completed" | "cancelled" | "all";

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function initials(name: string): string {
  return name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ["#1a7a5e", "#2563eb", "#7c3aed", "#d97706", "#dc2626"];
function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function messagePreview(row: PickupRow): string {
  const m = row.lastMessage;
  if (!m) return "No messages yet";
  const prefix = m.senderId === row.otherParty.id ? m.senderName.split(" ")[0] : "You";
  if (m.messageType === "CUSTOM") {
    const text = (m.content ?? "").trim();
    return `${prefix}: ${text.length > 55 ? text.slice(0, 55) + "…" : text}`;
  }
  const quickLabels: Record<string, string> = {
    IM_HERE:         "I'm here",
    ON_MY_WAY:       "On my way",
    RUNNING_LATE:    "Running a few minutes late",
    CANT_MAKE_IT:    "Can't make this time",
    PICKUP_COMPLETE: "Pickup complete",
  };
  return `${prefix}: ${quickLabels[m.messageType] ?? m.messageType}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PickupsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [pickups,  setPickups]  = useState<PickupRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<FilterTab>("active");

  useEffect(() => {
    if (!user) { router.push("/auth"); return; }
    // Record visit timestamp for future badge implementation
    try { localStorage.setItem("kradel_pickups_last_seen", new Date().toISOString()); } catch {}

    fetch("/api/pickups")
      .then(r => r.json())
      .then(d => setPickups(d.pickups ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, router]);

  if (!user) return null;

  const visible = pickups.filter(p => {
    if (tab === "active")    return ACTIVE_STATUSES.has(p.status);
    if (tab === "completed") return COMPLETED_STATUSES.has(p.status);
    if (tab === "cancelled") return CANCELLED_STATUSES.has(p.status);
    return true;
  });

  const TABS: { id: FilterTab; label: string }[] = [
    { id: "active",    label: "Active"    },
    { id: "completed", label: "Completed" },
    { id: "cancelled", label: "Cancelled" },
    { id: "all",       label: "All"       },
  ];

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 80 }}>

      {/* Header */}
      <div style={{
        background: "white", borderBottom: "1px solid var(--border)",
        padding: "16px 16px 12px", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <PackageCheck size={22} color="#1a7a5e" strokeWidth={1.75} />
          <h1 style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>
            My Pickups
          </h1>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                fontFamily: "Nunito, sans-serif", cursor: "pointer", flexShrink: 0,
                border: `1.5px solid ${tab === t.id ? "#1a7a5e" : "var(--border)"}`,
                background: tab === t.id ? "#e8f5f1" : "white",
                color:      tab === t.id ? "#1a7a5e" : "var(--mid)",
                transition: "all 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "12px 16px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
            <div className="spinner" />
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%", background: "#e8f5f1",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
            }}>
              <PackageCheck size={28} color="#1a7a5e" strokeWidth={1.75} />
            </div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>
              {tab === "active" ? "No active pickups right now" : `No ${tab} pickups`}
            </div>
            <div style={{ fontSize: 13, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, marginBottom: 20, maxWidth: 260, margin: "0 auto 20px" }}>
              {tab === "active"
                ? "Once you accept or request an item, your coordination will appear here."
                : `Pickups with ${tab} status will appear here.`}
            </div>
            {tab === "active" && (
              <button
                onClick={() => router.push("/")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "10px 20px", borderRadius: 20, border: "none",
                  background: "#1a7a5e", color: "white",
                  fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif",
                  cursor: "pointer",
                }}
              >
                <Compass size={15} strokeWidth={1.75} />
                Browse items
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visible.map(p => {
              const meta     = STATUS_META[p.status] ?? STATUS_META.PENDING;
              const color    = avatarColor(p.otherParty.id);
              const lastTime = p.lastMessage ? p.lastMessage.createdAt : p.updatedAt;

              return (
                <div
                  key={p.requestId}
                  onClick={() => router.push(`/coordination/${p.requestId}`)}
                  style={{
                    background: "white", borderRadius: 14, padding: "14px 14px",
                    border: "1px solid var(--border)", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 12,
                    transition: "box-shadow 0.15s",
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                    background: color, display: "flex", alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "white", fontFamily: "Nunito, sans-serif" }}>
                      {initials(p.otherParty.name)}
                    </span>
                  </div>

                  {/* Body */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <Package size={13} color="#1a7a5e" strokeWidth={1.75} style={{ flexShrink: 0 }} />
                      <span style={{
                        fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700,
                        color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {p.itemTitle}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>
                      {p.isUserDonor ? "To: " : "From: "}{p.otherParty.name.split(" ")[0]}
                    </div>
                    <div style={{
                      fontSize: 12, color: "#555", fontFamily: "Nunito, sans-serif",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {messagePreview(p)}
                    </div>
                  </div>

                  {/* Right column */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                      background: meta.bg, color: meta.color, fontFamily: "Nunito, sans-serif",
                    }}>
                      {meta.label}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                      {relativeTime(lastTime)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
