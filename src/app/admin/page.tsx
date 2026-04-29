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
  docStatus: string | null; urgentOverridesUsed: number; createdAt: string;
  activeRequestLockedUntil: string | null;
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
  bundlesDelivered: number; bundlesPending: number;
}

interface AdminCampaign {
  id: string; title: string; description: string; sponsorName: string;
  status: string; totalBundles: number; bundlesRemaining: number;
  costPerBundle: number; totalBudget: number; targetStage: string | null;
  createdAt: string; templateId: string;
  template: { name: string };
  _count: { instances: number };
}

interface AdminInstance {
  id: string; status: string; requestedAt: string; adminNotes: string | null;
  trackingNumber: string | null; orderReference: string | null;
  deliveryAddress: { fullName?: string; address?: string; city?: string; state?: string; country?: string; phone?: string };
  recipient: { id: string; name: string; email: string | null; location: string | null };
  campaign: { title: string };
  template: { name: string };
}

interface AdminBundleTemplate {
  id: string; name: string; description: string; estimatedCost: number;
  targetStage: string | null; isActive: boolean;
  items: { name: string; quantity: string; notes?: string }[];
  _count?: { instances: number };
}

interface VerifUser {
  id: string; name: string; email: string | null; phone: string | null; avatar: string | null;
  docStatus: string; documentUrl: string | null; documentType: string | null;
  documentNote: string | null; verifiedAt: string | null; createdAt: string;
  phoneVerified: boolean; emailVerified: boolean;
}

interface CircleInfo {
  id: string; name: string; country: string;
  _count: { members: number; posts: number };
  members: { isLeader: boolean; user: { id: string; name: string; trustScore: number } }[];
}

interface FlaggedPostInfo {
  id: string; reason: string; status: string; createdAt: string;
  post: {
    id: string; content: string; userId: string;
    user: { id: string; name: string; avatar: string | null };
    circle: { name: string };
    reports: { reason: string; reportedBy: string }[];
  };
}

interface AbuseFlag {
  id: string; userId: string; flagType: string; severity: string; status: string;
  evidence: Record<string, unknown>; createdAt: string; reviewedAt: string | null;
  notes: string | null;
  user: { id: string; name: string; email: string | null; trustScore: number; createdAt: string };
}

interface RiskyUser {
  id: string; name: string; email: string | null; phone: string | null;
  trustScore: number; status: string; createdAt: string;
  flagCount: number; hasHighFlag: boolean; lastFlagged: string | null; flagTypes: string[];
}

interface UserAbuseDetail {
  user: { id: string; name: string; email: string | null; trustScore: number; createdAt: string; status: string };
  flags: AbuseFlag[];
  eventLog: { id: string; eventType: string; timestamp: string; trustScore: number; metadata: Record<string, unknown>; hasIpAddress: boolean }[];
  stats: { requestCount7d: number; requestCount30d: number; timeToFirstRequestHours: number | null; engagement: { posts: number; comments: number; requests: number; ratio: string } };
}

interface WeeklySummary {
  id: string; weekStart: string; weekEnd: string; totalFlags: number; highSeverityFlags: number;
  topFlagTypes: { type: string; count: number }[];
  usersDroppedBelow60: number; rapidTrustFarmers: number;
  topRequestedCategories: { category: string; count: number }[];
}

type Section = "overview" | "users" | "listings" | "reports" | "trust" | "verification" | "circles" | "bundles" | "abuse" | "bundle-system" | "fulfillments" | "register-queue" | "catalog" | "coordination";

interface BundleGoalAdmin {
  id: string; month: string; targetBundles: number; costPerBundle: number;
  deliveredBundles: number; bundlesFundedToday: number; status: string; createdAt: string;
  fundedBundles: number;
  allocationStats: { queued: number; approved: number; dispatched: number; delivered: number };
  contributions: { id: string; bundleCount: number; amountCents: number; status: string; createdAt: string; donor: { id: string; name: string; email: string | null } }[];
}

interface EligibleMother {
  id: string; name: string; email: string | null; phone: string | null; avatar: string | null;
  trustScore: number; verificationLevel: number; journeyType: string | null;
  currentStage: string | null; dueDate: string | null; babyBirthDate: string | null;
  createdAt: string; location: string | null;
}

interface BundleAllocAdmin {
  id: string; bundleType: string; status: string; allocatedAt: string;
  dispatchedAt: string | null; deliveryAddress: string | null; notes: string | null;
  recipient: { id: string; name: string; email: string | null; phone: string | null; location: string | null };
  goal: { month: string };
}

interface AdminFulfillment {
  id: string; status: string; donorNote: string | null; donorPhotoUrl: string | null;
  markedAt: string; respondedAt: string | null; autoConfirmedAt: string | null;
  itemTitle: string; itemCategory: string;
  donor:     { id: string; name: string; email: string | null };
  recipient: { id: string; name: string; email: string | null };
}

interface RegQueueEntry {
  id: string; status: string; totalFundedCents: number; purchasedFrom: string | null;
  actualCostCents: number | null; trackingRef: string | null; notes: string | null;
  queuedAt: string; purchasedAt: string | null; dispatchedAt: string | null; deliveredAt: string | null;
  registerItem: {
    id: string; name: string; category: string; quantity: string;
    totalFundedCents: number; standardPriceCents: number;
    register: { id: string; title: string; city: string; creator: { id: string; name: string; location: string | null } };
  };
}

interface Financials {
  month: string; totalFundedCents: number; totalSpentCents: number; surplusCents: number;
  itemsInQueue: number; itemsFulfilledThisMonth: number; allTimeFundedCents: number;
}

interface CatalogAdminEntry {
  id: string; name: string; category: string; standardPriceCents: number;
  description: string | null; isActive: boolean; createdAt: string;
  _count: { registerItems: number };
}

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
  const [circles, setCircles] = useState<CircleInfo[]>([]);
  const [flaggedPosts, setFlaggedPosts] = useState<FlaggedPostInfo[]>([]);
  const [flaggedFilter, setFlaggedFilter] = useState("PENDING");
  const [leaderUserId, setLeaderUserId] = useState<Record<string, string>>({});
  const [userSearch, setUserSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [reportFilter, setReportFilter] = useState("PENDING");
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Abuse KPI state (shown in overview)
  const [abuseKpis, setAbuseKpis] = useState<{ openHigh: number; openTotal: number; riskyCount: number } | null>(null);

  // Abuse monitor state
  const [abuseTab,         setAbuseTab]         = useState<"flags" | "weekly" | "risky">("flags");
  const [abuseFlags,       setAbuseFlags]       = useState<AbuseFlag[]>([]);
  const [abuseSeverity,    setAbuseSeverity]    = useState("all");
  const [riskyUsers,       setRiskyUsers]       = useState<RiskyUser[]>([]);
  const [weeklySummary,    setWeeklySummary]    = useState<WeeklySummary | null>(null);
  const [selectedAbuseUser, setSelectedAbuseUser] = useState<UserAbuseDetail | null>(null);
  const [flagNotes,        setFlagNotes]        = useState<Record<string, string>>({});

  // Register fulfillment queue state
  const [regQueueTab,        setRegQueueTab]        = useState<"QUEUED" | "PURCHASED" | "DISPATCHED" | "DELIVERED">("QUEUED");
  const [regQueue,           setRegQueue]           = useState<RegQueueEntry[]>([]);
  const [regQueueLoading,    setRegQueueLoading]    = useState(false);
  const [regQueueModal,      setRegQueueModal]      = useState<{ id: string; name: string; nextStatus: string } | null>(null);
  const [regQueueForm,       setRegQueueForm]       = useState<Record<string, string>>({});
  const [financials,         setFinancials]         = useState<Financials | null>(null);

  // Catalog management state
  const [catalogItems,       setCatalogItems]       = useState<CatalogAdminEntry[]>([]);
  const [catalogLoading,     setCatalogLoading]     = useState(false);
  const [editingCatalog,     setEditingCatalog]     = useState<CatalogAdminEntry | null>(null);
  const [newCatalogForm,     setNewCatalogForm]     = useState({ name: "", category: "", standardPriceCents: "" });

  // Bundles state
  const [bundleTab,        setBundleTab]        = useState<"campaigns" | "queue" | "all" | "templates">("campaigns");
  const [bundleCampaigns,  setBundleCampaigns]  = useState<AdminCampaign[]>([]);
  const [bundleInstances,  setBundleInstances]  = useState<AdminInstance[]>([]);
  const [bundleTemplates,  setBundleTemplates]  = useState<AdminBundleTemplate[]>([]);
  const [instanceFilter,   setInstanceFilter]   = useState("ALL");
  const [instanceSearch,   setInstanceSearch]   = useState("");
  const [bundleActionData, setBundleActionData] = useState<Record<string, string>>({});
  const [showNewCampaign,  setShowNewCampaign]  = useState(false);
  const [showNewTemplate,  setShowNewTemplate]  = useState(false);
  const [newCampaign, setNewCampaign] = useState({ title: "", description: "", totalBundles: "10", costPerBundle: "80", totalBudget: "800", targetStage: "", templateId: "" });
  const [newTemplate, setNewTemplate] = useState({ name: "", description: "", estimatedCost: "0", targetStage: "", items: "" });

  // Fulfillments state
  const [fulfillments,      setFulfillments]      = useState<AdminFulfillment[]>([]);
  const [fulfillFilter,     setFulfillFilter]     = useState<"DISPUTED" | "AUTO_CONFIRMED" | "PENDING">("DISPUTED");

  // Bundle System (new monthly funding model)
  const [bsTab,             setBsTab]             = useState<"goal" | "mothers" | "allocations">("goal");
  const [bsGoal,            setBsGoal]            = useState<BundleGoalAdmin | null>(null);
  const [bsMothers,         setBsMothers]         = useState<EligibleMother[]>([]);
  const [bsAllocations,     setBsAllocations]     = useState<BundleAllocAdmin[]>([]);
  const [bsAllocFilter,     setBsAllocFilter]     = useState("ALL");
  const [bsNewGoal,         setBsNewGoal]         = useState({ targetBundles: "50", costPerBundle: "4000" });
  const [bsShowNewGoal,     setBsShowNewGoal]     = useState(false);
  const [bsAssignModal,     setBsAssignModal]     = useState<EligibleMother | null>(null);
  const [bsAssignType,      setBsAssignType]      = useState("Immediate Survival Kit");
  const [bsAssignNotes,     setBsAssignNotes]     = useState("");

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "ADMIN")) router.push("/");
  }, [user, authLoading, router]);

  const fetchStats    = useCallback(async () => { const r = await fetch("/api/admin/stats"); if (r.ok) { const d = await r.json(); setStats(d.stats); setRecentActivity(d.recentActivity ?? []); } }, []);
  const fetchBundleCampaigns  = useCallback(async () => { setLoading(true); const r = await fetch("/api/admin/bundles?tab=campaigns"); if (r.ok) { const d = await r.json(); setBundleCampaigns(d.campaigns ?? []); } setLoading(false); }, []);
  const fetchBundleInstances  = useCallback(async () => { setLoading(true); const status = instanceFilter === "ALL" ? "" : instanceFilter; const r = await fetch(`/api/admin/bundles?status=${status}&search=${encodeURIComponent(instanceSearch)}`); if (r.ok) { const d = await r.json(); setBundleInstances(d.instances ?? []); } setLoading(false); }, [instanceFilter, instanceSearch]);
  const fetchBundleTemplates  = useCallback(async () => { setLoading(true); const r = await fetch("/api/admin/bundles/templates"); if (r.ok) { const d = await r.json(); setBundleTemplates(d.templates ?? []); } setLoading(false); }, []);
  const fetchUsers    = useCallback(async () => { setLoading(true); const r = await fetch(`/api/admin/users?search=${encodeURIComponent(userSearch)}`); if (r.ok) { const d = await r.json(); setUsers(d.users ?? []); } setLoading(false); }, [userSearch]);
  const fetchItems    = useCallback(async () => { setLoading(true); const r = await fetch(`/api/admin/items?search=${encodeURIComponent(itemSearch)}`); if (r.ok) { const d = await r.json(); setItems(d.items ?? []); } setLoading(false); }, [itemSearch]);
  const fetchReports  = useCallback(async () => { setLoading(true); const r = await fetch(`/api/admin/reports?status=${reportFilter}`); if (r.ok) { const d = await r.json(); setReports(d.reports ?? []); } setLoading(false); }, [reportFilter]);
  const fetchTrust    = useCallback(async () => { setLoading(true); const r = await fetch("/api/admin/trust"); if (r.ok) { const d = await r.json(); setTrustUsers(d.users ?? []); } setLoading(false); }, []);
  const fetchVerif    = useCallback(async () => { setLoading(true); const r = await fetch(`/api/admin/verification?status=${verifFilter}`); if (r.ok) { const d = await r.json(); setVerifUsers(d.users ?? []); } setLoading(false); }, [verifFilter]);
  const fetchCircles  = useCallback(async () => { setLoading(true); const r = await fetch("/api/admin/circles"); if (r.ok) { const d = await r.json(); setCircles(d.circles ?? []); } setLoading(false); }, []);
  const fetchFlagged  = useCallback(async () => { setLoading(true); const r = await fetch(`/api/admin/circles/flagged?status=${flaggedFilter}`); if (r.ok) { const d = await r.json(); setFlaggedPosts(d.flagged ?? []); } setLoading(false); }, [flaggedFilter]);
  const fetchAbuseFlags   = useCallback(async () => { setLoading(true); const sev = abuseSeverity !== "all" ? `&severity=${abuseSeverity.toUpperCase()}` : ""; const r = await fetch(`/api/admin/abuse/flags?status=OPEN${sev}`); if (r.ok) { const d = await r.json(); setAbuseFlags(d.flags ?? []); } setLoading(false); }, [abuseSeverity]);
  const fetchRiskyUsers   = useCallback(async () => { setLoading(true); const r = await fetch("/api/admin/abuse/risky-users"); if (r.ok) { const d = await r.json(); setRiskyUsers(d.users ?? []); } setLoading(false); }, []);
  const fetchWeeklySummary = useCallback(async () => { const r = await fetch("/api/admin/abuse/summary/weekly"); if (r.ok) { const d = await r.json(); setWeeklySummary(d.summary); } }, []);
  const fetchAbuseUserDetail = useCallback(async (userId: string) => { const r = await fetch(`/api/admin/abuse/flags/${userId}`); if (r.ok) { const d = await r.json(); setSelectedAbuseUser(d); } }, []);
  const fetchBsGoal        = useCallback(async () => { const r = await fetch("/api/admin/bundles/goal"); if (r.ok) { const d = await r.json(); setBsGoal(d.goal); } }, []);
  const fetchBsMothers     = useCallback(async () => { setLoading(true); const r = await fetch("/api/admin/bundles/eligible-mothers"); if (r.ok) { const d = await r.json(); setBsMothers(d.mothers ?? []); } setLoading(false); }, []);
  const fetchBsAllocations = useCallback(async () => { setLoading(true); const r = await fetch("/api/admin/bundles/allocate"); if (r.ok) { const d = await r.json(); setBsAllocations(d.allocations ?? []); } setLoading(false); }, []);
  const fetchFulfillments  = useCallback(async (status: string) => { setLoading(true); const r = await fetch(`/api/admin/fulfillments?status=${status}`); if (r.ok) { const d = await r.json(); setFulfillments(d.fulfillments ?? []); } setLoading(false); }, []);

  useEffect(() => {
    if (user?.role === "ADMIN") {
      fetchStats();
      // Fetch abuse KPIs for overview
      Promise.all([
        fetch("/api/admin/abuse/flags?status=OPEN").then(r => r.ok ? r.json() : { flags: [] }),
        fetch("/api/admin/abuse/flags?status=OPEN&severity=HIGH").then(r => r.ok ? r.json() : { flags: [] }),
        fetch("/api/admin/abuse/risky-users").then(r => r.ok ? r.json() : { users: [] }),
      ]).then(([all, high, risky]) => {
        setAbuseKpis({ openTotal: all.flags?.length ?? 0, openHigh: high.flags?.length ?? 0, riskyCount: risky.users?.length ?? 0 });
      }).catch(() => {});
    }
  }, [user, fetchStats]);
  useEffect(() => { if (section === "users")    fetchUsers(); }, [section, fetchUsers, userSearch]);
  useEffect(() => { if (section === "listings") fetchItems(); }, [section, fetchItems, itemSearch]);
  useEffect(() => { if (section === "reports")  fetchReports(); }, [section, fetchReports, reportFilter]);
  useEffect(() => { if (section === "trust")        fetchTrust(); }, [section, fetchTrust]);
  useEffect(() => { if (section === "verification") fetchVerif(); }, [section, fetchVerif, verifFilter]);
  useEffect(() => { if (section === "circles") { fetchCircles(); fetchFlagged(); } }, [section, fetchCircles, fetchFlagged, flaggedFilter]);
  useEffect(() => {
    if (section !== "abuse") return;
    if (abuseTab === "flags")  fetchAbuseFlags();
    if (abuseTab === "risky")  fetchRiskyUsers();
    if (abuseTab === "weekly") fetchWeeklySummary();
  }, [section, abuseTab, fetchAbuseFlags, fetchRiskyUsers, fetchWeeklySummary, abuseSeverity]);
  useEffect(() => {
    if (section !== "bundles") return;
    if (bundleTab === "campaigns")  fetchBundleCampaigns();
    if (bundleTab === "queue")      fetchBundleInstances();
    if (bundleTab === "all")        fetchBundleInstances();
    if (bundleTab === "templates")  fetchBundleTemplates();
  }, [section, bundleTab, fetchBundleCampaigns, fetchBundleInstances, fetchBundleTemplates, instanceFilter, instanceSearch]);
  useEffect(() => {
    if (section !== "bundle-system") return;
    if (bsTab === "goal")        fetchBsGoal();
    if (bsTab === "mothers")     fetchBsMothers();
    if (bsTab === "allocations") fetchBsAllocations();
  }, [section, bsTab, fetchBsGoal, fetchBsMothers, fetchBsAllocations]);
  useEffect(() => {
    if (section === "fulfillments") fetchFulfillments(fulfillFilter);
  }, [section, fulfillFilter, fetchFulfillments]);

  const fetchRegQueue = useCallback(async (status: string) => {
    setRegQueueLoading(true);
    const r = await fetch(`/api/admin/fulfillment-queue?status=${status}`);
    if (r.ok) { const d = await r.json(); setRegQueue(d.queue ?? []); }
    setRegQueueLoading(false);
  }, []);
  const fetchFinancials = useCallback(async () => {
    const r = await fetch("/api/admin/financials/summary");
    if (r.ok) { const d = await r.json(); setFinancials(d); }
  }, []);
  const fetchCatalogAdmin = useCallback(async () => {
    setCatalogLoading(true);
    const r = await fetch("/api/admin/catalog");
    if (r.ok) { const d = await r.json(); setCatalogItems(d.items ?? []); }
    setCatalogLoading(false);
  }, []);

  useEffect(() => {
    if (section === "register-queue") { fetchRegQueue(regQueueTab); fetchFinancials(); }
  }, [section, regQueueTab, fetchRegQueue, fetchFinancials]);
  useEffect(() => {
    if (section === "catalog") fetchCatalogAdmin();
  }, [section, fetchCatalogAdmin]);

  const updateUserStatus = async (userId: string, status: string) => {
    const res = await fetch(`/api/admin/users/${userId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (res.ok) { setUsers((p) => p.map((u) => u.id === userId ? { ...u, status } : u)); setToast(`User ${status.toLowerCase()}`); }
  };
  const deleteUser = async (userId: string) => {
    if (!confirm("Delete this user permanently?")) return;
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (res.ok) { setUsers((p) => p.filter((u) => u.id !== userId)); setToast("User removed"); }
  };

  const manualVerify = async (userId: string) => {
    if (!confirm("Manually verify this user? This will set phoneVerified, emailVerified, verificationLevel=2, docStatus=VERIFIED and award trust bonuses (+10 phone, +10 email, +15 doc).")) return;
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "manualVerify" }),
    });
    if (res.ok) {
      const d = await res.json();
      setUsers((p) => p.map((u) => u.id === userId ? {
        ...u,
        phoneVerified: true, emailVerified: true,
        verificationLevel: 2, docStatus: "VERIFIED",
        trustScore: d.user?.trustScore ?? u.trustScore,
      } : u));
      fetchVerif(); // refresh verification queue too
      setToast("✅ User manually verified — trust bonuses awarded");
    } else {
      setToast("Verification failed");
    }
  };

  const resetRequestLock = async (userId: string) => {
    const res = await fetch(`/api/admin/users/${userId}/reset-request-lock`, { method: "POST" });
    if (res.ok) {
      setUsers((p) => p.map((u) => u.id === userId ? { ...u, activeRequestLockedUntil: null } : u));
      setToast("Request lock cleared");
    } else {
      setToast("Failed to clear lock");
    }
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
  const reviewFlaggedPost = async (flagId: string, action: "approve" | "remove") => {
    const res = await fetch(`/api/admin/circles/flagged/${flagId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      fetchFlagged();
      setToast(action === "approve" ? "Post approved — visible in circle" : "Post removed");
    }
  };

  const assignLeader = async (circleId: string, userId: string, action: "assign" | "remove") => {
    const res = await fetch("/api/admin/circles/leaders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ circleId, userId, action }),
    });
    const d = await res.json();
    if (res.ok) { fetchCircles(); setToast(action === "assign" ? "Circle Leader assigned! 🌟" : "Leader role removed"); }
    else setToast(d.error ?? "Failed");
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

  const updateBundleInstance = async (instanceId: string, update: Record<string, string | null>) => {
    const res = await fetch(`/api/admin/bundles/${instanceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    if (res.ok) { fetchBundleInstances(); setToast("Updated"); }
    else { const d = await res.json(); setToast(d.error ?? "Failed"); }
  };

  const updateCampaign = async (campaignId: string, update: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/bundles/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "campaign", ...update }),
    });
    if (res.ok) { fetchBundleCampaigns(); setToast("Campaign updated"); }
    else { const d = await res.json(); setToast(d.error ?? "Failed"); }
  };

  const createCampaign = async () => {
    const res = await fetch("/api/admin/bundles/campaign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "campaign", ...newCampaign }),
    });
    if (res.ok) { fetchBundleCampaigns(); setShowNewCampaign(false); setNewCampaign({ title: "", description: "", totalBundles: "10", costPerBundle: "80", totalBudget: "800", targetStage: "", templateId: "" }); setToast("Campaign created!"); }
    else { const d = await res.json(); setToast(d.error ?? "Failed"); }
  };

  const createTemplate = async () => {
    let items: unknown[] = [];
    try { items = newTemplate.items.split("\n").filter(Boolean).map((l) => { const [name, quantity] = l.split("|").map((s) => s.trim()); return { name: name || l, quantity: quantity || "1" }; }); } catch {}
    const res = await fetch("/api/admin/bundles/template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "template", ...newTemplate, estimatedCost: Number(newTemplate.estimatedCost), items }),
    });
    if (res.ok) { fetchBundleTemplates(); setShowNewTemplate(false); setNewTemplate({ name: "", description: "", estimatedCost: "0", targetStage: "", items: "" }); setToast("Template created!"); }
    else { const d = await res.json(); setToast(d.error ?? "Failed"); }
  };

  const seedBundles = async () => {
    const res = await fetch("/api/admin/bundles/seed", { method: "POST" });
    const d = await res.json();
    setToast(d.message ?? "Done");
    if (!d.skipped) { fetchBundleCampaigns(); fetchBundleTemplates(); }
  };

  const createBsGoal = async () => {
    const res = await fetch("/api/admin/bundles/goal", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetBundles: Number(bsNewGoal.targetBundles), costPerBundle: Number(bsNewGoal.costPerBundle) }),
    });
    const d = await res.json();
    if (res.ok) { fetchBsGoal(); setBsShowNewGoal(false); setToast("Goal created!"); }
    else setToast(d.error ?? "Failed");
  };

  const closeGoal = async () => {
    if (!bsGoal || !confirm("Close this goal? Contributors will no longer be able to fund it.")) return;
    const res = await fetch("/api/admin/bundles/goal", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalId: bsGoal.id, status: "CLOSED" }),
    });
    if (res.ok) { fetchBsGoal(); setToast("Goal closed"); }
  };

  const allocateBundle = async () => {
    if (!bsAssignModal || !bsGoal) return;
    const res = await fetch("/api/admin/bundles/allocate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: bsAssignModal.id, bundleType: bsAssignType, goalId: bsGoal.id, notes: bsAssignNotes }),
    });
    const d = await res.json();
    if (res.ok) { fetchBsAllocations(); setBsAssignModal(null); setBsAssignNotes(""); setToast("Bundle allocated!"); }
    else setToast(d.error ?? "Failed");
  };

  const updateAllocationStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/admin/bundles/allocate/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { fetchBsAllocations(); if (status === "DISPATCHED") fetchBsGoal(); setToast(`Marked as ${status.toLowerCase()}`); }
    else { const d = await res.json(); setToast(d.error ?? "Failed"); }
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
    ["circles",      "🤝 Circles"],
    ["bundles",       "🎀 Bundles" + (stats?.bundlesPending ? ` (${stats.bundlesPending})` : "")],
    ["bundle-system",  "🎁 Bundle System"],
    ["fulfillments",   "📦 Fulfillments"],
    ["register-queue", "🛍️ Register Queue"],
    ["catalog",        "📋 Item Catalog"],
    ["abuse",          "🔍 Abuse Monitor"],
    ["coordination",   "📍 Coordination"],
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
                    [(stats.bundlesDelivered ?? 0).toString(), "Bundles Delivered"],
                    [(stats.bundlesPending ?? 0).toString(), "Bundles Pending"],
                    [(abuseKpis?.openTotal ?? "—").toString(), "Open Abuse Flags"],
                    [(abuseKpis?.openHigh ?? "—").toString(), "HIGH Severity Flags"],
                    [(abuseKpis?.riskyCount ?? "—").toString(), "Risky Users"],
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
                          {u.docStatus !== "VERIFIED" && (
                            <button className="action-btn" style={{ background: "rgba(26,122,94,0.12)", color: "var(--green)", fontWeight: 800 }} onClick={() => manualVerify(u.id)}>🔐 Verify</button>
                          )}
                          {u.activeRequestLockedUntil && new Date(u.activeRequestLockedUntil) > new Date() && (
                            <button className="action-btn" style={{ background: "rgba(245,158,11,0.12)", color: "#b45309", fontWeight: 800 }} onClick={() => resetRequestLock(u.id)}>🔓 Unlock</button>
                          )}
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

                      {/* Action buttons — show for any non-verified doc; OTP not required */}
                      {u.docStatus !== "VERIFIED" && (
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

            {/* ── CIRCLES ──────────────────────────────────────────────── */}
            {section === "circles" && (
              <div>
                {/* Circle stats */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Circles ({circles.length})</div>
                  {circles.map((c) => (
                    <div key={c.id} style={{ background: "var(--white)", borderRadius: 14, padding: "14px 16px", marginBottom: 10, boxShadow: "var(--shadow)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14 }}>{c.name}</div>
                          <div style={{ fontSize: 12, color: "var(--mid)", marginTop: 2 }}>
                            {c._count.members} members · {c._count.posts} posts
                          </div>
                        </div>
                      </div>
                      {/* Leaders */}
                      {c.members.filter((m) => m.isLeader).length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: "var(--mid)", marginBottom: 6, fontWeight: 700 }}>Circle Leaders</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {c.members.filter((m) => m.isLeader).map((m) => (
                              <div key={m.user.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--green-light)", borderRadius: 20, padding: "4px 10px" }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green)" }}>⭐ {m.user.name}</span>
                                <button onClick={() => assignLeader(c.id, m.user.id, "remove")}
                                  style={{ background: "none", border: "none", color: "var(--terra)", cursor: "pointer", fontSize: 12, padding: 0 }}>✕</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Assign leader */}
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          placeholder="User ID to make Leader"
                          value={leaderUserId[c.id] ?? ""}
                          onChange={(e) => setLeaderUserId((p) => ({ ...p, [c.id]: e.target.value }))}
                          style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, fontFamily: "Nunito, sans-serif" }}
                        />
                        <button
                          onClick={() => { if (leaderUserId[c.id]) assignLeader(c.id, leaderUserId[c.id], "assign"); }}
                          style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "var(--green)", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                        >
                          Assign Leader
                        </button>
                      </div>
                    </div>
                  ))}
                  {circles.length === 0 && !loading && (
                    <div style={{ color: "var(--mid)", fontSize: 13, padding: "20px 0" }}>No circles yet. Circles are created automatically when users add their location.</div>
                  )}
                </div>

                {/* Flagged posts queue */}
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Flagged & Reported Posts</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  {["PENDING", "APPROVED", "REMOVED"].map((s) => (
                    <button key={s} onClick={() => setFlaggedFilter(s)} style={{
                      padding: "5px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                      fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700,
                      background: flaggedFilter === s ? "var(--green)" : "var(--bg)",
                      color: flaggedFilter === s ? "white" : "var(--mid)",
                    }}>{s.charAt(0) + s.slice(1).toLowerCase()}</button>
                  ))}
                </div>

                {loading ? <div className="loading"><div className="spinner" /></div>
                  : flaggedPosts.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px 0", color: "var(--mid)" }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                      <div style={{ fontSize: 13 }}>No {flaggedFilter.toLowerCase()} posts</div>
                    </div>
                  ) : flaggedPosts.map((f) => (
                    <div key={f.id} style={{ background: "var(--white)", borderRadius: 14, padding: "14px 16px", marginBottom: 10, boxShadow: "var(--shadow)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--mid)" }}>
                            {f.post.user.name} · {f.post.circle.name}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--light)", marginTop: 2 }}>
                            {f.reason}
                            {f.post.reports.length > 0 && ` · ${f.post.reports.length} user report${f.post.reports.length > 1 ? "s" : ""}`}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--light)" }}>{new Date(f.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
                        {f.post.content}
                      </div>
                      {f.post.reports.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          {f.post.reports.map((r, i) => (
                            <div key={i} style={{ fontSize: 11, color: "var(--terra)", marginBottom: 3 }}>🚩 "{r.reason}"</div>
                          ))}
                        </div>
                      )}
                      {f.status === "PENDING" && (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => reviewFlaggedPost(f.id, "approve")} className="action-btn action-approve">✓ Approve</button>
                          <button onClick={() => reviewFlaggedPost(f.id, "remove")} className="action-btn action-remove">✕ Remove</button>
                        </div>
                      )}
                    </div>
                  ))
                }
              </div>
            )}

            {/* ── BUNDLES ──────────────────────────────────────────────── */}
            {section === "bundles" && (
              <div>
                {/* Sub-tabs */}
                <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                  {([["campaigns","📣 Campaigns"],["queue","⚡ Queue"],["all","📋 All Bundles"],["templates","📦 Templates"]] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setBundleTab(key)}
                      style={{ padding: "7px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700,
                        background: bundleTab === key ? "var(--green)" : "var(--bg)",
                        color: bundleTab === key ? "white" : "var(--mid)" }}>
                      {label}
                    </button>
                  ))}
                  <button onClick={seedBundles}
                    style={{ marginLeft: "auto", padding: "7px 16px", borderRadius: 20, border: "1.5px solid var(--border)", background: "var(--white)", cursor: "pointer", fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: "var(--mid)" }}>
                    🌱 Seed starter data
                  </button>
                </div>

                {/* ─ Campaigns tab ─ */}
                {bundleTab === "campaigns" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>Campaigns</div>
                      <button onClick={() => setShowNewCampaign((p) => !p)}
                        style={{ padding: "7px 16px", borderRadius: 20, border: "none", background: "var(--green)", color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                        + New Campaign
                      </button>
                    </div>

                    {showNewCampaign && (
                      <div style={{ background: "var(--white)", borderRadius: 14, padding: "16px", marginBottom: 16, border: "1.5px solid var(--green)" }}>
                        <div style={{ fontWeight: 800, marginBottom: 12 }}>New Campaign</div>
                        {[["title","Title"],["description","Description"],["totalBundles","Total bundles"],["costPerBundle","Cost/bundle ($)"],["totalBudget","Total budget ($)"],["targetStage","Target stage (optional)"],["templateId","Template ID"]].map(([k,l]) => (
                          <div key={k} style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--mid)", marginBottom: 3 }}>{l}</div>
                            <input value={newCampaign[k as keyof typeof newCampaign]} onChange={(e) => setNewCampaign((p) => ({ ...p, [k]: e.target.value }))}
                              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", boxSizing: "border-box" as const }} />
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                          <button onClick={createCampaign} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: "var(--green)", color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Create</button>
                          <button onClick={() => setShowNewCampaign(false)} style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "none", fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {loading ? <div className="loading"><div className="spinner" /></div>
                      : bundleCampaigns.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--mid)" }}>
                          <div style={{ fontSize: 32, marginBottom: 10 }}>🎀</div>
                          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>No campaigns yet</div>
                          <button onClick={seedBundles} style={{ padding: "9px 22px", borderRadius: 20, border: "none", background: "var(--green)", color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>🌱 Create starter campaign</button>
                        </div>
                      ) : bundleCampaigns.map((c) => (
                        <div key={c.id} style={{ background: "var(--white)", borderRadius: 14, padding: "16px", marginBottom: 12, boxShadow: "var(--shadow)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 15 }}>{c.title}</div>
                              <div style={{ fontSize: 12, color: "var(--mid)", marginTop: 2 }}>{c.sponsorName} · Template: {c.template.name}</div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20,
                              background: c.status === "ACTIVE" ? "var(--green-light)" : c.status === "PAUSED" ? "var(--yellow-light)" : "var(--bg)",
                              color: c.status === "ACTIVE" ? "var(--green)" : c.status === "PAUSED" ? "#b8860b" : "var(--mid)" }}>
                              {c.status}
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--mid)", marginBottom: 4 }}>
                              <span>{c.totalBundles - c.bundlesRemaining} claimed</span>
                              <span>{c.bundlesRemaining} / {c.totalBundles} remaining</span>
                            </div>
                            <div style={{ background: "var(--border)", borderRadius: 4, height: 6 }}>
                              <div style={{ width: `${((c.totalBundles - c.bundlesRemaining) / Math.max(c.totalBundles, 1)) * 100}%`, height: "100%", background: "var(--green)", borderRadius: 4 }} />
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                            {c.status !== "ACTIVE"   && <button onClick={() => updateCampaign(c.id, { status: "ACTIVE" })}   className="action-btn action-approve">Activate</button>}
                            {c.status === "ACTIVE"   && <button onClick={() => updateCampaign(c.id, { status: "PAUSED" })}   className="action-btn" style={{ background: "var(--yellow-light)", color: "#b8860b" }}>Pause</button>}
                            {c.status !== "COMPLETED" && <button onClick={() => updateCampaign(c.id, { status: "COMPLETED" })} className="action-btn action-remove">Complete</button>}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}

                {/* ─ Fulfillment Queue tab ─ */}
                {bundleTab === "queue" && (
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 16 }}>Fulfillment Queue — Approved bundles ready to order</div>
                    {loading ? <div className="loading"><div className="spinner" /></div>
                      : bundleInstances.filter((i) => ["REQUESTED","APPROVED"].includes(i.status)).length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--mid)" }}>
                          <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                          <div style={{ fontSize: 13 }}>Queue is clear</div>
                        </div>
                      ) : bundleInstances.filter((i) => ["REQUESTED","APPROVED"].includes(i.status)).map((inst) => (
                        <div key={inst.id} style={{ background: "var(--white)", borderRadius: 14, padding: "16px", marginBottom: 12, boxShadow: "var(--shadow)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 14 }}>{inst.recipient.name.split(" ")[0]} · {inst.template.name}</div>
                              <div style={{ fontSize: 12, color: "var(--mid)", marginTop: 2 }}>{inst.deliveryAddress?.city}, {inst.deliveryAddress?.country} · {new Date(inst.requestedAt).toLocaleDateString()}</div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: inst.status === "REQUESTED" ? "var(--yellow-light)" : "var(--green-light)", color: inst.status === "REQUESTED" ? "#b8860b" : "var(--green)" }}>{inst.status}</span>
                          </div>
                          {/* Delivery address */}
                          <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px", fontSize: 12, marginBottom: 12, lineHeight: 1.7 }}>
                            <strong>{inst.deliveryAddress?.fullName}</strong><br />
                            {inst.deliveryAddress?.address}<br />
                            {inst.deliveryAddress?.city}, {inst.deliveryAddress?.state}, {inst.deliveryAddress?.country}<br />
                            📱 {inst.deliveryAddress?.phone}
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center" }}>
                            {inst.status === "REQUESTED" && <button onClick={() => updateBundleInstance(inst.id, { status: "APPROVED" })} className="action-btn action-approve">✓ Approve</button>}
                            {["REQUESTED","APPROVED"].includes(inst.status) && (
                              <>
                                <input placeholder="Order ref" value={bundleActionData[`ref_${inst.id}`] ?? ""}
                                  onChange={(e) => setBundleActionData((p) => ({ ...p, [`ref_${inst.id}`]: e.target.value }))}
                                  style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, fontFamily: "Nunito, sans-serif", width: 120 }} />
                                <button onClick={() => updateBundleInstance(inst.id, { status: "ORDERED", orderReference: bundleActionData[`ref_${inst.id}`] ?? null })} className="action-btn action-approve">Mark Ordered</button>
                              </>
                            )}
                            {inst.status === "ORDERED" && (
                              <>
                                <input placeholder="Tracking #" value={bundleActionData[`track_${inst.id}`] ?? ""}
                                  onChange={(e) => setBundleActionData((p) => ({ ...p, [`track_${inst.id}`]: e.target.value }))}
                                  style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, fontFamily: "Nunito, sans-serif", width: 140 }} />
                                <button onClick={() => updateBundleInstance(inst.id, { status: "SHIPPED", trackingNumber: bundleActionData[`track_${inst.id}`] ?? null })} className="action-btn action-approve">Mark Shipped</button>
                              </>
                            )}
                            <button onClick={() => updateBundleInstance(inst.id, { status: "REJECTED" })} className="action-btn action-remove">Reject</button>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}

                {/* ─ All Bundles tab ─ */}
                {bundleTab === "all" && (
                  <div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" as const, alignItems: "center" }}>
                      <input className="search-bar" style={{ maxWidth: 200 }} placeholder="Search recipient…" value={instanceSearch} onChange={(e) => setInstanceSearch(e.target.value)} />
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                        {["ALL","REQUESTED","APPROVED","ORDERED","SHIPPED","COMPLETED","REJECTED"].map((s) => (
                          <button key={s} onClick={() => setInstanceFilter(s)}
                            style={{ padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700,
                              background: instanceFilter === s ? "var(--green)" : "var(--bg)",
                              color: instanceFilter === s ? "white" : "var(--mid)" }}>
                            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    {loading ? <div className="loading"><div className="spinner" /></div>
                      : (
                        <div className="admin-table">
                          <table>
                            <thead><tr><th>Recipient</th><th>Bundle</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
                            <tbody>
                              {bundleInstances.map((inst) => (
                                <tr key={inst.id}>
                                  <td><strong>{inst.recipient.name}</strong><br /><span style={{ fontSize: 11, color: "var(--mid)" }}>{inst.deliveryAddress?.city}</span></td>
                                  <td style={{ fontSize: 12 }}>{inst.template.name}</td>
                                  <td><span className={`status-pill status-${inst.status.toLowerCase()}`}>{inst.status}</span></td>
                                  <td style={{ fontSize: 12, color: "var(--mid)" }}>{new Date(inst.requestedAt).toLocaleDateString()}</td>
                                  <td>
                                    {inst.status === "SHIPPED" && <button onClick={() => updateBundleInstance(inst.id, { status: "DELIVERED" })} className="action-btn action-approve" style={{ fontSize: 11 }}>Delivered</button>}
                                    {["REQUESTED","APPROVED","ORDERED"].includes(inst.status) && <button onClick={() => updateBundleInstance(inst.id, { status: "REJECTED" })} className="action-btn action-remove" style={{ fontSize: 11 }}>Reject</button>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {bundleInstances.length === 0 && <div style={{ textAlign: "center", padding: "30px 0", color: "var(--mid)", fontSize: 13 }}>No bundles found</div>}
                        </div>
                      )
                    }
                  </div>
                )}

                {/* ─ Templates tab ─ */}
                {bundleTab === "templates" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <div style={{ fontWeight: 800, fontSize: 15 }}>Bundle Templates</div>
                      <button onClick={() => setShowNewTemplate((p) => !p)}
                        style={{ padding: "7px 16px", borderRadius: 20, border: "none", background: "var(--green)", color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                        + New Template
                      </button>
                    </div>

                    {showNewTemplate && (
                      <div style={{ background: "var(--white)", borderRadius: 14, padding: "16px", marginBottom: 16, border: "1.5px solid var(--green)" }}>
                        <div style={{ fontWeight: 800, marginBottom: 12 }}>New Template</div>
                        {[["name","Name"],["description","Description"],["estimatedCost","Estimated cost ($)"],["targetStage","Target stage (optional)"]].map(([k,l]) => (
                          <div key={k} style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--mid)", marginBottom: 3 }}>{l}</div>
                            <input value={newTemplate[k as keyof typeof newTemplate]} onChange={(e) => setNewTemplate((p) => ({ ...p, [k]: e.target.value }))}
                              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", boxSizing: "border-box" as const }} />
                          </div>
                        ))}
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--mid)", marginBottom: 3 }}>Items (one per line: Name | Quantity)</div>
                          <textarea value={newTemplate.items} onChange={(e) => setNewTemplate((p) => ({ ...p, items: e.target.value }))}
                            placeholder={"Diapers | 1 pack\nWipes | 2 packs\nOnesies | 3"}
                            rows={5} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, fontFamily: "Nunito, sans-serif", resize: "vertical", boxSizing: "border-box" as const }} />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={createTemplate} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: "var(--green)", color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Create</button>
                          <button onClick={() => setShowNewTemplate(false)} style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid var(--border)", background: "none", fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {loading ? <div className="loading"><div className="spinner" /></div>
                      : bundleTemplates.map((t) => (
                        <div key={t.id} style={{ background: "var(--white)", borderRadius: 14, padding: "16px", marginBottom: 12, boxShadow: "var(--shadow)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 14 }}>{t.name}</div>
                              <div style={{ fontSize: 12, color: "var(--mid)", marginTop: 2 }}>{t.description}</div>
                              {t.targetStage && <div style={{ fontSize: 11, color: "var(--mid)", marginTop: 2 }}>Stage: {t.targetStage}</div>}
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: t.isActive ? "var(--green)" : "var(--mid)" }}>
                              {t.isActive ? "Active" : "Inactive"} · {t._count?.instances ?? 0} used
                            </div>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
                            {(t.items as { name: string; quantity: string }[]).map((item, i) => (
                              <span key={i} style={{ fontSize: 11, background: "var(--bg)", padding: "3px 10px", borderRadius: 20, color: "var(--ink)" }}>
                                {item.name} · {item.quantity}
                              </span>
                            ))}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--mid)", marginTop: 8, fontFamily: "monospace" }}>ID: {t.id}</div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            )}

            {/* ── ABUSE MONITOR ────────────────────────────────────────── */}
            {section === "abuse" && (
              <div>
                {/* Sub-tabs */}
                <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                  {(["flags", "risky", "weekly"] as const).map(t => (
                    <button key={t} onClick={() => { setAbuseTab(t); setSelectedAbuseUser(null); }} style={{ padding: "7px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 13, background: abuseTab === t ? "#1a7a5e" : "var(--bg)", color: abuseTab === t ? "white" : "var(--mid)" }}>
                      {t === "flags" ? "Open Flags" : t === "risky" ? "Risky Users" : "Weekly Report"}
                    </button>
                  ))}
                </div>

                {/* ── User detail overlay ─── */}
                {selectedAbuseUser && (
                  <div style={{ background: "var(--white)", borderRadius: 16, padding: 20, marginBottom: 20, border: "1.5px solid #ef4444" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                      <div>
                        <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700 }}>{selectedAbuseUser.user.name}</div>
                        <div style={{ fontSize: 12, color: "var(--mid)" }}>{selectedAbuseUser.user.email} · Trust: {selectedAbuseUser.user.trustScore}</div>
                      </div>
                      <button onClick={() => setSelectedAbuseUser(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--mid)" }}>✕</button>
                    </div>

                    {/* Stats */}
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                      {[
                        ["Requests (7d)", selectedAbuseUser.stats.requestCount7d],
                        ["Requests (30d)", selectedAbuseUser.stats.requestCount30d],
                        ["Time to 1st request", selectedAbuseUser.stats.timeToFirstRequestHours !== null ? `${selectedAbuseUser.stats.timeToFirstRequestHours.toFixed(1)}h` : "N/A"],
                        ["Request:Engagement", selectedAbuseUser.stats.engagement.ratio],
                        ["Posts", selectedAbuseUser.stats.engagement.posts],
                        ["Comments", selectedAbuseUser.stats.engagement.comments],
                      ].map(([label, val]) => (
                        <div key={label as string} style={{ background: "var(--bg)", borderRadius: 10, padding: "8px 14px", textAlign: "center", minWidth: 100 }}>
                          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "#1a7a5e" }}>{val}</div>
                          <div style={{ fontSize: 11, color: "var(--mid)" }}>{label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Flags */}
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Flags ({selectedAbuseUser.flags.length})</div>
                    {selectedAbuseUser.flags.map(f => (
                      <div key={f.id} style={{ background: "var(--bg)", borderRadius: 10, padding: "10px 14px", marginBottom: 8, border: `1.5px solid ${f.severity === "HIGH" ? "#ef4444" : f.severity === "MEDIUM" ? "#f59e0b" : "#94a3b8"}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: f.severity === "HIGH" ? "#fef2f2" : f.severity === "MEDIUM" ? "#fffbeb" : "#f8fafc", color: f.severity === "HIGH" ? "#ef4444" : f.severity === "MEDIUM" ? "#d97706" : "#64748b" }}>{f.severity}</span>
                          <span style={{ fontSize: 12, fontWeight: 700 }}>{f.flagType.replace(/_/g, " ")}</span>
                          <span style={{ fontSize: 11, color: "var(--mid)", marginLeft: "auto" }}>{new Date(f.createdAt).toLocaleDateString()}</span>
                        </div>
                        <pre style={{ fontSize: 11, color: "var(--mid)", whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(f.evidence, null, 2)}</pre>
                        {f.status === "OPEN" && (
                          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                            <input placeholder="Notes (optional)" value={flagNotes[f.id] ?? ""} onChange={e => setFlagNotes(p => ({ ...p, [f.id]: e.target.value }))} style={{ flex: 1, fontSize: 12, padding: "5px 10px", border: "1px solid var(--border)", borderRadius: 8 }} />
                            {(["REVIEWED", "CLOSED", "ESCALATED"] as const).map(s => (
                              <button key={s} onClick={async () => {
                                await fetch(`/api/admin/abuse/flags/${f.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s, notes: flagNotes[f.id] }) });
                                fetchAbuseUserDetail(selectedAbuseUser.user.id);
                                setToast(`Flag marked ${s.toLowerCase()}`);
                              }} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 8, border: "none", cursor: "pointer", background: s === "ESCALATED" ? "#ef4444" : s === "CLOSED" ? "#94a3b8" : "#1a7a5e", color: "white", fontWeight: 700 }}>{s}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Event timeline (last 10) */}
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, marginTop: 12 }}>Event timeline</div>
                    <div style={{ maxHeight: 280, overflowY: "auto" }}>
                      {selectedAbuseUser.eventLog.slice(0, 10).map(e => (
                        <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                          <span style={{ color: "var(--mid)", flexShrink: 0, fontSize: 11 }}>{new Date(e.timestamp).toLocaleDateString()}</span>
                          <span style={{ fontWeight: 700, color: "var(--ink)" }}>{e.eventType.replace(/_/g, " ")}</span>
                          <span style={{ fontSize: 11, color: "var(--mid)" }}>score: {e.trustScore}</span>
                          {e.hasIpAddress && <span style={{ fontSize: 10, background: "#fef3c7", color: "#92400e", padding: "1px 6px", borderRadius: 8 }}>IP flagged</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Open Flags ─── */}
                {abuseTab === "flags" && !selectedAbuseUser && (
                  <div className="admin-table">
                    <div className="admin-table-header">
                      <div className="admin-table-title">Open Abuse Flags</div>
                      <select value={abuseSeverity} onChange={e => setAbuseSeverity(e.target.value)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}>
                        <option value="all">All severity</option>
                        <option value="high">HIGH only</option>
                        <option value="medium">MEDIUM only</option>
                        <option value="low">LOW only</option>
                      </select>
                    </div>
                    {loading ? <div className="loading"><div className="spinner" /></div> : (
                      <table>
                        <thead><tr><th>User</th><th>Flag Type</th><th>Severity</th><th>Date</th><th>Actions</th></tr></thead>
                        <tbody>{abuseFlags.length === 0 ? (
                          <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--mid)", padding: 24 }}>No open flags</td></tr>
                        ) : abuseFlags.map(f => (
                          <tr key={f.id}>
                            <td><strong>{f.user.name}</strong><br /><span style={{ fontSize: 11, color: "var(--mid)" }}>{f.user.email}</span></td>
                            <td style={{ fontSize: 12 }}>{f.flagType.replace(/_/g, " ")}</td>
                            <td><span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 20, background: f.severity === "HIGH" ? "#fef2f2" : f.severity === "MEDIUM" ? "#fffbeb" : "#f8fafc", color: f.severity === "HIGH" ? "#ef4444" : f.severity === "MEDIUM" ? "#d97706" : "#64748b" }}>{f.severity}</span></td>
                            <td style={{ color: "var(--mid)", fontSize: 12 }}>{new Date(f.createdAt).toLocaleDateString()}</td>
                            <td><button className="action-btn action-approve" onClick={() => { fetchAbuseUserDetail(f.user.id); setAbuseTab("flags"); }}>Review</button></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* ── Risky Users ─── */}
                {abuseTab === "risky" && !selectedAbuseUser && (
                  <div className="admin-table">
                    <div className="admin-table-header"><div className="admin-table-title">Risky Users (2+ flags or 1+ HIGH)</div></div>
                    {loading ? <div className="loading"><div className="spinner" /></div> : (
                      <table>
                        <thead><tr><th>User</th><th>Trust</th><th>Flag Count</th><th>Highest</th><th>Last Flagged</th><th>Actions</th></tr></thead>
                        <tbody>{riskyUsers.length === 0 ? (
                          <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--mid)", padding: 24 }}>No risky users</td></tr>
                        ) : riskyUsers.map(u => (
                          <tr key={u.id}>
                            <td><strong>{u.name}</strong><br /><span style={{ fontSize: 11, color: "var(--mid)" }}>{u.email ?? u.phone}</span></td>
                            <td><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: TRUST_BG(u.trustScore), color: TRUST_COLOR(u.trustScore) }}>{u.trustScore}</span></td>
                            <td style={{ fontWeight: 700, color: "var(--ink)" }}>{u.flagCount}</td>
                            <td>{u.hasHighFlag ? <span style={{ fontSize: 11, fontWeight: 800, color: "#ef4444" }}>HIGH</span> : <span style={{ fontSize: 11, color: "#d97706" }}>MEDIUM</span>}</td>
                            <td style={{ color: "var(--mid)", fontSize: 12 }}>{u.lastFlagged ? new Date(u.lastFlagged).toLocaleDateString() : "—"}</td>
                            <td><button className="action-btn action-approve" onClick={() => fetchAbuseUserDetail(u.id)}>Review</button></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* ── Weekly Report ─── */}
                {abuseTab === "weekly" && (
                  <div>
                    {!weeklySummary ? (
                      <div style={{ textAlign: "center", color: "var(--mid)", padding: 40 }}>No weekly summary yet. Run the cron job to generate one.</div>
                    ) : (
                      <>
                        <div className="admin-cards" style={{ marginBottom: 20 }}>
                          {[
                            [weeklySummary.totalFlags.toString(), "Total Flags"],
                            [weeklySummary.highSeverityFlags.toString(), "HIGH Severity"],
                            [weeklySummary.usersDroppedBelow60.toString(), "Dropped Below 60"],
                            [weeklySummary.rapidTrustFarmers.toString(), "Rapid Trust Farmers"],
                          ].map(([num, label]) => (
                            <div key={label} className="admin-card">
                              <div className="admin-card-num">{num}</div>
                              <div className="admin-card-label">{label}</div>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                          <div style={{ background: "var(--white)", borderRadius: 14, padding: 18, border: "1px solid var(--border)" }}>
                            <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Top Flag Types</div>
                            {weeklySummary.topFlagTypes.map(({ type, count }, i) => (
                              <div key={type} style={{ marginBottom: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                                  <span>{type.replace(/_/g, " ")}</span>
                                  <span style={{ fontWeight: 700 }}>{count}</span>
                                </div>
                                <div style={{ background: "var(--bg)", borderRadius: 4, height: 6 }}>
                                  <div style={{ width: `${Math.min(100, (count / (weeklySummary.topFlagTypes[0]?.count || 1)) * 100)}%`, height: "100%", background: "#1a7a5e", borderRadius: 4 }} />
                                </div>
                              </div>
                            ))}
                          </div>

                          <div style={{ background: "var(--white)", borderRadius: 14, padding: 18, border: "1px solid var(--border)" }}>
                            <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Top Requested Categories</div>
                            {weeklySummary.topRequestedCategories.map(({ category, count }) => (
                              <div key={category} style={{ marginBottom: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                                  <span>{category}</span>
                                  <span style={{ fontWeight: 700 }}>{count}</span>
                                </div>
                                <div style={{ background: "var(--bg)", borderRadius: 4, height: 6 }}>
                                  <div style={{ width: `${Math.min(100, (count / (weeklySummary.topRequestedCategories[0]?.count || 1)) * 100)}%`, height: "100%", background: "#1a7a5e", borderRadius: 4 }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div style={{ fontSize: 11, color: "var(--mid)", marginTop: 12, textAlign: "right" }}>
                          Week: {new Date(weeklySummary.weekStart).toLocaleDateString()} – {new Date(weeklySummary.weekEnd).toLocaleDateString()}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── BUNDLE SYSTEM ────────────────────────────────────────── */}
            {section === "bundle-system" && (
              <div>
                {/* Tabs */}
                <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                  {(["goal", "mothers", "allocations"] as const).map(t => (
                    <button key={t} onClick={() => setBsTab(t)}
                      style={{ padding: "7px 16px", borderRadius: 20, border: `1.5px solid ${bsTab === t ? "#1a7a5e" : "var(--border)"}`, background: bsTab === t ? "#e8f5f1" : "none", color: bsTab === t ? "#1a7a5e" : "var(--ink)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                      {t === "goal" ? "Goal" : t === "mothers" ? "Eligible Mothers" : "Allocations"}
                    </button>
                  ))}
                </div>

                {/* ── Tab 1: Goal ── */}
                {bsTab === "goal" && (
                  <div>
                    {bsGoal ? (
                      <>
                        <div className="admin-cards" style={{ marginBottom: 20 }}>
                          {[
                            [bsGoal.month, "Month"],
                            [bsGoal.fundedBundles.toString(), "Bundles Funded"],
                            [bsGoal.targetBundles.toString(), "Target"],
                            [bsGoal.deliveredBundles.toString(), "Delivered"],
                            [bsGoal.bundlesFundedToday.toString(), "Funded Today"],
                            [`$${(bsGoal.costPerBundle / 100).toFixed(0)}`, "Cost / Bundle"],
                            [bsGoal.allocationStats.queued.toString(), "Queued"],
                            [bsGoal.allocationStats.dispatched.toString(), "Dispatched"],
                          ].map(([num, label]) => (
                            <div key={label} className="admin-card">
                              <div className="admin-card-num">{num}</div>
                              <div className="admin-card-label">{label}</div>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                          <span style={{ padding: "4px 12px", borderRadius: 20, background: bsGoal.status === "ACTIVE" ? "#e8f5f1" : "var(--bg)", color: bsGoal.status === "ACTIVE" ? "#1a7a5e" : "var(--mid)", fontWeight: 700, fontSize: 12 }}>{bsGoal.status}</span>
                          {bsGoal.status === "ACTIVE" && (
                            <button onClick={closeGoal} style={{ padding: "4px 14px", borderRadius: 20, border: "1.5px solid #dc2626", background: "none", color: "#dc2626", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Close Goal</button>
                          )}
                        </div>

                        <div className="admin-table">
                          <div className="admin-table-header"><div className="admin-table-title">Contributions ({bsGoal.contributions.length})</div></div>
                          <table>
                            <thead><tr><th>Donor</th><th>Bundles</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                            <tbody>
                              {bsGoal.contributions.length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--mid)", padding: 24 }}>No contributions yet</td></tr>
                              ) : bsGoal.contributions.map(c => (
                                <tr key={c.id}>
                                  <td><strong>{c.donor.name}</strong><br /><span style={{ fontSize: 11, color: "var(--mid)" }}>{c.donor.email}</span></td>
                                  <td style={{ fontWeight: 700 }}>{c.bundleCount}</td>
                                  <td>${(c.amountCents / 100).toFixed(0)}</td>
                                  <td><span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: "#e8f5f1", color: "#1a7a5e", fontWeight: 700 }}>{c.status}</span></td>
                                  <td style={{ color: "var(--mid)", fontSize: 12 }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: "center", color: "var(--mid)", padding: 40, fontSize: 14 }}>No active goal this month.</div>
                    )}

                    {/* Create new goal */}
                    {!bsGoal || bsGoal.status === "CLOSED" ? (
                      <div style={{ marginTop: 20 }}>
                        {!bsShowNewGoal ? (
                          <button onClick={() => setBsShowNewGoal(true)} style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#1a7a5e", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Create New Goal</button>
                        ) : (
                          <div style={{ background: "var(--white)", borderRadius: 14, padding: 18, border: "1px solid var(--border)", maxWidth: 400 }}>
                            <div style={{ fontWeight: 700, marginBottom: 14, fontFamily: "Lora, serif" }}>New Monthly Goal</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              <div>
                                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--mid)" }}>Target Bundles</label>
                                <input type="number" value={bsNewGoal.targetBundles} onChange={e => setBsNewGoal(p => ({ ...p, targetBundles: e.target.value }))} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, marginTop: 4, boxSizing: "border-box" }} />
                              </div>
                              <div>
                                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--mid)" }}>Cost Per Bundle (cents, e.g. 4000 = $40)</label>
                                <input type="number" value={bsNewGoal.costPerBundle} onChange={e => setBsNewGoal(p => ({ ...p, costPerBundle: e.target.value }))} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, marginTop: 4, boxSizing: "border-box" }} />
                              </div>
                              <div style={{ display: "flex", gap: 10 }}>
                                <button onClick={createBsGoal} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#1a7a5e", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Create</button>
                                <button onClick={() => setBsShowNewGoal(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1.5px solid var(--border)", background: "none", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}

                {/* ── Tab 2: Eligible Mothers ── */}
                {bsTab === "mothers" && (
                  <div>
                    {!bsGoal && <div style={{ background: "#fef9c3", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#92400e", marginBottom: 16, fontWeight: 600 }}>⚠ No active goal. Create a goal first before assigning bundles.</div>}
                    <div className="admin-table">
                      <div className="admin-table-header">
                        <div className="admin-table-title">Eligible Mothers Queue ({bsMothers.length})</div>
                      </div>
                      {loading ? <div className="loading"><div className="spinner" /></div> : (
                        <table>
                          <thead><tr><th>Mother</th><th>Trust</th><th>Verification</th><th>Due Date</th><th>Wait</th><th></th></tr></thead>
                          <tbody>
                            {bsMothers.length === 0 ? (
                              <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--mid)", padding: 24 }}>No eligible mothers at this time</td></tr>
                            ) : bsMothers.map(m => {
                              const waitDays = Math.floor((Date.now() - new Date(m.createdAt).getTime()) / 86400000);
                              return (
                                <tr key={m.id}>
                                  <td>
                                    <strong>{m.name}</strong><br />
                                    <span style={{ fontSize: 11, color: "var(--mid)" }}>{m.email ?? m.phone}</span><br />
                                    <span style={{ fontSize: 10, color: "var(--mid)" }}>{m.journeyType} · {m.currentStage ?? "—"}</span>
                                  </td>
                                  <td><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: TRUST_BG(m.trustScore), color: TRUST_COLOR(m.trustScore) }}>{m.trustScore}</span></td>
                                  <td style={{ fontSize: 12 }}>{VERIFY_LABELS[m.verificationLevel] ?? m.verificationLevel}</td>
                                  <td style={{ fontSize: 12, color: "var(--mid)" }}>{m.dueDate ? new Date(m.dueDate).toLocaleDateString() : "—"}</td>
                                  <td style={{ fontSize: 12, color: "var(--mid)" }}>{waitDays}d</td>
                                  <td>
                                    <button
                                      onClick={() => { setBsAssignModal(m); setBsTab("mothers"); }}
                                      disabled={!bsGoal}
                                      className="action-btn action-approve"
                                      style={{ opacity: bsGoal ? 1 : 0.4 }}
                                    >
                                      Assign
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Assign modal */}
                    {bsAssignModal && (
                      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}
                        onClick={e => { if (e.target === e.currentTarget) setBsAssignModal(null); }}>
                        <div style={{ background: "var(--white)", borderRadius: 16, padding: 24, width: 360, maxWidth: "90vw" }}>
                          <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Assign Bundle</div>
                          <div style={{ fontSize: 13, color: "var(--mid)", marginBottom: 16 }}>Recipient: <strong>{bsAssignModal.name}</strong></div>
                          <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--mid)" }}>Bundle Type</label>
                            <select value={bsAssignType} onChange={e => setBsAssignType(e.target.value)}
                              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, marginTop: 4 }}>
                              {["Immediate Survival Kit", "Growth Kit", "Feeding Support Kit", "Hygiene & Care Kit", "Full Care Bundle",
                                "Expecting Mom Survival Kit", "Hospital / Delivery Kit", "Postpartum Recovery Kit", "Breastfeeding Support Kit", "Full Maternal Care Bundle"
                              ].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div style={{ marginBottom: 16 }}>
                            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--mid)" }}>Notes (optional)</label>
                            <textarea value={bsAssignNotes} onChange={e => setBsAssignNotes(e.target.value)} rows={2}
                              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 13, marginTop: 4, resize: "none", boxSizing: "border-box" }} />
                          </div>
                          <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={allocateBundle} style={{ flex: 1, padding: 12, borderRadius: 8, border: "none", background: "#1a7a5e", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Confirm Assign</button>
                            <button onClick={() => setBsAssignModal(null)} style={{ flex: 1, padding: 12, borderRadius: 8, border: "1.5px solid var(--border)", background: "none", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab 3: Allocations ── */}
                {bsTab === "allocations" && (
                  <div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                      {["ALL", "QUEUED", "APPROVED", "DISPATCHED", "DELIVERED"].map(s => (
                        <button key={s} onClick={() => setBsAllocFilter(s)}
                          style={{ padding: "5px 12px", borderRadius: 16, border: `1.5px solid ${bsAllocFilter === s ? "#1a7a5e" : "var(--border)"}`, background: bsAllocFilter === s ? "#e8f5f1" : "none", color: bsAllocFilter === s ? "#1a7a5e" : "var(--ink)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                          {s}
                        </button>
                      ))}
                    </div>
                    <div className="admin-table">
                      <div className="admin-table-header"><div className="admin-table-title">Allocations</div></div>
                      {loading ? <div className="loading"><div className="spinner" /></div> : (
                        <table>
                          <thead><tr><th>Recipient</th><th>Bundle Type</th><th>Month</th><th>Status</th><th>Allocated</th><th>Actions</th></tr></thead>
                          <tbody>
                            {bsAllocations.filter(a => bsAllocFilter === "ALL" || a.status === bsAllocFilter).length === 0 ? (
                              <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--mid)", padding: 24 }}>No allocations</td></tr>
                            ) : bsAllocations.filter(a => bsAllocFilter === "ALL" || a.status === bsAllocFilter).map(a => (
                              <tr key={a.id}>
                                <td><strong>{a.recipient.name}</strong><br /><span style={{ fontSize: 11, color: "var(--mid)" }}>{a.recipient.email ?? a.recipient.phone}</span></td>
                                <td style={{ fontSize: 12 }}>{a.bundleType}</td>
                                <td style={{ fontSize: 12, color: "var(--mid)" }}>{a.goal.month}</td>
                                <td>
                                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, fontWeight: 700,
                                    background: a.status === "DELIVERED" ? "#e8f5f1" : a.status === "DISPATCHED" ? "#dbeafe" : a.status === "APPROVED" ? "#fef9c3" : "var(--bg)",
                                    color: a.status === "DELIVERED" ? "#1a7a5e" : a.status === "DISPATCHED" ? "#1d4ed8" : a.status === "APPROVED" ? "#92400e" : "var(--mid)" }}>
                                    {a.status}
                                  </span>
                                </td>
                                <td style={{ fontSize: 12, color: "var(--mid)" }}>{new Date(a.allocatedAt).toLocaleDateString()}</td>
                                <td>
                                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    {a.status === "QUEUED"     && <button onClick={() => updateAllocationStatus(a.id, "APPROVED")}   className="action-btn action-approve" style={{ fontSize: 11 }}>Approve</button>}
                                    {a.status === "APPROVED"   && <button onClick={() => updateAllocationStatus(a.id, "DISPATCHED")} className="action-btn action-approve" style={{ fontSize: 11 }}>Dispatch</button>}
                                    {a.status === "DISPATCHED" && <button onClick={() => updateAllocationStatus(a.id, "DELIVERED")}  className="action-btn action-approve" style={{ fontSize: 11 }}>Delivered</button>}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── FULFILLMENTS ─────────────────────────────────────────────── */}
            {section === "fulfillments" && (
              <div>
                {/* Filter tabs */}
                <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                  {(["DISPUTED", "AUTO_CONFIRMED", "PENDING"] as const).map((s) => (
                    <button key={s} onClick={() => setFulfillFilter(s)}
                      style={{
                        padding: "7px 16px", borderRadius: 20,
                        border: `1.5px solid ${fulfillFilter === s ? "#1a7a5e" : "var(--border)"}`,
                        background: fulfillFilter === s ? "#e8f5f1" : "none",
                        color: fulfillFilter === s ? "#1a7a5e" : "var(--ink)",
                        fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif",
                      }}>
                      {s === "DISPUTED" ? "⚠️ Disputed" : s === "AUTO_CONFIRMED" ? "🔄 Auto-confirmed" : "⏳ Pending"}
                    </button>
                  ))}
                </div>

                {loading ? (
                  <div style={{ textAlign: "center", padding: 40 }}><div className="spinner" /></div>
                ) : fulfillments.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--mid)", padding: "32px 0", fontFamily: "Nunito, sans-serif" }}>
                    No {fulfillFilter.toLowerCase().replace("_", "-")} fulfillments.
                  </div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Donor</th>
                        <th>Recipient</th>
                        <th>Donor note</th>
                        <th>Marked</th>
                        <th>Responded</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fulfillments.map((f) => (
                        <tr key={f.id}>
                          <td style={{ fontWeight: 700, fontSize: 12 }}>
                            {f.itemTitle}
                            <div style={{ fontSize: 11, color: "var(--mid)", fontWeight: 400 }}>{f.itemCategory}</div>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {f.donor.name}
                            {f.donor.email && <div style={{ fontSize: 11, color: "var(--mid)" }}>{f.donor.email}</div>}
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {f.recipient.name}
                            {f.recipient.email && <div style={{ fontSize: 11, color: "var(--mid)" }}>{f.recipient.email}</div>}
                          </td>
                          <td style={{ fontSize: 11, maxWidth: 180, color: "var(--mid)" }}>
                            {f.donorNote ?? <span style={{ fontStyle: "italic" }}>—</span>}
                            {f.donorPhotoUrl && (
                              <a href={f.donorPhotoUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: 11, color: "#1a7a5e", marginTop: 2 }}>View photo</a>
                            )}
                          </td>
                          <td style={{ fontSize: 11, color: "var(--mid)", whiteSpace: "nowrap" }}>
                            {new Date(f.markedAt).toLocaleDateString()}
                          </td>
                          <td style={{ fontSize: 11, color: "var(--mid)", whiteSpace: "nowrap" }}>
                            {f.respondedAt ? new Date(f.respondedAt).toLocaleDateString() : f.autoConfirmedAt ? `Auto: ${new Date(f.autoConfirmedAt).toLocaleDateString()}` : "—"}
                          </td>
                          <td>
                            <span className={`status-pill status-${f.status.toLowerCase()}`}
                              style={{
                                background: f.status === "DISPUTED" ? "#fdecea" : f.status === "VERIFIED" ? "#e8f5f1" : f.status === "AUTO_CONFIRMED" ? "#f0f4ff" : "#fff8e6",
                                color: f.status === "DISPUTED" ? "#c0392b" : f.status === "VERIFIED" ? "#1a7a5e" : f.status === "AUTO_CONFIRMED" ? "#3b5bdb" : "#b8860b",
                                fontWeight: 700, fontSize: 10, padding: "2px 8px", borderRadius: 20,
                              }}>
                              {f.status.replace("_", " ")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── REGISTER FULFILLMENT QUEUE ──────────────────────────────── */}
            {section === "register-queue" && (
              <div>
                {/* Financial summary */}
                {financials && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
                    {[
                      { label: "Funded this month", value: `$${((financials.totalFundedCents) / 100).toFixed(0)}`, color: "#1a7a5e" },
                      { label: "Spent this month",  value: `$${((financials.totalSpentCents)  / 100).toFixed(0)}`, color: "#d97706" },
                      { label: "Surplus",           value: `$${((financials.surplusCents)     / 100).toFixed(0)}`, color: financials.surplusCents >= 0 ? "#1a7a5e" : "#c0392b" },
                      { label: "Items in queue",    value: String(financials.itemsInQueue),                        color: "#1a7a5e" },
                      { label: "Fulfilled (month)", value: String(financials.itemsFulfilledThisMonth),             color: "#1a7a5e" },
                    ].map((s) => (
                      <div key={s.label} style={{ background: "var(--white)", borderRadius: 12, padding: "12px 14px", border: "1.5px solid var(--border)" }}>
                        <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>{s.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: "Lora, serif" }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sub-tabs */}
                <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                  {(["QUEUED", "PURCHASED", "DISPATCHED", "DELIVERED"] as const).map((s) => (
                    <button key={s} onClick={() => setRegQueueTab(s)}
                      style={{
                        padding: "7px 16px", borderRadius: 20,
                        border: `1.5px solid ${regQueueTab === s ? "#1a7a5e" : "var(--border)"}`,
                        background: regQueueTab === s ? "#e8f5f1" : "none",
                        color: regQueueTab === s ? "#1a7a5e" : "var(--ink)",
                        fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif",
                      }}>
                      {s === "QUEUED" ? "⏳ Queued" : s === "PURCHASED" ? "🛒 Purchased" : s === "DISPATCHED" ? "🚚 Dispatched" : "✅ Delivered"}
                    </button>
                  ))}
                </div>

                {regQueueLoading ? (
                  <div style={{ textAlign: "center", padding: 40 }}><div className="spinner" /></div>
                ) : regQueue.filter((e) => e.status === regQueueTab).length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--mid)", padding: "32px 0", fontFamily: "Nunito, sans-serif" }}>
                    No items in {regQueueTab.toLowerCase()} status.
                  </div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Register</th>
                        <th>Mother</th>
                        <th>Funded</th>
                        <th>{regQueueTab === "PURCHASED" ? "Supplier / Cost" : regQueueTab === "DISPATCHED" ? "Tracking" : "Date"}</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regQueue.filter((e) => e.status === regQueueTab).map((entry) => (
                        <tr key={entry.id}>
                          <td style={{ fontWeight: 700, fontSize: 12 }}>
                            {entry.registerItem.name}
                            <div style={{ fontSize: 11, color: "var(--mid)", fontWeight: 400 }}>{entry.registerItem.category} · Qty: {entry.registerItem.quantity}</div>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {entry.registerItem.register.title}
                            <div style={{ fontSize: 11, color: "var(--mid)" }}>{entry.registerItem.register.city}</div>
                          </td>
                          <td style={{ fontSize: 12 }}>
                            {entry.registerItem.register.creator.name.split(" ")[0]}
                            <div style={{ fontSize: 11, color: "var(--mid)" }}>{entry.registerItem.register.creator.location}</div>
                          </td>
                          <td style={{ fontSize: 12, fontWeight: 700, color: "#1a7a5e" }}>
                            ${(entry.totalFundedCents / 100).toFixed(0)}
                          </td>
                          <td style={{ fontSize: 11, color: "var(--mid)" }}>
                            {regQueueTab === "QUEUED" && new Date(entry.queuedAt).toLocaleDateString()}
                            {regQueueTab === "PURCHASED" && (
                              <>{entry.purchasedFrom ?? "—"}<br/>{entry.actualCostCents ? `$${(entry.actualCostCents / 100).toFixed(0)}` : "—"}</>
                            )}
                            {regQueueTab === "DISPATCHED" && (entry.trackingRef ?? "—")}
                            {regQueueTab === "DELIVERED" && (entry.deliveredAt ? new Date(entry.deliveredAt).toLocaleDateString() : "—")}
                          </td>
                          <td>
                            {regQueueTab === "QUEUED" && (
                              <button
                                onClick={() => { setRegQueueModal({ id: entry.id, name: entry.registerItem.name, nextStatus: "PURCHASED" }); setRegQueueForm({}); }}
                                style={{ fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8, border: "none", background: "#1a7a5e", color: "white", cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                                Mark Purchased
                              </button>
                            )}
                            {regQueueTab === "PURCHASED" && (
                              <button
                                onClick={() => { setRegQueueModal({ id: entry.id, name: entry.registerItem.name, nextStatus: "DISPATCHED" }); setRegQueueForm({}); }}
                                style={{ fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8, border: "none", background: "#d97706", color: "white", cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                                Mark Dispatched
                              </button>
                            )}
                            {regQueueTab === "DISPATCHED" && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Mark "${entry.registerItem.name}" as delivered?`)) return;
                                  await fetch(`/api/admin/fulfillment-queue/${entry.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "DELIVERED" }) });
                                  fetchRegQueue(regQueueTab);
                                  setToast("Marked as delivered!");
                                }}
                                style={{ fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8, border: "none", background: "#1a7a5e", color: "white", cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                                Mark Delivered
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Purchase / Dispatch modal */}
                {regQueueModal && (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                    <div style={{ background: "white", borderRadius: 16, padding: 24, maxWidth: 400, width: "100%" }}>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, marginBottom: 16 }}>
                        {regQueueModal.nextStatus === "PURCHASED" ? "Mark as Purchased" : "Mark as Dispatched"}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--mid)", marginBottom: 16, fontFamily: "Nunito, sans-serif" }}>
                        {regQueueModal.name}
                      </div>
                      {regQueueModal.nextStatus === "PURCHASED" && (
                        <>
                          <div className="form-group">
                            <label className="form-label">Supplier name</label>
                            <input className="form-input" placeholder="e.g. Jumia, Amazon" value={regQueueForm.purchasedFrom ?? ""} onChange={(e) => setRegQueueForm((p) => ({ ...p, purchasedFrom: e.target.value }))} />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Actual cost ($)</label>
                            <input className="form-input" type="number" placeholder="e.g. 35" value={regQueueForm.actualCost ?? ""} onChange={(e) => setRegQueueForm((p) => ({ ...p, actualCost: e.target.value }))} />
                          </div>
                        </>
                      )}
                      {regQueueModal.nextStatus === "DISPATCHED" && (
                        <div className="form-group">
                          <label className="form-label">Tracking reference</label>
                          <input className="form-input" placeholder="e.g. JM123456789NG" value={regQueueForm.trackingRef ?? ""} onChange={(e) => setRegQueueForm((p) => ({ ...p, trackingRef: e.target.value }))} />
                        </div>
                      )}
                      <div className="form-group">
                        <label className="form-label">Notes (optional)</label>
                        <input className="form-input" placeholder="Internal notes" value={regQueueForm.notes ?? ""} onChange={(e) => setRegQueueForm((p) => ({ ...p, notes: e.target.value }))} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setRegQueueModal(null)} className="btn-clear" style={{ flex: 1 }}>Cancel</button>
                        <button
                          onClick={async () => {
                            const body: Record<string, unknown> = { status: regQueueModal.nextStatus };
                            if (regQueueForm.purchasedFrom) body.purchasedFrom = regQueueForm.purchasedFrom;
                            if (regQueueForm.actualCost) body.actualCostCents = Math.round(parseFloat(regQueueForm.actualCost) * 100);
                            if (regQueueForm.trackingRef) body.trackingRef = regQueueForm.trackingRef;
                            if (regQueueForm.notes) body.notes = regQueueForm.notes;
                            await fetch(`/api/admin/fulfillment-queue/${regQueueModal.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                            setRegQueueModal(null);
                            fetchRegQueue(regQueueTab);
                            setToast(`Marked as ${regQueueModal.nextStatus.toLowerCase()}!`);
                          }}
                          className="btn-apply" style={{ flex: 2 }}>
                          Confirm
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── CATALOG MANAGEMENT ─────────────────────────────────────── */}
            {section === "catalog" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700 }}>Item Catalog</div>
                  <button
                    onClick={() => setEditingCatalog({ id: "", name: "", category: "", standardPriceCents: 0, description: null, isActive: true, createdAt: "", _count: { registerItems: 0 } })}
                    style={{ background: "var(--green)", color: "white", border: "none", borderRadius: 20, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                    + Add item
                  </button>
                </div>

                {catalogLoading ? (
                  <div style={{ textAlign: "center", padding: 40 }}><div className="spinner" /></div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Used</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalogItems.map((c) => (
                        <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.5 }}>
                          <td style={{ fontWeight: 700, fontSize: 12 }}>{c.name}</td>
                          <td style={{ fontSize: 12, color: "var(--mid)" }}>{c.category}</td>
                          <td style={{ fontSize: 12, fontWeight: 700, color: "#1a7a5e" }}>${(c.standardPriceCents / 100).toFixed(0)}</td>
                          <td style={{ fontSize: 12, color: "var(--mid)" }}>{c._count.registerItems}</td>
                          <td>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: c.isActive ? "#e8f5f1" : "#f3f4f6", color: c.isActive ? "#1a7a5e" : "var(--mid)" }}>
                              {c.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => setEditingCatalog(c)}
                              style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8, border: "1.5px solid var(--border)", background: "none", cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                              Edit
                            </button>
                            <button
                              onClick={async () => {
                                await fetch("/api/admin/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, name: c.name, category: c.category, standardPriceCents: c.standardPriceCents, isActive: !c.isActive }) });
                                fetchCatalogAdmin();
                                setToast(c.isActive ? "Item deactivated" : "Item activated");
                              }}
                              style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8, border: "1.5px solid var(--border)", background: "none", cursor: "pointer", fontFamily: "Nunito, sans-serif", color: c.isActive ? "var(--terra)" : "var(--green)" }}>
                              {c.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Add/Edit modal */}
                {editingCatalog !== null && (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                    <div style={{ background: "white", borderRadius: 16, padding: 24, maxWidth: 400, width: "100%" }}>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, marginBottom: 16 }}>
                        {editingCatalog.id ? "Edit item" : "Add new item"}
                      </div>
                      <div className="form-group">
                        <label className="form-label">Item name</label>
                        <input className="form-input" value={editingCatalog.name} onChange={(e) => setEditingCatalog((p) => p ? { ...p, name: e.target.value } : p)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Category</label>
                        <select className="form-input" value={editingCatalog.category} onChange={(e) => setEditingCatalog((p) => p ? { ...p, category: e.target.value } : p)} style={{ fontFamily: "Nunito, sans-serif" }}>
                          {["Feeding/Diapering", "Clothing", "Hygiene", "Maternity", "Other"].map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Standard price ($)</label>
                        <input className="form-input" type="number" value={editingCatalog.standardPriceCents / 100} onChange={(e) => setEditingCatalog((p) => p ? { ...p, standardPriceCents: Math.round(parseFloat(e.target.value) * 100) } : p)} />
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button onClick={() => setEditingCatalog(null)} className="btn-clear" style={{ flex: 1 }}>Cancel</button>
                        <button
                          onClick={async () => {
                            if (!editingCatalog.name || !editingCatalog.category) { setToast("Name and category required"); return; }
                            await fetch("/api/admin/catalog", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: editingCatalog.id || undefined,
                                name: editingCatalog.name,
                                category: editingCatalog.category,
                                standardPriceCents: editingCatalog.standardPriceCents,
                                isActive: editingCatalog.isActive,
                              }),
                            });
                            setEditingCatalog(null);
                            fetchCatalogAdmin();
                            setToast("Catalog updated!");
                          }}
                          className="btn-apply" style={{ flex: 2 }}>
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── COORDINATION ─────────────────────────────────────────────── */}
            {section === "coordination" && (
              <CoordinationAdmin />
            )}

          </div>
        </div>
      </div>

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}

// ── Admin Coordination Component ─────────────────────────────────────────────

const COORD_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PENDING:            { bg: "#fff8e6", color: "#b8860b" },
  LOCATION_CONFIRMED: { bg: "#e8f5f1", color: "#1a7a5e" },
  TIME_PROPOSED:      { bg: "#e3f2fd", color: "#1565c0" },
  SCHEDULED:          { bg: "#e8f5f1", color: "#1a7a5e" },
  DONOR_READY:        { bg: "#e8f5f1", color: "#1a7a5e" },
  DELIVERED:          { bg: "#e8f5f1", color: "#1a7a5e" },
  CONFIRMED:          { bg: "#e8f5f1", color: "#1a7a5e" },
  CANCELLED:          { bg: "#fdecea", color: "#c0392b" },
  REPORTED:           { bg: "#fff3e0", color: "#d97706" },
};

const COORD_MSG_LABELS: Record<string, string> = {
  IM_HERE: "I'm here", RUNNING_LATE: "Running late", ON_MY_WAY: "On my way",
  CANT_MAKE_IT: "Can't make it", PICKUP_COMPLETE: "Pickup complete", CUSTOM: "(custom)",
};

interface AdminCoord {
  id: string; status: string; createdAt: string;
  proposedTime: string | null; confirmedTime: string | null;
  cancelReason: string | null;
  request: {
    item: { id: string; title: string };
    requester: { id: string; name: string; email: string | null };
  };
  location: { name: string; city: string; type: string } | null;
  messages: { id: string; messageType: string; content: string | null; sender: { id: string; name: string }; createdAt: string }[];
  reports: { id: string; reason: string; notes: string | null; reviewed: boolean; createdAt: string }[];
  _count: { reports: number; messages: number };
}

function CoordinationAdmin() {
  const [coordinations, setCoordinations] = useState<AdminCoord[]>([]);
  const [loading, setLoading]             = useState(true);
  const [statusFilter, setStatusFilter]   = useState("");
  const [reportedOnly, setReportedOnly]   = useState(false);
  const [expanded, setExpanded]           = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (reportedOnly) params.set("reported", "1");
    const res = await fetch(`/api/admin/coordination?${params}`);
    if (res.ok) {
      const d = await res.json();
      setCoordinations(d.coordinations ?? []);
    }
    setLoading(false);
  }, [statusFilter, reportedOnly]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const statuses = ["PENDING","LOCATION_CONFIRMED","TIME_PROPOSED","SCHEDULED","DONOR_READY","DELIVERED","CONFIRMED","CANCELLED","REPORTED"];

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 13, fontFamily: "Nunito, sans-serif", background: "white", cursor: "pointer" }}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontFamily: "Nunito, sans-serif", cursor: "pointer" }}>
          <input type="checkbox" checked={reportedOnly} onChange={(e) => setReportedOnly(e.target.checked)} />
          Reported only
        </label>
        <div style={{ fontSize: 13, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginLeft: "auto" }}>
          {coordinations.length} coordination{coordinations.length !== 1 ? "s" : ""}
        </div>
      </div>

      {loading ? (
        <div className="loading" style={{ marginTop: 40 }}><div className="spinner" /></div>
      ) : coordinations.length === 0 ? (
        <div className="empty"><div className="empty-title">No coordinations found</div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {coordinations.map((c) => {
            const sc = COORD_STATUS_COLORS[c.status] ?? { bg: "#f5f5f5", color: "#555" };
            const isExpanded = expanded === c.id;
            return (
              <div key={c.id} style={{ background: "var(--white)", borderRadius: 14, border: "1.5px solid var(--border)", overflow: "hidden" }}>
                {/* Row */}
                <div
                  onClick={() => setExpanded(isExpanded ? null : c.id)}
                  style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 12, padding: "14px 16px", cursor: "pointer", alignItems: "center" }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", marginBottom: 2 }}>{c.request.item.title}</div>
                    <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>{c.request.requester.name} · {c.location?.city ?? "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>{c.location?.name ?? "—"}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: sc.bg, color: sc.color, fontFamily: "Nunito, sans-serif" }}>
                      {c.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                    {c._count.reports > 0 && <span style={{ color: "#d97706", fontWeight: 700 }}>⚑ {c._count.reports} report{c._count.reports !== 1 ? "s" : ""}</span>}
                    {c._count.reports === 0 && <span>{c._count.messages} msg{c._count.messages !== 1 ? "s" : ""}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--mid)" }}>{isExpanded ? "▲" : "▼"}</div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px", background: "var(--bg)" }}>
                    {/* Reports */}
                    {c.reports.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#d97706", fontFamily: "Nunito, sans-serif", marginBottom: 8 }}>Reports</div>
                        {c.reports.map((r) => (
                          <div key={r.id} style={{ background: "#fff3e0", borderRadius: 10, padding: "8px 12px", marginBottom: 6, fontSize: 12, fontFamily: "Nunito, sans-serif" }}>
                            <span style={{ fontWeight: 700 }}>{r.reason.replace(/_/g, " ")}</span>
                            {r.notes && <span style={{ color: "var(--mid)", marginLeft: 8 }}>{r.notes}</span>}
                            {r.reviewed && <span style={{ marginLeft: 8, color: "#1a7a5e", fontWeight: 700 }}>✓ Reviewed</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Messages */}
                    {c.messages.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--ink)", fontFamily: "Nunito, sans-serif", marginBottom: 8 }}>Message history</div>
                        {c.messages.map((m) => (
                          <div key={m.id} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--mid)", fontFamily: "Nunito, sans-serif", minWidth: 80 }}>{m.sender.name.split(" ")[0]}</span>
                            <span style={{ fontSize: 12, fontFamily: "Nunito, sans-serif", color: "var(--ink)" }}>
                              {m.messageType === "CUSTOM" ? m.content : COORD_MSG_LABELS[m.messageType]}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--light)", fontFamily: "Nunito, sans-serif", marginLeft: "auto" }}>
                              {new Date(m.createdAt).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {c.confirmedTime && (
                      <div style={{ marginTop: 10, fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                        Scheduled: {new Date(c.confirmedTime).toLocaleString("en")}
                      </div>
                    )}
                    {c.cancelReason && (
                      <div style={{ marginTop: 6, fontSize: 12, color: "#c0392b", fontFamily: "Nunito, sans-serif" }}>
                        Cancelled: {c.cancelReason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
