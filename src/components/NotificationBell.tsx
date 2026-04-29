"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Bell, X, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import NotifCard, { type Notif } from "./NotifCard";

export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = useCallback(async () => {
    if (!user) return;
    const r = await fetch("/api/notifications?limit=10");
    if (r.ok) {
      const d = await r.json();
      setNotifs(d.notifications ?? []);
      setUnread(d.unreadCount ?? 0);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNotifs();
    const t = setInterval(fetchNotifs, 30000);
    return () => clearInterval(t);
  }, [user, fetchNotifs]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = async () => {
    await fetch("/api/notifications/read-all", { method: "PATCH" });
    setNotifs((n) => n.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
  };

  const markOneRead = async (id: string, link: string | null) => {
    if (!notifs.find((n) => n.id === id)?.isRead) {
      fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => {});
      setNotifs((n) => n.map((x) => (x.id === id ? { ...x, isRead: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (link) router.push(link);
  };

  if (!user) return null;

  return (
    <div style={{ position: "relative" }} ref={panelRef}>
      {/* Bell button */}
      <button
        className="icon-btn"
        onClick={() => { setOpen((p) => !p); if (!open) fetchNotifs(); }}
        style={{ position: "relative" }}
        aria-label="Notifications"
      >
        <Bell size={20} strokeWidth={1.75} color="#1a7a5e" />
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -2, right: -2,
            minWidth: 18, height: 18, borderRadius: 9,
            background: "#1a7a5e", color: "white",
            fontSize: 10, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px", fontFamily: "Nunito, sans-serif",
            border: "2px solid white",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Popup panel */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: 380, background: "white", borderRadius: 16,
          boxShadow: "0 8px 40px rgba(0,0,0,0.14)", border: "1px solid var(--border)",
          zIndex: 200, overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px 12px", borderBottom: "1px solid var(--border)",
          }}>
            <span style={{ fontFamily: "Lora, serif", fontWeight: 700, fontSize: 16, color: "#1a1a1a" }}>
              Notifications
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    fontSize: 12, fontWeight: 700, color: "#1a7a5e",
                    background: "none", border: "none", cursor: "pointer",
                    fontFamily: "Nunito, sans-serif", display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "#9ca3af" }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Unread strip */}
          {unread > 0 && (
            <div style={{
              background: "#fff8ed", borderBottom: "1px solid #fde68a",
              padding: "6px 16px", fontSize: 12, fontWeight: 700,
              color: "#92400e", fontFamily: "Nunito, sans-serif",
            }}>
              {unread} unread
            </div>
          )}

          {/* List */}
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {notifs.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <div style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: "#e8f5f1", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  margin: "0 auto 12px",
                }}>
                  <Bell size={22} color="#1a7a5e" strokeWidth={1.5} />
                </div>
                <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 14, color: "#1a1a1a", marginBottom: 6 }}>
                  Nothing new right now.
                </div>
                <div style={{ fontSize: 12, color: "#555555", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>
                  We&apos;ll let you know when something needs your attention.
                </div>
              </div>
            ) : (
              notifs.map((n) => (
                <NotifCard key={n.id} notif={n} compact onRead={markOneRead} />
              ))
            )}
          </div>

          {/* Footer — see all */}
          {notifs.length >= 5 && (
            <button
              onClick={() => { setOpen(false); router.push("/notifications"); }}
              style={{
                display: "block", width: "100%", padding: "12px",
                background: "none", border: "none",
                borderTop: "1px solid var(--border)",
                fontSize: 13, fontWeight: 700, color: "#1a7a5e",
                cursor: "pointer", fontFamily: "Nunito, sans-serif",
              }}
            >
              See all notifications →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
