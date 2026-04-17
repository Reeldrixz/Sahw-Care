"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Bell, X, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface Notif {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
  triggeredBy: { id: string; name: string; avatar: string | null } | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetch_notifs = useCallback(async () => {
    if (!user) return;
    const r = await fetch("/api/notifications");
    if (r.ok) {
      const d = await r.json();
      setNotifs(d.notifications ?? []);
      setUnread(d.unreadCount ?? 0);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetch_notifs();
    const t = setInterval(fetch_notifs, 30000);
    return () => clearInterval(t);
  }, [user, fetch_notifs]);

  // Close when clicking outside
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
    await fetch("/api/notifications", { method: "POST" });
    setNotifs(n => n.map(x => ({ ...x, isRead: true })));
    setUnread(0);
  };

  const markOneRead = async (id: string, link: string | null) => {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setNotifs(n => n.map(x => x.id === id ? { ...x, isRead: true } : x));
    setUnread(u => Math.max(0, u - 1));
    if (link) router.push(link);
    setOpen(false);
  };

  if (!user) return null;

  return (
    <div style={{ position: "relative" }} ref={panelRef}>
      <button
        className="icon-btn"
        onClick={() => { setOpen(p => !p); if (!open) fetch_notifs(); }}
        style={{ position: "relative" }}
        aria-label="Notifications"
      >
        <Bell size={20} strokeWidth={1.75} color="#1a7a5e" />
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -2, right: -2,
            minWidth: 16, height: 16, borderRadius: 8,
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

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: 320, maxHeight: 420, overflowY: "auto",
          background: "var(--white)", borderRadius: 16,
          boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)",
          zIndex: 200,
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px 10px", borderBottom: "1px solid var(--border)",
          }}>
            <span style={{ fontFamily: "Lora, serif", fontWeight: 700, fontSize: 15 }}>Notifications</span>
            <div style={{ display: "flex", gap: 8 }}>
              {unread > 0 && (
                <button onClick={markAllRead} style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "4px 10px", borderRadius: 20,
                  border: "1px solid var(--border)", background: "none",
                  fontSize: 11, fontWeight: 700, color: "var(--green)",
                  cursor: "pointer", fontFamily: "Nunito, sans-serif",
                }}>
                  <CheckCheck size={12} />
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{
                background: "none", border: "none", cursor: "pointer", color: "var(--mid)", padding: 2,
              }}>
                <X size={16} />
              </button>
            </div>
          </div>

          {notifs.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--mid)", fontSize: 13 }}>
              No notifications yet
            </div>
          ) : (
            notifs.map(n => (
              <button key={n.id} onClick={() => markOneRead(n.id, n.link)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  width: "100%", padding: "12px 16px",
                  borderBottom: "1px solid var(--border)",
                  background: n.isRead ? "transparent" : "rgba(26,122,94,0.04)",
                  border: "none", cursor: "pointer", textAlign: "left",
                  fontFamily: "Nunito, sans-serif",
                }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 5,
                  background: n.isRead ? "transparent" : "#1a7a5e",
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.4, marginBottom: 3 }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--mid)" }}>{timeAgo(n.createdAt)}</div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
