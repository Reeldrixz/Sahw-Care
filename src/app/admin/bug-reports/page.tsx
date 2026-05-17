"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface BugReport {
  id:            string;
  userId:        string | null;
  email:         string | null;
  description:   string;
  pageUrl:       string | null;
  userAgent:     string | null;
  screenshotUrl: string | null;
  status:        string;
  priority:      string;
  adminNotes:    string | null;
  resolvedAt:    string | null;
  createdAt:     string;
  user:          { id: string; name: string; email: string | null } | null;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  new:           { bg: "#e3f2fd", color: "#1565c0" },
  investigating: { bg: "#fff3e0", color: "#e65100" },
  resolved:      { bg: "#e8f5e9", color: "#2e7d32" },
  wontfix:       { bg: "#f3f4f6", color: "#6b7280" },
  duplicate:     { bg: "#f3f4f6", color: "#6b7280" },
};

const PRIORITY_COLORS: Record<string, { bg: string; color: string }> = {
  critical: { bg: "#fdecea", color: "#c0392b" },
  high:     { bg: "#fff3e0", color: "#d97706" },
  normal:   { bg: "#f3f4f6", color: "#6b7280" },
  low:      { bg: "#f3f4f6", color: "#9ca3af" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function BugReportsAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [reports,       setReports]       = useState<BugReport[]>([]);
  const [total,         setTotal]         = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [statusFilter,  setStatusFilter]  = useState("");
  const [priFilter,     setPriFilter]     = useState("");
  const [expandedUa,    setExpandedUa]    = useState<string | null>(null);
  const [notes,         setNotes]         = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "ADMIN")) router.push("/");
  }, [user, authLoading, router]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (statusFilter) p.set("status", statusFilter);
    if (priFilter)    p.set("priority", priFilter);
    const r = await fetch(`/api/admin/bug-reports?${p}`);
    if (r.ok) {
      const d = await r.json();
      setReports(d.reports ?? []);
      setTotal(d.total ?? 0);
      const initial: Record<string, string> = {};
      for (const rep of (d.reports ?? [])) initial[rep.id] = rep.adminNotes ?? "";
      setNotes(initial);
    }
    setLoading(false);
  }, [statusFilter, priFilter]);

  useEffect(() => {
    if (user?.role === "ADMIN") fetchReports();
  }, [fetchReports, user]);

  const patch = async (id: string, data: Record<string, unknown>) => {
    await fetch(`/api/admin/bug-reports/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, ...data } : r));
  };

  const saveNotes = async (id: string) => {
    await patch(id, { adminNotes: notes[id] ?? "" });
  };

  if (authLoading || !user) {
    return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;
  }

  const newCount = reports.filter((r) => r.status === "new").length;

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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="browse-title">Bug Reports</div>
          {newCount > 0 && (
            <span style={{ background: "#1565c0", color: "white", fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 20, fontFamily: "Nunito, sans-serif" }}>
              {newCount} new
            </span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "20px 16px" }}>
        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {/* Status tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 0, flex: "1 1 auto" }}>
            {["", "new", "investigating", "resolved", "wontfix", "duplicate"].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{
                padding: "7px 14px", background: "none", border: "none",
                borderBottom: `2px solid ${statusFilter === s ? "var(--green)" : "transparent"}`,
                fontSize: 12, fontWeight: 700,
                color: statusFilter === s ? "var(--green)" : "var(--mid)",
                cursor: "pointer", fontFamily: "Nunito, sans-serif", textTransform: s ? "capitalize" : "none",
                whiteSpace: "nowrap",
              }}>
                {s || "All"}
              </button>
            ))}
          </div>
          {/* Priority filter */}
          <select
            value={priFilter}
            onChange={(e) => setPriFilter(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 12, fontFamily: "Nunito, sans-serif", background: "white", cursor: "pointer" }}
          >
            <option value="">All priorities</option>
            {["critical", "high", "normal", "low"].map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>

        <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 16 }}>
          {total} report{total !== 1 ? "s" : ""}
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : reports.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center", fontSize: 14, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
            No reports match this filter.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {reports.map((rep) => {
              const sc = STATUS_COLORS[rep.status]   ?? { bg: "#f3f4f6", color: "#6b7280" };
              const pc = PRIORITY_COLORS[rep.priority] ?? { bg: "#f3f4f6", color: "#6b7280" };
              const isUaExpanded = expandedUa === rep.id;
              const displayUser  = rep.user
                ? `${rep.user.name}${rep.user.email ? ` · ${rep.user.email}` : ""}`
                : rep.email ? `Anonymous · ${rep.email}` : "Anonymous";

              return (
                <div key={rep.id} style={{ background: "white", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
                  {/* Card header */}
                  <div style={{ padding: "16px 18px 14px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: "0 0 6px", fontSize: 13, fontFamily: "Nunito, sans-serif", color: "var(--ink)", lineHeight: 1.55 }}>
                          {rep.description.slice(0, 200)}{rep.description.length > 200 ? "…" : ""}
                        </p>
                        <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                          {displayUser} · {timeAgo(rep.createdAt)}
                        </div>
                      </div>
                      {rep.screenshotUrl && (
                        <a href={rep.screenshotUrl} target="_blank" rel="noopener noreferrer">
                          <img src={rep.screenshotUrl} alt="Screenshot" style={{ width: 64, height: 48, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)", flexShrink: 0 }} />
                        </a>
                      )}
                    </div>

                    {/* Meta row */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: sc.bg, color: sc.color }}>{rep.status}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: pc.bg, color: pc.color }}>{rep.priority}</span>
                      {rep.pageUrl && (
                        <a href={rep.pageUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>
                          {rep.pageUrl}
                        </a>
                      )}
                    </div>

                    {/* User agent */}
                    {rep.userAgent && (
                      <div style={{ marginTop: 8 }}>
                        <button
                          onClick={() => setExpandedUa(isUaExpanded ? null : rep.id)}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", padding: 0 }}
                        >
                          {isUaExpanded ? "▲ Hide browser info" : "▼ Show browser info"}
                        </button>
                        {isUaExpanded && (
                          <div style={{ marginTop: 5, fontSize: 11, color: "#6b7280", fontFamily: "monospace", wordBreak: "break-all", background: "#f9fafb", padding: "8px 10px", borderRadius: 8 }}>
                            {rep.userAgent}
                          </div>
                        )}
                      </div>
                    )}

                    {rep.resolvedAt && (
                      <div style={{ marginTop: 8, fontSize: 11, color: "#2e7d32", fontFamily: "Nunito, sans-serif" }}>
                        Resolved {new Date(rep.resolvedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {/* Admin controls */}
                  <div style={{ borderTop: "1px solid var(--border)", padding: "12px 18px", background: "#fafaf9", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 4, textTransform: "uppercase" }}>Status</div>
                        <select
                          value={rep.status}
                          onChange={(e) => patch(rep.id, { status: e.target.value })}
                          style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 12, fontFamily: "Nunito, sans-serif", background: "white", cursor: "pointer" }}
                        >
                          {["new", "investigating", "resolved", "wontfix", "duplicate"].map((s) => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 4, textTransform: "uppercase" }}>Priority</div>
                        <select
                          value={rep.priority}
                          onChange={(e) => patch(rep.id, { priority: e.target.value })}
                          style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 12, fontFamily: "Nunito, sans-serif", background: "white", cursor: "pointer" }}
                        >
                          {["critical", "high", "normal", "low"].map((p) => (
                            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 4, textTransform: "uppercase" }}>Admin notes</div>
                      <textarea
                        value={notes[rep.id] ?? ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [rep.id]: e.target.value }))}
                        onBlur={() => saveNotes(rep.id)}
                        placeholder="Internal notes…"
                        rows={2}
                        style={{ width: "100%", padding: "7px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 12, fontFamily: "Nunito, sans-serif", resize: "vertical", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
