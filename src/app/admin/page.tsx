"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ──────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string; name: string; email: string | null; phone: string | null;
  role: string; status: string; isPremium: boolean;
  trustRating: number; trustScore: number;
  verificationLevel: number; phoneVerified: boolean; emailVerified: boolean;
  urgentOverridesUsed: number; createdAt: string;
  _count: { items: number; requests: number; urgentOverrides: number };
}

interface AdminItem {
  id: string; title: string; category: string; status: string;
  createdAt: string; urgent: boolean;
  donor: { id: string; name: string; email: string | null };
  _count: { requests: number };
}

interface AdminReport {
  id: string; reason: string; status: string; adminNote: string | null; createdAt: string;
  reporter: { id: string; name: string; email: string | null; phone: string | null };
  targetUser: { id: string; name: string; email: string | null; phone: string | null; status: string; trustScore: number } | null;
  item: { id: string; title: string; category: string; status: string } | null;
}

interface TrustUser {
  id: string; name: string; email: string | null; phone: string | null;
  trustScore: number; trustRating: number;
  verificationLevel: number; phoneVerified: boolean; emailVerified: boolean;
  status: string; urgentOverridesUsed: number;
  _count: { categoryCooldowns: number; urgentOverrides: number };
}

interface Stats {
  totalItems: number; activeItems: number; totalUsers: number; activeUsers: number;
  totalRequests: number; fulfilledRequests: number; fulfilmentRate: number;
  pendingReports: number; verifiedUsers: number; lowTrustUsers: number;
  pendingOverrides: number; totalRegisters: number;
}

type Section = "overview" | "users" | "listings" | "reports" | "trust";

const VERIFY_LABELS = ["Unverified", "Phone/Email ✓", "Phone+Email ✓✓", "ID Verified ✓✓✓"];
const TRUST_COLOR = (s: number) => s >= 70 ? "var(--green)" : s >= 40 ? "#b8860b" : "var(--terra)";
const TRUST_BG   = (s: number) => s >= 70 ? "var(--green-light)" : s >= 40 ? "var(--yellow-light)" : "var(--terra-light)";

// ── Component ──────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [section, setSection] = useState<Section>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentActivity, setRecentActivity] = useState<AdminItem[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [trustUsers, setTrustUsers] = useState<TrustUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [reportFilter, setReportFilter] = useState("PENDING");
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "ADMIN")) router.push("/");
  }, [user, authLoading, router]);

  const fetchStats    = useCallback(async () => { const r = await fetch("/api/admin/stats"); if (r.ok) { const d = await r.json(); setStats(d.stats); setRecentActivity(d.recentActivity ?? []); } }, []);
  const fetchUsers    = useCallback(async () => { setLoading(true); const r = await fetch(`/api/admin/users?search=${encodeURIComponent(userSearch)}`); if (r.ok) { const d = await r.json(); setUsers(d.users ?? []); } setLoading(false); }, [userSearch]);
  const fetchItems    = useCallback(async () => { setLoading(true); const r = await fetch(`/api/admin/items?search=${encodeURIComponent(itemSearch)}`); if (r.ok) { const d = await r.json(); setItems(d.items ?? []); } setLoading(false); }, [itemSearch]);
  const fetchReports  = useCallback(async () => { setLoading(true); const r = await fetch(`/api/admin/reports?status=${reportFilter}`); if (r.ok) { const d = await r.json(); setReports(d.reports ?? []); } setLoading(false); }, [reportFilter]);
  const fetchTrust    = useCallback(async () => { setLoading(true); const r = await fetch("/api/admin/trust"); if (r.ok) { const d = await r.json(); setTrustUsers(d.users ?? []); } setLoading(false); }, []);

  useEffect(() => { if (user?.role === "ADMIN") fetchStats(); }, [user, fetchStats]);
  useEffect(() => { if (section === "users")    fetchUsers(); }, [section, fetchUsers, userSearch]);
  useEffect(() => { if (section === "listings") fetchItems(); }, [section, fetchItems, itemSearch]);
  useEffect(() => { if (section === "reports")  fetchReports(); }, [section, fetchReports, reportFilter]);
  useEffect(() => { if (section === "trust")    fetchTrust(); }, [section, fetchTrust]);

  const updateUserStatus = async (userId: string, status: string) => {
    const res = await fetch(`/api/admin/users/${userId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (res.ok) { setUsers((p) => p.map((u) => u.id === userId ? { ...u, status } : u)); setToast(`User ${status.toLowerCase()}`); }
  };
  const deleteUser = async (userId: string) => {
    if (!confirm("Delete this user permanently?")) return;
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (res.ok) { setUsers((p) => p.filter((u) => u.id !== userId)); setToast("User removed"); }
  };
  const updateItemStatus = async (itemId: string, status: string) => {
    const res = await fetch(`/api/admin/items/${itemId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (res.ok) { setItems((p) => p.map((i) => i.id === itemId ? { ...i, status } : i)); setToast(`Item ${status.toLowerCase()}`); }
  };
  const resolveReport = async (reportId: string, status: "RESOLVED" | "DISMISSED", userAction?: string) => {
    const note = userAction ? `Admin action: ${userAction}` : undefined;
    const res = await fetch(`/api/admin/reports/${reportId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, adminNote: note, userAction }) });
    if (res.ok) { fetchReports(); fetchStats(); setToast(`Report ${status.toLowerCase()}`); }
  };
  const recalcTrust = async (userId: string) => {
    const res = await fetch("/api/admin/trust", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
    if (res.ok) { const d = await res.json(); setTrustUsers((p) => p.map((u) => u.id === userId ? { ...u, trustScore: d.trustScore } : u)); setToast(`Trust score updated: ${d.trustScore}`); }
  };

  if (authLoading || !user) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;

  const NAV_ITEMS: [Section, string][] = [
    ["overview", "📊 Overview"],
    ["users",    "👥 Users"],
    ["listings", "📦 Listings"],
    ["reports",  "🚩 Reports" + (stats?.pendingReports ? ` (${stats.pendingReports})` : "")],
    ["trust",    "🛡️ Trust"],
  ];

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="browse-header">
        <div className="browse-title">Admin Panel</div>
      </div>

      <div className="admin-wrap">
        <div className="admin-layout">
          {/* Sidebar */}
          <div className="admin-nav">
            {NAV_ITEMS.map(([key, label]) => (
              <div key={key} className={`admin-nav-item ${section === key ? "active" : ""}`} onClick={() => setSection(key)}>
                {label}
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="admin-content">

            {/* ── OVERVIEW ─────────────────────────────────────────────── */}
            {section === "overview" && stats && (
              <>
                <div className="admin-cards">
                  {[
                    [stats.totalItems.toLocaleString(), "Total Donations"],
                    [stats.activeUsers.toLocaleString(), "Active Users"],
                    [`${stats.fulfilmentRate}%`, "Fulfilment Rate"],
                    [stats.pendingReports.toString(), "Reports Pending"],
                    [stats.verifiedUsers.toString(), "Verified Users"],
                    [stats.lowTrustUsers.toString(), "Low Trust Users"],
                    [stats.pendingOverrides.toString(), "Override Reviews"],
                    [stats.totalRegisters.toString(), "Registers"],
                  ].map(([num, label]) => (
                    <div key={label} className="admin-card">
                      <div className="admin-card-num">{num}</div>
                      <div className="admin-card-label">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="admin-table">
                  <div className="admin-table-header"><div className="admin-table-title">Recent Listings</div></div>
                  <table><thead><tr><th>Item</th><th>Donor</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>{recentActivity.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.title}</strong></td>
                        <td style={{ color: "var(--mid)" }}>{item.donor.name}</td>
                        <td><span className={`status-pill status-${item.status}`}>{item.status}</span></td>
                        <td style={{ color: "var(--mid)" }}>{new Date(item.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </>
            )}

            {/* ── USERS ────────────────────────────────────────────────── */}
            {section === "users" && (
              <div className="admin-table">
                <div className="admin-table-header">
                  <div className="admin-table-title">All Users</div>
                  <input className="search-bar" style={{ maxWidth: 220 }} placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                </div>
                {loading ? <div className="loading"><div className="spinner" /></div> : (
                  <table>
                    <thead><tr><th>Name</th><th>Contact</th><th>Trust</th><th>Verified</th><th>Items</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>{users.map((u) => (
                      <tr key={u.id}>
                        <td><strong>{u.name}</strong></td>
                        <td style={{ color: "var(--mid)", fontSize: 12 }}>{u.email ?? u.phone}</td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: TRUST_BG(u.trustScore), color: TRUST_COLOR(u.trustScore) }}>
                            {u.trustScore}/100
                          </span>
                        </td>
                        <td style={{ fontSize: 11, color: "var(--mid)" }}>{VERIFY_LABELS[Math.min(u.verificationLevel, 3)]}</td>
                        <td>{u._count.items}</td>
                        <td><span className={`status-pill status-${u.status}`}>{u.status}</span></td>
                        <td>
                          {u.status !== "ACTIVE"     && <button className="action-btn action-approve" onClick={() => updateUserStatus(u.id, "ACTIVE")}>✓ Approve</button>}
                          {u.status !== "FLAGGED"    && <button className="action-btn" style={{ background: "rgba(196,98,45,0.1)", color: "var(--terra)" }} onClick={() => updateUserStatus(u.id, "FLAGGED")}>🚩 Flag</button>}
                          {u.status !== "SUSPENDED"  && <button className="action-btn" style={{ background: "rgba(100,100,100,0.1)", color: "var(--mid)" }} onClick={() => updateUserStatus(u.id, "SUSPENDED")}>⏸ Suspend</button>}
                          <button className="action-btn action-remove" onClick={() => deleteUser(u.id)}>✕ Remove</button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── LISTINGS ─────────────────────────────────────────────── */}
            {section === "listings" && (
              <div className="admin-table">
                <div className="admin-table-header">
                  <div className="admin-table-title">All Listings</div>
                  <input className="search-bar" style={{ maxWidth: 220 }} placeholder="Search items..." value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} />
                </div>
                {loading ? <div className="loading"><div className="spinner" /></div> : (
                  <table>
                    <thead><tr><th>Title</th><th>Category</th><th>Donor</th><th>Requests</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>{items.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.title}</strong>{item.urgent && <span style={{ marginLeft: 6, fontSize: 10, background: "var(--yellow)", padding: "2px 6px", borderRadius: 10, fontWeight: 700 }}>⚡ Urgent</span>}</td>
                        <td>{item.category}</td>
                        <td style={{ color: "var(--mid)" }}>{item.donor.name}</td>
                        <td>{item._count.requests}</td>
                        <td><span className={`status-pill status-${item.status}`}>{item.status}</span></td>
                        <td>
                          {item.status === "PENDING" && <button className="action-btn action-approve" onClick={() => updateItemStatus(item.id, "ACTIVE")}>✓ Approve</button>}
                          {item.status !== "REMOVED" && <button className="action-btn action-remove" onClick={() => updateItemStatus(item.id, "REMOVED")}>✕ Remove</button>}
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── REPORTS ──────────────────────────────────────────────── */}
            {section === "reports" && (
              <div className="admin-table">
                <div className="admin-table-header">
                  <div className="admin-table-title">Reports</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["PENDING", "RESOLVED", "DISMISSED"].map((s) => (
                      <button key={s} onClick={() => setReportFilter(s)}
                        style={{ padding: "5px 12px", borderRadius: 20, border: "1.5px solid", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif",
                          borderColor: reportFilter === s ? "var(--green)" : "var(--border)",
                          background: reportFilter === s ? "var(--green)" : "var(--white)",
                          color: reportFilter === s ? "white" : "var(--mid)" }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                {loading ? <div className="loading"><div className="spinner" /></div> : reports.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--mid)" }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                    No {reportFilter.toLowerCase()} reports.
                  </div>
                ) : (
                  <div style={{ padding: "0 4px" }}>
                    {reports.map((r) => (
                      <div key={r.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>
                              Reported by: <span style={{ color: "var(--mid)", fontWeight: 600 }}>{r.reporter.name}</span>
                            </div>
                            {r.targetUser && (
                              <div style={{ fontSize: 12, color: "var(--mid)" }}>
                                Against: <strong>{r.targetUser.name}</strong> · Trust: <span style={{ color: TRUST_COLOR(r.targetUser.trustScore), fontWeight: 700 }}>{r.targetUser.trustScore}/100</span>
                                {" · "}<span className={`status-pill status-${r.targetUser.status}`}>{r.targetUser.status}</span>
                              </div>
                            )}
                            {r.item && (
                              <div style={{ fontSize: 12, color: "var(--mid)" }}>
                                Item: <strong>{r.item.title}</strong> ({r.item.category})
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: 11, color: "var(--light)" }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div style={{ fontSize: 13, background: "var(--bg)", padding: "8px 12px", borderRadius: 8, marginBottom: 10, fontStyle: "italic" }}>
                          "{r.reason}"
                        </div>
                        {r.adminNote && (
                          <div style={{ fontSize: 12, color: "var(--green)", marginBottom: 8 }}>📝 {r.adminNote}</div>
                        )}
                        {r.status === "PENDING" && (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button className="action-btn action-approve" onClick={() => resolveReport(r.id, "DISMISSED")}>Dismiss</button>
                            <button className="action-btn action-approve" onClick={() => resolveReport(r.id, "RESOLVED")}>Resolve</button>
                            {r.targetUser && <>
                              <button className="action-btn" style={{ background: "rgba(196,98,45,0.12)", color: "var(--terra)" }} onClick={() => resolveReport(r.id, "RESOLVED", "FLAG")}>🚩 Flag User</button>
                              <button className="action-btn" style={{ background: "rgba(100,100,100,0.1)", color: "var(--mid)" }} onClick={() => resolveReport(r.id, "RESOLVED", "SUSPEND")}>⏸ Suspend</button>
                            </>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TRUST ────────────────────────────────────────────────── */}
            {section === "trust" && (
              <div>
                <div className="admin-table" style={{ marginBottom: 16 }}>
                  <div className="admin-table-header"><div className="admin-table-title">Trust Scores (lowest first)</div></div>
                  {loading ? <div className="loading"><div className="spinner" /></div> : (
                    <table>
                      <thead><tr><th>User</th><th>Trust</th><th>Verified</th><th>Overrides</th><th>Status</th><th>Actions</th></tr></thead>
                      <tbody>{trustUsers.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <strong>{u.name}</strong>
                            <div style={{ fontSize: 11, color: "var(--mid)" }}>{u.email ?? u.phone}</div>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 60, height: 6, background: "var(--border)", borderRadius: 3 }}>
                                <div style={{ width: `${u.trustScore}%`, height: "100%", background: TRUST_COLOR(u.trustScore), borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: TRUST_COLOR(u.trustScore) }}>{u.trustScore}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: 11 }}>
                              {u.phoneVerified ? "📱✓" : "📱✗"} {u.emailVerified ? "📧✓" : "📧✗"}
                              <div style={{ color: "var(--mid)" }}>L{u.verificationLevel}</div>
                            </div>
                          </td>
                          <td style={{ fontSize: 12, color: "var(--mid)" }}>{u.urgentOverridesUsed} this month</td>
                          <td><span className={`status-pill status-${u.status}`}>{u.status}</span></td>
                          <td>
                            <button className="action-btn action-approve" onClick={() => recalcTrust(u.id)}>↻ Recalc</button>
                            {u.status !== "FLAGGED"   && <button className="action-btn" style={{ background: "rgba(196,98,45,0.1)", color: "var(--terra)" }} onClick={() => updateUserStatus(u.id, "FLAGGED")}>🚩</button>}
                            {u.status !== "SUSPENDED" && <button className="action-btn" style={{ background: "rgba(100,100,100,0.1)", color: "var(--mid)" }} onClick={() => updateUserStatus(u.id, "SUSPENDED")}>⏸</button>}
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
