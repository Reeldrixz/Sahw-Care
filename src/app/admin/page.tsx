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
  pendingOverrides: number; totalRegisters: number; pendingDocuments: number;
}

interface VerifUser {
  id: string; name: string; email: string | null; phone: string | null; avatar: string | null;
  docStatus: string; documentUrl: string | null; documentType: string | null;
  documentNote: string | null; verifiedAt: string | null; createdAt: string;
  phoneVerified: boolean; emailVerified: boolean;
}

type Section = "overview" | "users" | "listings" | "reports" | "trust" | "verification";

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
  const [verifUsers, setVerifUsers] = useState<VerifUser[]>([]);
  const [verifFilter, setVerifFilter] = useState("PENDING");
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
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
  const fetchVerif    = useCallback(async () => { setLoading(true); const r = await fetch(`/api/admin/verification?status=${verifFilter}`); if (r.ok) { const d = await r.json(); setVerifUsers(d.users ?? []); } setLoading(false); }, [verifFilter]);

  useEffect(() => { if (user?.role === "ADMIN") fetchStats(); }, [user, fetchStats]);
  useEffect(() => { if (section === "users")    fetchUsers(); }, [section, fetchUsers, userSearch]);
  useEffect(() => { if (section === "listings") fetchItems(); }, [section, fetchItems, itemSearch]);
  useEffect(() => { if (section === "reports")  fetchReports(); }, [section, fetchReports, reportFilter]);
  useEffect(() => { if (section === "trust")        fetchTrust(); }, [section, fetchTrust]);
  useEffect(() => { if (section === "verification") fetchVerif(); }, [section, fetchVerif, verifFilter]);

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
  const reviewDoc = async (userId: string, action: "approve" | "reject") => {
    const note = action === "reject" ? rejectNote[userId] : undefined;
    const res = await fetch(`/api/admin/verification/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    if (res.ok) {
      fetchVerif(); fetchStats();
      setToast(action === "approve" ? "✅ Document approved — mother notified!" : "Document rejected with feedback.");
    }
  };

  const recalcTrust = async (userId: string) => {
    const res = await fetch("/api/admin/trust", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
    if (res.ok) { const d = await res.json(); setTrustUsers((p) => p.map((u) => u.id === userId ? { ...u, trustScore: d.trustScore } : u)); setToast(`Trust score updated: ${d.trustScore}`); }
  };

  if (authLoading || !user) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;

  const NAV_ITEMS: [Section, string][] = [
    ["overview",     "📊 Overview"],
    ["users",        "👥 Users"],
    ["listings",     "📦 Listings"],
    ["reports",      "🚩 Reports" + (stats?.pendingReports ? ` (${stats.pendingReports})` : "")],
    ["trust",        "🛡️ Trust"],
    ["verification", "✅ Verify" + (stats?.pendingDocuments ? ` (${stats.pendingDocuments})` : "")],
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
                    [stats.pendingDocuments.toString(), "Docs Pending Review"],
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

            {/* ── VERIFICATION QUEUE ──────────────────────────────── */}
            {section === "verification" && (
              <div>
                {/* Filter tabs */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {(["PENDING", "VERIFIED", "REJECTED"] as const).map((s) => (
                    <button key={s} onClick={() => setVerifFilter(s)} style={{
                      padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                      fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700,
                      background: verifFilter === s ? "var(--green)" : "var(--bg)",
                      color: verifFilter === s ? "white" : "var(--mid)",
                    }}>{s.charAt(0) + s.slice(1).toLowerCase()}</button>
                  ))}
                </div>

                {loading ? <div className="loading"><div className="spinner" /></div>
                  : verifUsers.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "var(--mid)" }}>
                      <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>No {verifFilter.toLowerCase()} documents</div>
                    </div>
                  ) : verifUsers.map((u) => (
                    <div key={u.id} style={{ background: "var(--white)", borderRadius: 14, padding: "16px", marginBottom: 12, boxShadow: "var(--shadow)" }}>
                      {/* Header row */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--green-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "var(--green)", flexShrink: 0, overflow: "hidden" }}>
                          {u.avatar
                            ? <img src={u.avatar} alt={u.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />  // eslint-disable-line @next/next/no-img-element
                            : u.name[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 14 }}>{u.name}</div>
                          <div style={{ fontSize: 12, color: "var(--mid)" }}>{u.email ?? u.phone} · Joined {new Date(u.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</div>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                          background: u.docStatus === "VERIFIED" ? "var(--green-light)" : u.docStatus === "REJECTED" ? "var(--terra-light)" : "var(--yellow-light)",
                          color: u.docStatus === "VERIFIED" ? "var(--green)" : u.docStatus === "REJECTED" ? "var(--terra)" : "#b8860b",
                        }}>{u.docStatus}</span>
                      </div>

                      {/* Document info */}
                      <div style={{ background: "var(--bg)", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>📄 {u.documentType ?? "Unknown type"}</div>
                        {u.documentUrl && (
                          <a href={u.documentUrl} target="_blank" rel="noreferrer"
                            style={{ fontSize: 12, color: "var(--green)", fontWeight: 700, textDecoration: "none" }}>
                            View document ↗
                          </a>
                        )}
                        {u.documentNote && (
                          <div style={{ fontSize: 12, color: "var(--mid)", marginTop: 6, lineHeight: 1.4 }}>{u.documentNote}</div>
                        )}
                      </div>

                      {/* L1 verification badges */}
                      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: u.phoneVerified ? "var(--green-light)" : "var(--bg)", color: u.phoneVerified ? "var(--green)" : "var(--mid)" }}>
                          {u.phoneVerified ? "📱 Phone ✓" : "📱 Phone ✗"}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: u.emailVerified ? "var(--green-light)" : "var(--bg)", color: u.emailVerified ? "var(--green)" : "var(--mid)" }}>
                          {u.emailVerified ? "📧 Email ✓" : "📧 Email ✗"}
                        </span>
                      </div>

                      {/* Action buttons — only show for PENDING */}
                      {u.docStatus === "PENDING" && (
                        <div>
                          <textarea
                            placeholder="Rejection message (optional — default will be used if blank)"
                            value={rejectNote[u.id] ?? ""}
                            onChange={(e) => setRejectNote((p) => ({ ...p, [u.id]: e.target.value }))}
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, fontFamily: "Nunito, sans-serif", resize: "vertical", marginBottom: 10, boxSizing: "border-box" }}
                            rows={2}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => reviewDoc(u.id, "approve")} style={{
                              flex: 1, padding: "10px", borderRadius: 10, border: "none",
                              background: "var(--green)", color: "white", fontSize: 13, fontWeight: 800,
                              cursor: "pointer", fontFamily: "Nunito, sans-serif",
                            }}>✅ Approve</button>
                            <button onClick={() => reviewDoc(u.id, "reject")} style={{
                              flex: 1, padding: "10px", borderRadius: 10, border: "1.5px solid var(--terra)",
                              background: "white", color: "var(--terra)", fontSize: 13, fontWeight: 800,
                              cursor: "pointer", fontFamily: "Nunito, sans-serif",
                            }}>✗ Reject</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}

          </div>
        </div>
      </div>

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
