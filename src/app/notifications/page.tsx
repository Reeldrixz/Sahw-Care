"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import NotifCard, { type Notif } from "@/components/NotifCard";

type Filter = "all" | "unread" | "requests" | "circles" | "bundles";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",      label: "All"      },
  { key: "unread",   label: "Unread"   },
  { key: "requests", label: "Requests" },
  { key: "circles",  label: "Circles"  },
  { key: "bundles",  label: "Bundles"  },
];

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const fetchNotifs = useCallback(async (f: Filter, off: number, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    const r = await fetch(`/api/notifications?limit=${PAGE_SIZE}&offset=${off}&filter=${f}`);
    if (r.ok) {
      const d = await r.json();
      const incoming: Notif[] = d.notifications ?? [];
      setNotifs((prev) => append ? [...prev, ...incoming] : incoming);
      setUnread(d.unreadCount ?? 0);
      setTotal(d.total ?? incoming.length);
    }
    if (append) setLoadingMore(false); else setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    setOffset(0);
    fetchNotifs(filter, 0, false);
  }, [user, filter, fetchNotifs]);

  const loadMore = () => {
    const next = offset + PAGE_SIZE;
    setOffset(next);
    fetchNotifs(filter, next, true);
  };

  const markAllRead = async () => {
    await fetch("/api/notifications/read-all", { method: "PATCH" });
    setNotifs((n) => n.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
  };

  const markOneRead = async (id: string, link: string | null) => {
    const notif = notifs.find((n) => n.id === id);
    if (notif && !notif.isRead) {
      fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => {});
      setNotifs((n) => n.map((x) => (x.id === id ? { ...x, isRead: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    if (link) router.push(link);
  };

  if (!user) return null;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">
        {/* Header */}
        <div style={{
          background: "var(--white)", borderBottom: "1px solid var(--border)",
          padding: "14px 16px 0",
          position: "sticky", top: 0, zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => router.back()}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}
              >
                <ArrowLeft size={20} color="#1a1a1a" />
              </button>
              <span style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: "#1a1a1a" }}>
                Notifications
              </span>
            </div>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  fontSize: 13, fontWeight: 700, color: "#1a7a5e",
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: "Nunito, sans-serif",
                }}
              >
                <CheckCheck size={15} />
                Mark all read
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 0, overflowX: "auto", scrollbarWidth: "none" }}>
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: "8px 14px", background: "none", border: "none",
                  borderBottom: `2px solid ${filter === key ? "#1a7a5e" : "transparent"}`,
                  fontSize: 13, fontWeight: 700,
                  color: filter === key ? "#1a7a5e" : "#555555",
                  cursor: "pointer", whiteSpace: "nowrap",
                  fontFamily: "Nunito, sans-serif",
                  transition: "all 0.15s",
                }}
              >
                {label}
                {key === "unread" && unread > 0 && (
                  <span style={{
                    marginLeft: 5, background: "#1a7a5e", color: "white",
                    fontSize: 10, fontWeight: 800, borderRadius: 20, padding: "1px 5px",
                  }}>
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ paddingBottom: 100 }}>
          {loading ? (
            <div className="loading"><div className="spinner" /></div>
          ) : notifs.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center" }}>
              <div style={{
                width: 60, height: 60, borderRadius: "50%", background: "#e8f5f1",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
              }}>
                <CheckCheck size={26} color="#1a7a5e" strokeWidth={1.5} />
              </div>
              <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, marginBottom: 8, color: "#1a1a1a" }}>
                {filter === "unread" ? "All caught up!" : "Nothing here yet."}
              </div>
              <div style={{ fontSize: 13, color: "#555555", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
                {filter === "unread"
                  ? "No unread notifications."
                  : "We'll let you know when something needs your attention."}
              </div>
            </div>
          ) : (
            <div style={{ background: "white" }}>
              {notifs.map((n) => (
                <NotifCard key={n.id} notif={n} onRead={markOneRead} />
              ))}

              {/* Load more */}
              {notifs.length < total && (
                <div style={{ padding: "16px", textAlign: "center" }}>
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    style={{
                      padding: "10px 28px", borderRadius: 12,
                      border: "1.5px solid var(--border)", background: "white",
                      fontSize: 13, fontWeight: 700, color: "#555555",
                      cursor: loadingMore ? "default" : "pointer",
                      fontFamily: "Nunito, sans-serif",
                      opacity: loadingMore ? 0.6 : 1,
                    }}
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
