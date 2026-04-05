"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";

interface AdminUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  isPremium: boolean;
  trustRating: number;
  createdAt: string;
  _count: { items: number; requests: number };
}

interface AdminItem {
  id: string;
  title: string;
  category: string;
  status: string;
  createdAt: string;
  urgent: boolean;
  donor: { id: string; name: string; email: string | null };
  _count: { requests: number };
}

interface Stats {
  totalItems: number;
  activeItems: number;
  totalUsers: number;
  activeUsers: number;
  totalRequests: number;
  fulfilledRequests: number;
  fulfilmentRate: number;
  pendingReports: number;
}

type Section = "overview" | "users" | "listings" | "reports";

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [section, setSection] = useState<Section>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentActivity, setRecentActivity] = useState<AdminItem[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "ADMIN")) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/admin/stats");
    if (res.ok) {
      const data = await res.json();
      setStats(data.stats);
      setRecentActivity(data.recentActivity ?? []);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (userSearch) params.set("search", userSearch);
    const res = await fetch(`/api/admin/users?${params}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users ?? []);
    }
    setLoading(false);
  }, [userSearch]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (itemSearch) params.set("search", itemSearch);
    const res = await fetch(`/api/admin/items?${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
    setLoading(false);
  }, [itemSearch]);

  useEffect(() => { if (user?.role === "ADMIN") fetchStats(); }, [user, fetchStats]);
  useEffect(() => { if (section === "users") fetchUsers(); }, [section, fetchUsers, userSearch]);
  useEffect(() => { if (section === "listings") fetchItems(); }, [section, fetchItems, itemSearch]);

  const updateUserStatus = async (userId: string, status: string) => {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status } : u)));
      setToast(`User status updated to ${status}`);
    }
  };

  const updateItemStatus = async (itemId: string, status: string) => {
    const res = await fetch(`/api/admin/items/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, status } : i)));
      setToast(`Item status updated to ${status}`);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setToast("User removed");
    }
  };

  if (authLoading || !user) {
    return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;
  }

  const NAV_ITEMS: [Section, string][] = [
    ["overview", "📊 Overview"],
    ["users", "👥 Users"],
    ["listings", "📦 Listings"],
    ["reports", "🚩 Reports"],
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
              <div
                key={key}
                className={`admin-nav-item ${section === key ? "active" : ""}`}
                onClick={() => setSection(key)}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="admin-content">
            {/* OVERVIEW */}
            {section === "overview" && stats && (
              <>
                <div className="admin-cards">
                  {[
                    [stats.totalItems.toLocaleString(), "Total Donations"],
                    [stats.activeUsers.toLocaleString(), "Active Users"],
                    [`${stats.fulfilmentRate}%`, "Fulfilment Rate"],
                    [stats.pendingReports.toString(), "Reports Pending"],
                    [stats.activeItems.toLocaleString(), "Active Listings"],
                  ].map(([num, label]) => (
                    <div key={label} className="admin-card">
                      <div className="admin-card-num">{num}</div>
                      <div className="admin-card-label">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="admin-table">
                  <div className="admin-table-header">
                    <div className="admin-table-title">Recent Listings</div>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Donor</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentActivity.map((item) => (
                        <tr key={item.id}>
                          <td><strong>{item.title}</strong></td>
                          <td style={{ color: "var(--mid)" }}>{item.donor.name}</td>
                          <td>
                            <span className={`status-pill status-${item.status}`}>{item.status}</span>
                          </td>
                          <td style={{ color: "var(--mid)" }}>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* USERS */}
            {section === "users" && (
              <div className="admin-table">
                <div className="admin-table-header">
                  <div className="admin-table-title">All Users</div>
                  <input
                    className="search-bar"
                    style={{ maxWidth: 220 }}
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                </div>
                {loading ? (
                  <div className="loading"><div className="spinner" /></div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Contact</th>
                        <th>Role</th>
                        <th>Items</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td><strong>{u.name}</strong></td>
                          <td style={{ color: "var(--mid)", fontSize: 12 }}>
                            {u.email ?? u.phone}
                          </td>
                          <td>{u.role}</td>
                          <td>{u._count.items}</td>
                          <td>
                            <span className={`status-pill status-${u.status}`}>{u.status}</span>
                          </td>
                          <td>
                            {u.status !== "ACTIVE" && (
                              <button className="action-btn action-approve" onClick={() => updateUserStatus(u.id, "ACTIVE")}>
                                ✓ Approve
                              </button>
                            )}
                            {u.status !== "FLAGGED" && (
                              <button className="action-btn" style={{ background: "rgba(196,98,45,0.1)", color: "var(--terracotta)" }}
                                onClick={() => updateUserStatus(u.id, "FLAGGED")}>
                                🚩 Flag
                              </button>
                            )}
                            {u.status !== "SUSPENDED" && (
                              <button className="action-btn" style={{ background: "rgba(100,100,100,0.1)", color: "var(--mid)" }}
                                onClick={() => updateUserStatus(u.id, "SUSPENDED")}>
                                ⏸ Suspend
                              </button>
                            )}
                            <button className="action-btn action-remove" onClick={() => deleteUser(u.id)}>
                              ✕ Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* LISTINGS */}
            {section === "listings" && (
              <div className="admin-table">
                <div className="admin-table-header">
                  <div className="admin-table-title">All Listings</div>
                  <input
                    className="search-bar"
                    style={{ maxWidth: 220 }}
                    placeholder="Search items..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                  />
                </div>
                {loading ? (
                  <div className="loading"><div className="spinner" /></div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Category</th>
                        <th>Donor</th>
                        <th>Requests</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.title}</strong>
                            {item.urgent && <span className="badge badge-urgent" style={{ marginLeft: 6 }}>⚡ Urgent</span>}
                          </td>
                          <td>{item.category}</td>
                          <td style={{ color: "var(--mid)" }}>{item.donor.name}</td>
                          <td>{item._count.requests}</td>
                          <td>
                            <span className={`status-pill status-${item.status}`}>{item.status}</span>
                          </td>
                          <td>
                            {item.status === "PENDING" && (
                              <button className="action-btn action-approve" onClick={() => updateItemStatus(item.id, "ACTIVE")}>
                                ✓ Approve
                              </button>
                            )}
                            {item.status !== "REMOVED" && (
                              <button className="action-btn action-remove" onClick={() => updateItemStatus(item.id, "REMOVED")}>
                                ✕ Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* REPORTS */}
            {section === "reports" && (
              <div style={{ padding: 40, textAlign: "center", color: "var(--mid)" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🚩</div>
                <div>Flagged content and user reports</div>
                <div style={{ fontSize: 13, marginTop: 8 }}>
                  Reports are submitted via the <code>POST /api/reports</code> endpoint and will appear here.
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
