"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import Toast from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ──────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string; name: string; email: string | null; phone: string | null;
  role: string; status: string; isPremium: boolean;
  trustRating: number; trustScore: number;
  verificationLevel: number; phoneVerified: boolean; emailVerified: boolean;
  docStatus: string | null; createdAt: string;
  activeRequestLockedUntil: string | null;
  accountHold: boolean; accountHoldReason: string | null; accountHoldAt: string | null;
  _count: { items: number; requests: number };
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
  status: string;
}

interface Stats {
  totalItems: number; activeItems: number; totalUsers: number; activeUsers: number;
  totalRequests: number; fulfilledRequests: number; fulfilmentRate: number;
  pendingReports: number; verifiedUsers: number; lowTrustUsers: number;
  pendingOverrides: number; totalRegisters: number; pendingDocuments: number;
  bundlesDelivered: number; bundlesPending: number;
}


interface VerifUser {
  id: string; name: string; email: string | null; phone: string | null; avatar: string | null;
  docStatus: string; documentUrl: string | null; documentType: string | null;
  documentNote: string | null; verifiedAt: string | null; createdAt: string;
  phoneVerified: boolean; emailVerified: boolean;
}

interface ManualReviewUser {
  id: string; name: string; email: string | null; phone: string | null; avatar: string | null;
  phoneVerified: boolean; emailVerified: boolean;
  manualReviewStatus: string; manualReviewSubmittedAt: string | null;
  manualReviewRejectionReason: string | null; createdAt: string;
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

type Section = "overview" | "users" | "listings" | "reports" | "trust" | "verification" | "circles" | "abuse" | "fulfillments" | "register-queue" | "catalog" | "coordination" | "approvals" | "refunds" | "bundle-apps" | "register-suggestions" | "impact";

interface LifetimeImpact {
  firstActionDate: string | null;
  venn: {
    totalMothersInNeed: number;
    bundles:      { helped: number; percent: number };
    registers:    { helped: number; percent: number };
    discover:     { helped: number; percent: number };
    allThreeAreas:{ helped: number; percent: number };
  };
  channels: {
    bundles:   { delivered: number; momsReached: number; total: number };
    registers: { delivered: number; momsReached: number; total: number };
    discover:  { fulfilled: number; momsReached: number; total: number };
  };
  trend: Array<{ month: string; bundles: number; registers: number; discover: number; total: number }>;
  topTeams: Array<{ id: string; missionName: string; month: string; memberCount: number; lifetimeEssentials: number; tier: number }>;
  fulfillmentRates: {
    bundles: number; registers: number; discover: number;
    bundlesTotal: number; registersTotal: number; discoverTotal: number;
  };
  totals: { momsServed: number; contributors: number; essentials: number; missions: number };
}

interface SuggestionGroup {
  id: string; itemName: string; category: string; notes: string | null;
  status: string; createdAt: string; suggestedByCount: number;
  similarSuggestions: { id: string; notes: string | null; createdAt: string }[];
}

interface BundleCatalogueAdmin {
  id: string; code: string; name: string; stage: string; description: string;
  estimatedValue: number; slotsPerMonth: number; isActive: boolean;
  sponsorName: string | null; sponsorUrl: string | null;
  totalApplications: number; monthPending: number; monthApproved: number;
  slotsUsed: number; slotsRemaining: number;
}

interface BundleApplicationAdmin {
  id: string; bundleId: string; fullName: string; phone: string;
  city: string; province: string; dueDate: string | null; babyDob: string | null;
  story: string; streetAddress: string; unit: string | null; postalCode: string;
  status: string; adminNote: string | null; reviewedAt: string | null;
  createdAt: string;
  bundle: { id: string; code: string; name: string; stage: string; itemCount: number };
  userEmail: string | null;
  currentStage: string | null;
  lifetimeApproved: number;
  daysSince: number;
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

interface AwaitingAddressEntry {
  id: string; name: string; updatedAt: string;
  register: { id: string; creatorId: string; city: string | null; creator: { id: string; name: string } };
}

interface Financials {
  month: string; totalFundedCents: number; totalSpentCents: number; surplusCents: number;
  itemsInQueue: number; itemsFulfilledThisMonth: number; allTimeFundedCents: number;
}

interface CatalogAdminEntry {
  id: string; sku: string; name: string; category: string;
  standardPriceCents: number;
  description: string | null; imageUrl: string | null;
  preferredVendor: string | null; preferredVendorUrl: string | null;
  substituteNote: string | null; ageStage: string | null;
  requiresSize: boolean; requiresApproval: boolean; isActive: boolean;
  lastVerifiedAt: string | null; createdAt: string; updatedAt: string;
  _count: { registerItems: number };
}

interface PendingApproval {
  id: string; name: string; category: string; quantity: string; note: string | null; createdAt: string;
  catalogItem: { id: string; name: string; sku: string; requiresApproval: boolean } | null;
  register: { id: string; title: string; city: string; creator: { id: string; name: string } };
}

interface AdminRefundEntry {
  id: string; amountCents: number; createdAt: string; stripePaymentIntentId: string | null;
  donor: { name: string; email: string | null };
  registerItem: { name: string; register: { title: string; creator: { name: string } } };
}

function catalogStalePill(lastVerifiedAt: string | null): { label: string; color: string; bg: string } {
  if (!lastVerifiedAt) return { label: "Verify needed", color: "#c0392b", bg: "#fee2e2" };
  const days = Math.floor((Date.now() - new Date(lastVerifiedAt).getTime()) / 86_400_000);
  if (days <= 7)  return { label: days === 0 ? "Verified today" : `Verified ${days}d ago`, color: "#1a7a5e", bg: "#e8f5f1" };
  if (days <= 30) return { label: `Verified ${days}d ago`, color: "#d97706", bg: "#fef3c7" };
  return { label: `Verified ${days}d ago`, color: "#c0392b", bg: "#fee2e2" };
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
  const [mrUsers,    setMrUsers]    = useState<ManualReviewUser[]>([]);
  const [mrFilter,   setMrFilter]   = useState("PENDING");
  const [mrNote,     setMrNote]     = useState<Record<string, string>>({});
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
  const [regQueueTab,          setRegQueueTab]          = useState<"AWAITING_ADDRESS" | "QUEUED" | "PURCHASED" | "DISPATCHED" | "DELIVERED">("AWAITING_ADDRESS");
  const [regQueue,             setRegQueue]             = useState<RegQueueEntry[]>([]);
  const [awaitingAddressItems, setAwaitingAddressItems] = useState<AwaitingAddressEntry[]>([]);
  const [regQueueLoading,      setRegQueueLoading]      = useState(false);
  const [regQueueModal,        setRegQueueModal]        = useState<{ id: string; name: string; nextStatus: string } | null>(null);
  const [regQueueForm,         setRegQueueForm]         = useState<Record<string, string>>({});
  const [financials,         setFinancials]         = useState<Financials | null>(null);

  // Catalog management state
  const [catalogItems,         setCatalogItems]         = useState<CatalogAdminEntry[]>([]);
  const [catalogLoading,       setCatalogLoading]       = useState(false);
  const [editingCatalog,       setEditingCatalog]       = useState<CatalogAdminEntry | null>(null);
  const [catalogImgUploading,  setCatalogImgUploading]  = useState(false);
  const [newCatalogForm,       setNewCatalogForm]       = useState({ name: "", category: "", standardPriceCents: "" });

  // Register item approvals state
  const [pendingApprovals,     setPendingApprovals]     = useState<PendingApproval[]>([]);
  const [approvalsLoading,     setApprovalsLoading]     = useState(false);
  const [rejectReasonMap,      setRejectReasonMap]      = useState<Record<string, string>>({});
  const [showRejectModal,      setShowRejectModal]      = useState<string | null>(null);

  // Refunds state
  const [refunds,       setRefunds]       = useState<AdminRefundEntry[]>([]);
  const [confirmRefund, setConfirmRefund] = useState<AdminRefundEntry | null>(null);

  // Bundle applications state (Phase 9)
  const [bundleAppCatalogue,    setBundleAppCatalogue]    = useState<BundleCatalogueAdmin[]>([]);
  const [bundleAppCatalogueLoading, setBundleAppCatalogueLoading] = useState(false);
  const [bundleApps,            setBundleApps]            = useState<BundleApplicationAdmin[]>([]);
  const [bundleAppsLoading,     setBundleAppsLoading]     = useState(false);
  const [bundleAppsFilter,      setBundleAppsFilter]      = useState<"PENDING" | "APPROVED" | "REJECTED" | "WAITLISTED">("PENDING");
  const [bundleAppsView,        setBundleAppsView]        = useState<"catalogue" | "applications">("catalogue");
  const [bundleAppsTotal,       setBundleAppsTotal]       = useState(0);
  const [appNoteMap,            setAppNoteMap]            = useState<Record<string, string>>({});
  const [expandedAppId,         setExpandedAppId]         = useState<string | null>(null);
  const [sponsorEditId,         setSponsorEditId]         = useState<string | null>(null);
  const [sponsorNameDraft,      setSponsorNameDraft]      = useState("");
  const [sponsorUrlDraft,       setSponsorUrlDraft]       = useState("");
  const [sponsorSaveError,      setSponsorSaveError]      = useState<string | null>(null);

  // Fulfillments state
  const [fulfillments,      setFulfillments]      = useState<AdminFulfillment[]>([]);
  const [fulfillFilter,     setFulfillFilter]     = useState<"DISPUTED" | "AUTO_CONFIRMED" | "PENDING">("DISPUTED");

  // Impact state
  const [impactData,        setImpactData]        = useState<LifetimeImpact | null>(null);
  const [impactLoading,     setImpactLoading]     = useState(false);

  // Register suggestions state
  const [suggestions,       setSuggestions]       = useState<SuggestionGroup[]>([]);
  const [suggestionFilter,  setSuggestionFilter]  = useState<"pending" | "promoted" | "declined" | "all">("pending");
  const [suggestLoading,    setSuggestLoading]    = useState(false);
  const [promotingId,       setPromotingId]       = useState<string | null>(null);
  const [promoteForm,       setPromoteForm]       = useState({ sku: "", name: "", category: "", standardPriceCents: "", description: "" });
  const [promoteError,      setPromoteError]      = useState<string | null>(null);
  const [expandedSuggest,   setExpandedSuggest]   = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "ADMIN")) router.push("/");
  }, [user, authLoading, router]);

  const fetchStats    = useCallback(async () => { const r = await fetch("/api/admin/stats"); if (r.ok) { const d = await r.json(); setStats(d.stats); setRecentActivity(d.recentActivity ?? []); } }, []);
  const fetchUsers    = useCallback(async () => { setLoading(true); const r = await fetch(`/api/admin/users?search=${encodeURIComponent(userSearch)}`); if (r.ok) { const d = await r.json(); setUsers(d.users ?? []); } setLoading(false); }, [userSearch]);
  const fetchItems    = useCallback(async () => { setLoading(true); const r = await fetch(`/api/admin/items?search=${encodeURIComponent(itemSearch)}`); if (r.ok) { const d = await r.json(); setItems(d.items ?? []); } setLoading(false); }, [itemSearch]);
  const fetchReports  = useCallback(async () => { setLoading(true); const r = await fetch(`/api/admin/reports?status=${reportFilter}`); if (r.ok) { const d = await r.json(); setReports(d.reports ?? []); } setLoading(false); }, [reportFilter]);
  const fetchTrust    = useCallback(async () => { setLoading(true); const r = await fetch("/api/admin/trust"); if (r.ok) { const d = await r.json(); setTrustUsers(d.users ?? []); } setLoading(false); }, []);
  const fetchVerif    = useCallback(async () => { setLoading(true); const r = await fetch(`/api/admin/verification?status=${verifFilter}`); if (r.ok) { const d = await r.json(); setVerifUsers(d.users ?? []); } setLoading(false); }, [verifFilter]);
  const fetchMrQueue  = useCallback(async () => { const r = await fetch(`/api/admin/verification/manual-review?status=${mrFilter}`); if (r.ok) { const d = await r.json(); setMrUsers(d.users ?? []); } }, [mrFilter]);
  const fetchCircles  = useCallback(async () => { setLoading(true); const r = await fetch("/api/admin/circles"); if (r.ok) { const d = await r.json(); setCircles(d.circles ?? []); } setLoading(false); }, []);
  const fetchFlagged  = useCallback(async () => { setLoading(true); const r = await fetch(`/api/admin/circles/flagged?status=${flaggedFilter}`); if (r.ok) { const d = await r.json(); setFlaggedPosts(d.flagged ?? []); } setLoading(false); }, [flaggedFilter]);
  const fetchAbuseFlags   = useCallback(async () => { setLoading(true); const sev = abuseSeverity !== "all" ? `&severity=${abuseSeverity.toUpperCase()}` : ""; const r = await fetch(`/api/admin/abuse/flags?status=OPEN${sev}`); if (r.ok) { const d = await r.json(); setAbuseFlags(d.flags ?? []); } setLoading(false); }, [abuseSeverity]);
  const fetchRiskyUsers   = useCallback(async () => { setLoading(true); const r = await fetch("/api/admin/abuse/risky-users"); if (r.ok) { const d = await r.json(); setRiskyUsers(d.users ?? []); } setLoading(false); }, []);
  const fetchWeeklySummary = useCallback(async () => { const r = await fetch("/api/admin/abuse/summary/weekly"); if (r.ok) { const d = await r.json(); setWeeklySummary(d.summary); } }, []);
  const fetchAbuseUserDetail = useCallback(async (userId: string) => { const r = await fetch(`/api/admin/abuse/flags/${userId}`); if (r.ok) { const d = await r.json(); setSelectedAbuseUser(d); } }, []);
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
  useEffect(() => { if (section === "verification") { fetchVerif(); fetchMrQueue(); } }, [section, fetchVerif, fetchMrQueue, verifFilter, mrFilter]);
  useEffect(() => { if (section === "circles") { fetchCircles(); fetchFlagged(); } }, [section, fetchCircles, fetchFlagged, flaggedFilter]);
  useEffect(() => {
    if (section !== "abuse") return;
    if (abuseTab === "flags")  fetchAbuseFlags();
    if (abuseTab === "risky")  fetchRiskyUsers();
    if (abuseTab === "weekly") fetchWeeklySummary();
  }, [section, abuseTab, fetchAbuseFlags, fetchRiskyUsers, fetchWeeklySummary, abuseSeverity]);
  useEffect(() => {
    if (section === "fulfillments") fetchFulfillments(fulfillFilter);
  }, [section, fulfillFilter, fetchFulfillments]);

  const fetchSuggestions = useCallback(async (status: string) => {
    setSuggestLoading(true);
    const r = await fetch(`/api/admin/register/suggestions?status=${status}`);
    if (r.ok) { const d = await r.json(); setSuggestions(d.suggestions ?? []); }
    setSuggestLoading(false);
  }, []);
  useEffect(() => {
    if (section === "register-suggestions") fetchSuggestions(suggestionFilter);
  }, [section, suggestionFilter, fetchSuggestions]);

  const fetchRegQueue = useCallback(async (status: string) => {
    setRegQueueLoading(true);
    const r = await fetch(`/api/admin/fulfillment-queue?status=${status}`);
    if (r.ok) { const d = await r.json(); setRegQueue(d.queue ?? []); }
    setRegQueueLoading(false);
  }, []);

  const fetchAwaitingAddress = useCallback(async () => {
    setRegQueueLoading(true);
    const r = await fetch("/api/admin/fulfillment-queue?status=AWAITING_ADDRESS");
    if (r.ok) { const d = await r.json(); setAwaitingAddressItems(d.awaitingAddress ?? []); }
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

  const fetchPendingApprovals = useCallback(async () => {
    setApprovalsLoading(true);
    const r = await fetch("/api/admin/register-items/pending");
    if (r.ok) { const d = await r.json(); setPendingApprovals(d.items ?? []); }
    setApprovalsLoading(false);
  }, []);

  const fetchRefunds = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/refunds");
    if (r.ok) { const d = await r.json(); setRefunds(d.fundings ?? []); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (section === "register-queue") {
      if (regQueueTab === "AWAITING_ADDRESS") { fetchAwaitingAddress(); fetchFinancials(); }
      else { fetchRegQueue(regQueueTab); fetchFinancials(); }
    }
  }, [section, regQueueTab, fetchRegQueue, fetchAwaitingAddress, fetchFinancials]);
  useEffect(() => { fetchCatalogAdmin(); fetchPendingApprovals(); }, [fetchCatalogAdmin, fetchPendingApprovals]);
  useEffect(() => {
    if (section === "catalog") fetchCatalogAdmin();
    if (section === "approvals") fetchPendingApprovals();
  }, [section, fetchCatalogAdmin, fetchPendingApprovals]);
  useEffect(() => { if (section === "refunds") fetchRefunds(); }, [section, fetchRefunds]);
  useEffect(() => {
    if (section !== "impact" || impactData || impactLoading) return;
    setImpactLoading(true);
    fetch("/api/admin/impact/lifetime")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setImpactData(d); })
      .catch(() => {})
      .finally(() => setImpactLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const fetchBundleAppCatalogue = useCallback(async () => {
    setBundleAppCatalogueLoading(true);
    const r = await fetch("/api/admin/bundles/catalogue");
    if (r.ok) { const d = await r.json(); setBundleAppCatalogue(d.bundles ?? []); }
    setBundleAppCatalogueLoading(false);
  }, []);

  const fetchBundleApps = useCallback(async (status: string) => {
    setBundleAppsLoading(true);
    const r = await fetch(`/api/admin/bundles/applications?status=${status}&limit=50`);
    if (r.ok) { const d = await r.json(); setBundleApps(d.applications ?? []); setBundleAppsTotal(d.total ?? 0); }
    setBundleAppsLoading(false);
  }, []);

  useEffect(() => {
    if (section === "bundle-apps") {
      fetchBundleAppCatalogue();
      fetchBundleApps(bundleAppsFilter);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, fetchBundleAppCatalogue, fetchBundleApps]);

  const reviewBundleApp = async (id: string, status: string) => {
    const note = appNoteMap[id] ?? "";
    const r = await fetch(`/api/admin/bundles/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, adminNote: note || undefined }),
    });
    if (r.ok) {
      setBundleApps((prev) => prev.filter((a) => a.id !== id));
      setToast(`Application ${status.toLowerCase()}`);
    }
  };

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

  const placeHold = async (userId: string) => {
    const reason = window.prompt("Reason for placing this account on hold (required — internal only, not shown to user):");
    if (!reason?.trim()) return;
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "placeHold", reason: reason.trim() }),
    });
    if (res.ok) {
      setUsers((p) => p.map((u) => u.id === userId ? { ...u, accountHold: true, accountHoldReason: reason.trim(), accountHoldAt: new Date().toISOString() } : u));
      setToast("Account hold placed");
    } else {
      setToast("Failed to place hold");
    }
  };

  const releaseHold = async (userId: string) => {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "releaseHold" }),
    });
    if (res.ok) {
      setUsers((p) => p.map((u) => u.id === userId ? { ...u, accountHold: false, accountHoldReason: null, accountHoldAt: null } : u));
      setToast("Account hold released");
    } else {
      setToast("Failed to release hold");
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

  const reviewManual = async (userId: string, action: "approve" | "reject") => {
    const reason = action === "reject" ? mrNote[userId] : undefined;
    const res = await fetch(`/api/admin/verification/manual-review/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    if (res.ok) {
      fetchMrQueue();
      setToast(action === "approve" ? "✅ Profile approved — mother notified!" : "Profile returned with kind feedback.");
    }
  };

  const recalcTrust = async (userId: string) => {
    const res = await fetch("/api/admin/trust", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
    if (res.ok) { const d = await res.json(); setTrustUsers((p) => p.map((u) => u.id === userId ? { ...u, trustScore: d.trustScore } : u)); setToast(`Trust score updated: ${d.trustScore}`); }
  };

  const issueRefund = async (fundingId: string) => {
    const res = await fetch("/api/admin/refunds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fundingId }),
    });
    const d = await res.json();
    if (res.ok) {
      setRefunds((p) => p.filter((r) => r.id !== fundingId));
      setConfirmRefund(null);
      setToast("Refund issued");
    } else {
      setToast(d.error ?? "Refund failed");
      setConfirmRefund(null);
    }
  };

  if (authLoading || !user) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;

  const staleCount = catalogItems.filter((c) => {
    if (!c.lastVerifiedAt) return true;
    return (Date.now() - new Date(c.lastVerifiedAt).getTime()) / 86_400_000 > 7;
  }).length;

  const NAV_ITEMS: [Section, string, string?][] = [
    ["overview",     "📊 Overview"],
    ["users",        "👥 Users"],
    ["listings",     "📦 Listings"],
    ["reports",      "🚩 Reports" + (stats?.pendingReports ? ` (${stats.pendingReports})` : "")],
    ["trust",        "🛡️ Trust"],
    ["verification", "✅ Verify" + (stats?.pendingDocuments ? ` (${stats.pendingDocuments})` : "")],
    ["circles",      "🤝 Circles"],
    ["fulfillments",   "📦 Fulfillments"],
    ["register-queue", "🛍️ Register Queue"],
    ["catalog",        `📋 Item Catalog${staleCount > 0 ? ` 🔴 ${staleCount}` : ""}`,
                       staleCount > 0 ? `${staleCount} item${staleCount === 1 ? "" : "s"} need price verification` : undefined],
    ["approvals",      `✅ Item Approvals${pendingApprovals.length > 0 ? ` (${pendingApprovals.length})` : ""}`,
                       pendingApprovals.length > 0 ? `${pendingApprovals.length} register item${pendingApprovals.length === 1 ? "" : "s"} pending review` : undefined],
    ["abuse",          "🔍 Abuse Monitor"],
    ["coordination",   "📍 Coordination"],
    ["refunds",        "💳 Refunds"],
    ["bundle-apps",    `📬 Bundle Apps${bundleAppCatalogue.reduce((s, b) => s + b.monthPending, 0) > 0 ? ` (${bundleAppCatalogue.reduce((s, b) => s + b.monthPending, 0)})` : ""}`],
    ["register-suggestions", `💡 Suggestions${suggestions.filter(s => s.status === "pending").length > 0 ? ` (${suggestions.filter(s => s.status === "pending").length})` : ""}`],
    ["impact",               "📈 Impact"],
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
            {NAV_ITEMS.map(([key, label, tooltip]) => (
              <div key={key} className={`admin-nav-item ${section === key ? "active" : ""}`} onClick={() => setSection(key)} title={tooltip}>
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
                    [(stats.pendingOverrides ?? 0).toString(), "Override Reviews"],
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
                <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                  <a href="/admin/register-suggestions" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "white", border: "1px solid var(--border)", borderRadius: 12, textDecoration: "none", fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                    💡 Register Suggestions
                    <ExternalLink size={12} color="var(--mid)" />
                  </a>
                  <a href="/admin/bug-reports" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "white", border: "1px solid var(--border)", borderRadius: 12, textDecoration: "none", fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                    🐛 Bug Reports
                    <ExternalLink size={12} color="var(--mid)" />
                  </a>
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
                        <td>
                          <span className={`status-pill status-${u.status}`}>{u.status}</span>
                          {u.accountHold && (
                            <span title={u.accountHoldReason ?? ""} style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", borderRadius: 10, padding: "2px 7px", cursor: "help" }}>⏸ HOLD</span>
                          )}
                        </td>
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
                          {!u.accountHold
                            ? <button className="action-btn" style={{ background: "rgba(146,64,14,0.1)", color: "#92400e", fontWeight: 800 }} onClick={() => placeHold(u.id)}>⏸ Hold</button>
                            : <button className="action-btn" style={{ background: "rgba(26,122,94,0.12)", color: "var(--green)", fontWeight: 800 }} onClick={() => releaseHold(u.id)}>▶ Release</button>
                          }
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

            {/* ── MANUAL REVIEW QUEUE ──────────────────────────────────── */}
            {section === "verification" && (
              <div style={{ marginTop: 32 }}>
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 24, marginBottom: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>Manual Review Queue</div>
                  <div style={{ fontSize: 12, color: "var(--mid)" }}>Profiles submitted for baseline verification (no government ID).</div>
                </div>

                {/* Filter tabs */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
                    <button key={s} onClick={() => setMrFilter(s)} style={{
                      padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                      fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700,
                      background: mrFilter === s ? "var(--green)" : "var(--bg)",
                      color: mrFilter === s ? "white" : "var(--mid)",
                    }}>{s.charAt(0) + s.slice(1).toLowerCase()}</button>
                  ))}
                </div>

                {mrUsers.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--mid)" }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🧾</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>No {mrFilter.toLowerCase()} profiles</div>
                  </div>
                ) : mrUsers.map((u) => (
                  <div key={u.id} style={{ background: "var(--white)", borderRadius: 14, padding: "16px", marginBottom: 12, boxShadow: "var(--shadow)" }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--green-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "var(--green)", flexShrink: 0, overflow: "hidden" }}>
                        {u.avatar
                          ? <img src={u.avatar} alt={u.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> // eslint-disable-line @next/next/no-img-element
                          : u.name[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{u.name}</div>
                        <div style={{ fontSize: 12, color: "var(--mid)" }}>
                          {u.email ?? u.phone ?? "—"} · Joined {new Date(u.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                        {u.manualReviewSubmittedAt && (
                          <div style={{ fontSize: 11, color: "var(--mid)", marginTop: 1 }}>
                            Submitted {new Date(u.manualReviewSubmittedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                        background: u.manualReviewStatus === "APPROVED" ? "var(--green-light)" : u.manualReviewStatus === "REJECTED" ? "var(--terra-light)" : "var(--yellow-light)",
                        color: u.manualReviewStatus === "APPROVED" ? "var(--green)" : u.manualReviewStatus === "REJECTED" ? "var(--terra)" : "#b8860b",
                      }}>{u.manualReviewStatus}</span>
                    </div>

                    {/* Contact badges */}
                    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: u.phoneVerified ? "var(--green-light)" : "var(--bg)", color: u.phoneVerified ? "var(--green)" : "var(--mid)" }}>
                        {u.phoneVerified ? "📱 Phone ✓" : "📱 Phone ✗"}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: u.emailVerified ? "var(--green-light)" : "var(--bg)", color: u.emailVerified ? "var(--green)" : "var(--mid)" }}>
                        {u.emailVerified ? "📧 Email ✓" : "📧 Email ✗"}
                      </span>
                    </div>

                    {/* Previous rejection reason */}
                    {u.manualReviewRejectionReason && u.manualReviewStatus === "PENDING" && (
                      <div style={{ background: "var(--terra-light)", borderRadius: 8, padding: "8px 10px", marginBottom: 10, fontSize: 12, color: "var(--terra)", lineHeight: 1.4 }}>
                        Previous reason: {u.manualReviewRejectionReason}
                      </div>
                    )}

                    {/* Actions — PENDING only */}
                    {u.manualReviewStatus === "PENDING" && (
                      <div>
                        <textarea
                          placeholder="Rejection note (optional — a kind default message is used if left blank)"
                          value={mrNote[u.id] ?? ""}
                          onChange={(e) => setMrNote((p) => ({ ...p, [u.id]: e.target.value }))}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, fontFamily: "Nunito, sans-serif", resize: "vertical", marginBottom: 10, boxSizing: "border-box" }}
                          rows={2}
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => reviewManual(u.id, "approve")} style={{
                            flex: 1, padding: "10px", borderRadius: 10, border: "none",
                            background: "var(--green)", color: "white", fontSize: 13, fontWeight: 800,
                            cursor: "pointer", fontFamily: "Nunito, sans-serif",
                          }}>✅ Approve</button>
                          <button onClick={() => reviewManual(u.id, "reject")} style={{
                            flex: 1, padding: "10px", borderRadius: 10, border: "1.5px solid var(--terra)",
                            background: "white", color: "var(--terra)", fontSize: 13, fontWeight: 800,
                            cursor: "pointer", fontFamily: "Nunito, sans-serif",
                          }}>✗ Return with feedback</button>
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
                  {(["AWAITING_ADDRESS", "QUEUED", "PURCHASED", "DISPATCHED", "DELIVERED"] as const).map((s) => (
                    <button key={s} onClick={() => setRegQueueTab(s)}
                      style={{
                        padding: "7px 16px", borderRadius: 20,
                        border: `1.5px solid ${regQueueTab === s ? "#1a7a5e" : "var(--border)"}`,
                        background: regQueueTab === s ? "#e8f5f1" : "none",
                        color: regQueueTab === s ? "#1a7a5e" : "var(--ink)",
                        fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif",
                      }}>
                      {s === "AWAITING_ADDRESS" ? "📍 Awaiting Address" : s === "QUEUED" ? "⏳ Queued" : s === "PURCHASED" ? "🛒 Purchased" : s === "DISPATCHED" ? "🚚 Dispatched" : "✅ Delivered"}
                    </button>
                  ))}
                </div>

                {regQueueLoading ? (
                  <div style={{ textAlign: "center", padding: 40 }}><div className="spinner" /></div>
                ) : regQueueTab === "AWAITING_ADDRESS" ? (
                  awaitingAddressItems.length === 0 ? (
                    <div style={{ textAlign: "center", color: "var(--mid)", padding: "32px 0", fontFamily: "Nunito, sans-serif" }}>
                      No items awaiting address confirmation.
                    </div>
                  ) : (
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Mother</th>
                          <th>Days waiting</th>
                          <th>Days left</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {awaitingAddressItems.map((entry) => {
                          const daysWaiting = Math.floor((Date.now() - new Date(entry.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
                          const daysLeft    = 14 - daysWaiting;
                          const urgency     = daysLeft <= 3 ? "#c0392b" : daysLeft <= 7 ? "#d97706" : "#1a7a5e";
                          return (
                            <tr key={entry.id}>
                              <td style={{ fontWeight: 700, fontSize: 12 }}>{entry.name}</td>
                              <td style={{ fontSize: 12 }}>
                                {entry.register.creator.name.split(" ")[0]}
                                <div style={{ fontSize: 11, color: "var(--mid)" }}>{entry.register.city}</div>
                              </td>
                              <td style={{ fontSize: 12, color: urgency, fontWeight: 700 }}>{daysWaiting}d</td>
                              <td style={{ fontSize: 12, color: urgency, fontWeight: 700 }}>{Math.max(0, daysLeft)}d</td>
                              <td>
                                <button
                                  onClick={async () => {
                                    await fetch("/api/admin/fulfillment-queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: entry.id }) });
                                    setToast("Nudge sent to mother");
                                  }}
                                  style={{ fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 8, border: "none", background: "#d97706", color: "white", cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                                  Nudge mother
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )
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
                    onClick={() => setEditingCatalog({ id: "", sku: "", name: "", category: "Feeding", standardPriceCents: 0, description: null, imageUrl: null, preferredVendor: null, preferredVendorUrl: null, substituteNote: null, ageStage: null, requiresSize: false, requiresApproval: false, isActive: true, lastVerifiedAt: null, createdAt: "", updatedAt: "", _count: { registerItems: 0 } })}
                    style={{ background: "var(--green)", color: "white", border: "none", borderRadius: 20, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                    + Add item
                  </button>
                </div>

                {catalogLoading ? (
                  <div style={{ textAlign: "center", padding: 40 }}><div className="spinner" /></div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Image</th>
                          <th>Item</th>
                          <th>Category</th>
                          <th>Vendor</th>
                          <th>Price</th>
                          <th>Used</th>
                          <th>Status</th>
                          <th>Verified</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catalogItems.map((c) => (
                          <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.5 }}>
                            <td style={{ fontSize: 11, fontWeight: 800, color: "var(--mid)", fontFamily: "monospace" }}>{c.sku}</td>
                            <td>
                              {c.imageUrl
                                ? <img src={c.imageUrl} alt={c.name} style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 6 }} />
                                : <div style={{ width: 32, height: 32, borderRadius: 6, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>—</div>
                              }
                            </td>
                            <td style={{ fontWeight: 700, fontSize: 12 }}>{c.name}</td>
                            <td style={{ fontSize: 12, color: "var(--mid)" }}>{c.category}</td>
                            <td style={{ fontSize: 12, color: "var(--mid)" }}>{c.preferredVendor ?? "—"}</td>
                            <td style={{ fontSize: 12, fontWeight: 700, color: "#1a7a5e" }}>${(c.standardPriceCents / 100).toFixed(0)}</td>
                            <td style={{ fontSize: 12, color: "var(--mid)" }}>{c._count.registerItems}</td>
                            <td>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: c.isActive ? "#e8f5f1" : "#f3f4f6", color: c.isActive ? "#1a7a5e" : "var(--mid)" }}>
                                {c.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td>
                              {(() => { const p = catalogStalePill(c.lastVerifiedAt); return (
                                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: p.bg, color: p.color, whiteSpace: "nowrap" }}>{p.label}</span>
                              ); })()}
                            </td>
                            <td style={{ display: "flex", gap: 6 }}>
                              <button
                                onClick={() => { if (c.preferredVendorUrl) window.open(c.preferredVendorUrl, "_blank", "noopener"); }}
                                disabled={!c.preferredVendorUrl}
                                title={c.preferredVendorUrl ? "Open product URL to verify price" : "Add product URL first"}
                                style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 8, border: "1.5px solid var(--border)", background: "none", cursor: c.preferredVendorUrl ? "pointer" : "not-allowed", fontFamily: "Nunito, sans-serif", opacity: c.preferredVendorUrl ? 1 : 0.4 }}>
                                <ExternalLink size={12} strokeWidth={1.75} />Verify
                              </button>
                              <button onClick={() => setEditingCatalog(c)}
                                style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 8, border: "1.5px solid var(--border)", background: "none", cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                                Edit
                              </button>
                              <button
                                onClick={async () => {
                                  await fetch("/api/admin/catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, sku: c.sku, name: c.name, category: c.category, standardPriceCents: c.standardPriceCents, isActive: !c.isActive }) });
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
                  </div>
                )}

                {/* Add/Edit modal */}
                {editingCatalog !== null && (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
                    <div style={{ background: "white", borderRadius: 16, padding: 24, maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, marginBottom: 16 }}>
                        {editingCatalog.id ? "Edit item" : "Add new item"}
                      </div>

                      {/* SKU */}
                      <div className="form-group">
                        <label className="form-label">SKU <span style={{ color: "var(--terra)" }}>*</span></label>
                        <input className="form-input" placeholder="e.g. F01" value={editingCatalog.sku} onChange={(e) => setEditingCatalog((p) => p ? { ...p, sku: e.target.value.toUpperCase() } : p)} style={{ fontFamily: "monospace" }} />
                      </div>

                      {/* Name */}
                      <div className="form-group">
                        <label className="form-label">Item name <span style={{ color: "var(--terra)" }}>*</span></label>
                        <input className="form-input" value={editingCatalog.name} onChange={(e) => setEditingCatalog((p) => p ? { ...p, name: e.target.value } : p)} />
                      </div>

                      {/* Category */}
                      <div className="form-group">
                        <label className="form-label">Category <span style={{ color: "var(--terra)" }}>*</span></label>
                        <select className="form-input" value={editingCatalog.category} onChange={(e) => setEditingCatalog((p) => p ? { ...p, category: e.target.value } : p)} style={{ fontFamily: "Nunito, sans-serif" }}>
                          {["Feeding", "Diapering", "Clothing", "Maternity & Postpartum", "Hygiene & Bath", "Other"].map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </div>

                      {/* Price */}
                      <div className="form-group">
                        <label className="form-label">Price (CAD) <span style={{ color: "var(--terra)" }}>*</span></label>
                        <input className="form-input" type="number" min="0" step="0.01" value={(editingCatalog.standardPriceCents / 100).toFixed(2)} onChange={(e) => setEditingCatalog((p) => p ? { ...p, standardPriceCents: Math.round(parseFloat(e.target.value || "0") * 100) } : p)} />
                      </div>

                      {/* Description */}
                      <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea className="form-input" rows={2} value={editingCatalog.description ?? ""} onChange={(e) => setEditingCatalog((p) => p ? { ...p, description: e.target.value || null } : p)} style={{ resize: "vertical", fontFamily: "Nunito, sans-serif" }} />
                      </div>

                      {/* Image upload */}
                      <div className="form-group">
                        <label className="form-label">Product image</label>
                        {editingCatalog.imageUrl && (
                          <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                            <img src={editingCatalog.imageUrl} alt="preview" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: "1.5px solid var(--border)" }} />
                            <button onClick={() => setEditingCatalog((p) => p ? { ...p, imageUrl: null } : p)} style={{ fontSize: 11, color: "var(--terra)", background: "none", border: "none", cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Remove</button>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={catalogImgUploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setCatalogImgUploading(true);
                            const fd = new FormData();
                            fd.append("file", file);
                            const res = await fetch("/api/upload", { method: "POST", body: fd });
                            setCatalogImgUploading(false);
                            if (res.ok) {
                              const d = await res.json();
                              setEditingCatalog((p) => p ? { ...p, imageUrl: d.url } : p);
                            } else {
                              setToast("Image upload failed");
                            }
                            e.target.value = "";
                          }}
                          style={{ fontSize: 12, fontFamily: "Nunito, sans-serif" }}
                        />
                        {catalogImgUploading && <div style={{ fontSize: 12, color: "var(--mid)", marginTop: 4 }}>Uploading…</div>}
                      </div>

                      {/* Vendor */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div className="form-group">
                          <label className="form-label">Preferred vendor</label>
                          <select className="form-input" value={editingCatalog.preferredVendor ?? ""} onChange={(e) => setEditingCatalog((p) => p ? { ...p, preferredVendor: e.target.value || null } : p)} style={{ fontFamily: "Nunito, sans-serif" }}>
                            <option value="">— None —</option>
                            {["Walmart.ca", "Amazon.ca", "Shoppers Drug Mart", "Costco Canada"].map((v) => <option key={v}>{v}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Vendor URL</label>
                          <input
                            className="form-input"
                            placeholder="https://…"
                            value={editingCatalog.preferredVendorUrl ?? ""}
                            onChange={(e) => setEditingCatalog((p) => p ? { ...p, preferredVendorUrl: e.target.value || null } : p)}
                            onBlur={(e) => {
                              const v = e.target.value;
                              if (v && !v.startsWith("http://") && !v.startsWith("https://")) setToast("Vendor URL must start with https://");
                            }}
                          />
                        </div>
                      </div>

                      {/* Substitute note */}
                      <div className="form-group">
                        <label className="form-label">Substitute note <span style={{ fontSize: 11, color: "var(--mid)" }}>(max 300 chars)</span></label>
                        <textarea className="form-input" rows={2} maxLength={300} value={editingCatalog.substituteNote ?? ""} onChange={(e) => setEditingCatalog((p) => p ? { ...p, substituteNote: e.target.value || null } : p)} style={{ resize: "vertical", fontFamily: "Nunito, sans-serif" }} />
                      </div>

                      {/* Age stage + Requires size */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "end" }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Age stage</label>
                          <input className="form-input" placeholder="e.g. 0-3 months" value={editingCatalog.ageStage ?? ""} onChange={(e) => setEditingCatalog((p) => p ? { ...p, ageStage: e.target.value || null } : p)} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 2 }}>
                          <input type="checkbox" id="requiresSize" checked={editingCatalog.requiresSize} onChange={(e) => setEditingCatalog((p) => p ? { ...p, requiresSize: e.target.checked } : p)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                          <label htmlFor="requiresSize" style={{ fontSize: 13, fontFamily: "Nunito, sans-serif", fontWeight: 600, cursor: "pointer" }}>Requires size</label>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 2 }}>
                          <input type="checkbox" id="requiresApproval" checked={editingCatalog.requiresApproval} onChange={(e) => setEditingCatalog((p) => p ? { ...p, requiresApproval: e.target.checked } : p)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                          <label htmlFor="requiresApproval" style={{ fontSize: 13, fontFamily: "Nunito, sans-serif", fontWeight: 600, cursor: "pointer" }}>Requires admin approval</label>
                        </div>
                      </div>

                      {/* Last verified (read-only) */}
                      {editingCatalog.lastVerifiedAt && (
                        <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginTop: 12 }}>
                          Last verified: {new Date(editingCatalog.lastVerifiedAt).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                        <button onClick={() => setEditingCatalog(null)} className="btn-clear" style={{ flex: 1 }}>Cancel</button>
                        <button
                          onClick={async () => {
                            if (!editingCatalog.sku.trim()) { setToast("SKU is required"); return; }
                            if (!editingCatalog.name) { setToast("Name is required"); return; }
                            if (!editingCatalog.category) { setToast("Category is required"); return; }
                            const vendorUrl = editingCatalog.preferredVendorUrl;
                            if (vendorUrl && !vendorUrl.startsWith("http://") && !vendorUrl.startsWith("https://")) { setToast("Vendor URL must start with https://"); return; }
                            const res = await fetch("/api/admin/catalog", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: editingCatalog.id || undefined,
                                sku: editingCatalog.sku.trim().toUpperCase(),
                                name: editingCatalog.name,
                                category: editingCatalog.category,
                                standardPriceCents: editingCatalog.standardPriceCents,
                                description: editingCatalog.description || null,
                                imageUrl: editingCatalog.imageUrl || null,
                                preferredVendor: editingCatalog.preferredVendor || null,
                                preferredVendorUrl: editingCatalog.preferredVendorUrl || null,
                                substituteNote: editingCatalog.substituteNote || null,
                                ageStage: editingCatalog.ageStage || null,
                                requiresSize: editingCatalog.requiresSize,
                                requiresApproval: editingCatalog.requiresApproval,
                                isActive: editingCatalog.isActive,
                              }),
                            });
                            if (!res.ok) {
                              const d = await res.json();
                              setToast(d.error ?? "Save failed");
                              return;
                            }
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

            {/* ── ITEM APPROVALS ───────────────────────────────────────────── */}
            {section === "approvals" && (
              <div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
                  Register Item Approvals
                  {pendingApprovals.length > 0 && (
                    <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 700, background: "#fff8e6", color: "#d97706", padding: "3px 10px", borderRadius: 20 }}>
                      {pendingApprovals.length} pending
                    </span>
                  )}
                </div>

                {approvalsLoading ? (
                  <div className="loading"><div className="spinner" /></div>
                ) : pendingApprovals.length === 0 ? (
                  <div className="empty">
                    <div className="empty-icon">✅</div>
                    <div className="empty-title">No items pending review</div>
                  </div>
                ) : (
                  <div>
                    {pendingApprovals.map((item) => (
                      <div key={item.id} style={{ background: "var(--white)", borderRadius: 12, padding: "16px", marginBottom: 12, boxShadow: "var(--shadow)", border: "1.5px solid #fde68a" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{item.name}</div>
                            <div style={{ fontSize: 12, color: "var(--mid)" }}>
                              {item.category} · Qty: {item.quantity}
                              {item.note && ` · ${item.note}`}
                            </div>
                            {item.catalogItem ? (
                              <div style={{ fontSize: 11, color: "#d97706", fontWeight: 600, marginTop: 4 }}>
                                Catalog item · SKU: {item.catalogItem.sku}
                                {item.catalogItem.requiresApproval && " · Marked as requires approval"}
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, color: "#7a5500", fontWeight: 600, marginTop: 4 }}>Custom item (not in catalog)</div>
                            )}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--mid)", flexShrink: 0 }}>
                            {new Date(item.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                          </div>
                        </div>

                        <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 12 }}>
                          <div style={{ fontWeight: 700, marginBottom: 2 }}>Register: {item.register.title}</div>
                          <div style={{ color: "var(--mid)" }}>
                            by {item.register.creator.name} · {item.register.city}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/admin/register-items/${item.id}/approve`, { method: "PATCH" });
                              if (res.ok) { fetchPendingApprovals(); setToast(`"${item.name}" approved`); }
                              else { const d = await res.json(); setToast(d.error ?? "Failed"); }
                            }}
                            style={{ padding: "8px 16px", borderRadius: 20, border: "none", background: "var(--green)", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => setShowRejectModal(item.id)}
                            style={{ padding: "8px 16px", borderRadius: 20, border: "1.5px solid var(--terra)", background: "none", color: "var(--terra)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                          >
                            ✕ Reject
                          </button>
                          <a
                            href={`/registers/${item.register.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif", textDecoration: "underline", marginLeft: "auto" }}
                          >
                            View register ↗
                          </a>
                        </div>

                        {/* Reject modal for this item */}
                        {showRejectModal === item.id && (
                          <div style={{ marginTop: 12, background: "#fff8e6", borderRadius: 10, padding: "12px" }}>
                            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: "#7a5500" }}>Rejection reason (required, max 200 chars)</div>
                            <input
                              className="form-input"
                              placeholder="e.g. This item is not available in our catalog"
                              maxLength={200}
                              value={rejectReasonMap[item.id] ?? ""}
                              onChange={(e) => setRejectReasonMap((p) => ({ ...p, [item.id]: e.target.value }))}
                              style={{ marginBottom: 8 }}
                            />
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={() => setShowRejectModal(null)}
                                style={{ flex: 1, padding: "8px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--white)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", color: "var(--mid)" }}
                              >Cancel</button>
                              <button
                                onClick={async () => {
                                  const reason = rejectReasonMap[item.id]?.trim();
                                  if (!reason) { setToast("Reason is required"); return; }
                                  const res = await fetch(`/api/admin/register-items/${item.id}/reject`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ reason }),
                                  });
                                  if (res.ok) {
                                    setShowRejectModal(null);
                                    setRejectReasonMap((p) => { const n = { ...p }; delete n[item.id]; return n; });
                                    fetchPendingApprovals();
                                    setToast(`"${item.name}" rejected`);
                                  } else {
                                    const d = await res.json();
                                    setToast(d.error ?? "Failed");
                                  }
                                }}
                                style={{ flex: 2, padding: "8px", borderRadius: 10, border: "none", background: "var(--terra)", color: "white", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                              >Confirm reject</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── COORDINATION ─────────────────────────────────────────────── */}
            {section === "coordination" && (
              <CoordinationAdmin />
            )}

            {/* ── REFUNDS ──────────────────────────────────────────────── */}
            {section === "refunds" && (
              <div className="admin-table">
                <div className="admin-table-header">
                  <div className="admin-table-title">Confirmed Fundings — Issue Refund</div>
                </div>
                {loading ? (
                  <div className="loading"><div className="spinner" /></div>
                ) : refunds.length === 0 ? (
                  <div className="empty"><div className="empty-title">No confirmed fundings</div></div>
                ) : (
                  <table>
                    <thead>
                      <tr><th>Date</th><th>Donor</th><th>Item</th><th>Register</th><th>Amount</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {refunds.map((r) => (
                        <tr key={r.id}>
                          <td style={{ color: "var(--mid)", fontSize: 12 }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                          <td>
                            <div><strong>{r.donor.name}</strong></div>
                            <div style={{ fontSize: 11, color: "var(--mid)" }}>{r.donor.email}</div>
                          </td>
                          <td>{r.registerItem.name}</td>
                          <td style={{ fontSize: 12, color: "var(--mid)" }}>
                            <div>{r.registerItem.register.title}</div>
                            <div style={{ fontSize: 11 }}>{r.registerItem.register.creator.name}</div>
                          </td>
                          <td style={{ fontWeight: 700 }}>${(r.amountCents / 100).toFixed(2)}</td>
                          <td>
                            <button
                              onClick={() => setConfirmRefund(r)}
                              style={{
                                padding: "6px 14px", borderRadius: 8, border: "none",
                                background: "#fdecea", color: "#c0392b",
                                fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer",
                              }}
                            >
                              Refund
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {confirmRefund && (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                    <div style={{ background: "var(--white)", borderRadius: 16, padding: 32, maxWidth: 400, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Confirm Refund</div>
                      <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, color: "#555555", marginBottom: 20 }}>
                        Refund <strong>${(confirmRefund.amountCents / 100).toFixed(2)}</strong> to{" "}
                        <strong>{confirmRefund.donor.name}</strong> for &ldquo;{confirmRefund.registerItem.name}&rdquo;?
                        This will reverse the Stripe charge and update the register.
                      </p>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          onClick={() => issueRefund(confirmRefund.id)}
                          style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: "#c0392b", color: "#fff", fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                        >
                          Yes, refund
                        </button>
                        <button
                          onClick={() => setConfirmRefund(null)}
                          style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--white)", color: "var(--ink)", fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Bundle Applications ── */}
            {section === "bundle-apps" && (
              <div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, marginBottom: 20, color: "var(--ink)" }}>
                  Bundle Applications
                </div>

                {/* Seed button */}
                <div style={{ marginBottom: 20, display: "flex", gap: 10 }}>
                  <button
                    onClick={async () => {
                      const r = await fetch("/api/admin/bundles/seed-catalogue", { method: "POST" });
                      if (r.ok) { fetchBundleAppCatalogue(); setToast("Catalogue seeded (12 bundles)"); }
                      else setToast("Seed failed");
                    }}
                    style={{ padding: "8px 16px", background: "#1a7a5e", border: "none", borderRadius: 8, color: "white", fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                  >
                    Seed / Refresh Catalogue
                  </button>
                </div>

                {/* Sub-view tabs */}
                <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #e0e0e0", marginBottom: 20 }}>
                  {(["catalogue", "applications"] as const).map((v) => (
                    <button key={v} onClick={() => { setBundleAppsView(v); if (v === "applications") fetchBundleApps(bundleAppsFilter); }}
                      style={{ padding: "10px 18px", background: "none", border: "none", borderBottom: `2px solid ${bundleAppsView === v ? "#1a7a5e" : "transparent"}`, marginBottom: -2, fontSize: 13, fontWeight: 700, color: bundleAppsView === v ? "#1a7a5e" : "#555", cursor: "pointer", fontFamily: "Nunito, sans-serif", textTransform: "capitalize" }}>
                      {v === "catalogue" ? "Bundle Catalogue" : "Applications Queue"}
                    </button>
                  ))}
                </div>

                {bundleAppsView === "catalogue" && (
                  bundleAppCatalogueLoading ? <div className="loading"><div className="spinner" /></div> : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "Nunito, sans-serif" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #e0e0e0" }}>
                          {["Code", "Name", "Stage", "Est. Value", "Slots/mo", "This month", "Remaining", "Sponsor", "Status"].map((h) => (
                            <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontWeight: 800, color: "#555" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bundleAppCatalogue.map((b) => (
                          <tr key={b.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                            <td style={{ padding: "10px 10px", fontWeight: 800 }}>{b.code}</td>
                            <td style={{ padding: "10px 10px" }}>{b.name}</td>
                            <td style={{ padding: "10px 10px" }}>
                              <span style={{
                                background: b.stage === "PREGNANCY" ? "#e8f5f1" : b.stage === "LABOUR" ? "#fff8ed" : b.stage === "NEWBORN" ? "#e0f2fe" : "#fce7f3",
                                color: b.stage === "PREGNANCY" ? "#1a7a5e" : b.stage === "LABOUR" ? "#d97706" : b.stage === "NEWBORN" ? "#0284c7" : "#be185d",
                                fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 20, textTransform: "capitalize",
                              }}>
                                {b.stage.charAt(0) + b.stage.slice(1).toLowerCase()}
                              </span>
                            </td>
                            <td style={{ padding: "10px 10px" }}>${(b.estimatedValue / 100).toFixed(0)}</td>
                            <td style={{ padding: "10px 10px" }}>{b.slotsPerMonth}</td>
                            <td style={{ padding: "10px 10px" }}>
                              <span style={{ color: "#d97706", fontWeight: 700 }}>{b.monthPending} pending</span>
                              {b.monthApproved > 0 && <span style={{ color: "#1a7a5e", marginLeft: 6 }}>{b.monthApproved} approved</span>}
                            </td>
                            <td style={{ padding: "10px 10px" }}>
                              <span style={{ color: b.slotsRemaining === 0 ? "#c0392b" : b.slotsRemaining <= 2 ? "#d97706" : "#1a7a5e", fontWeight: 700 }}>
                                {b.slotsRemaining}
                              </span>
                            </td>
                            <td style={{ padding: "10px 10px", minWidth: 170 }}>
                              {sponsorEditId === b.id ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  <input value={sponsorNameDraft} onChange={(e) => setSponsorNameDraft(e.target.value)} placeholder="Sponsor name (empty = clear)"
                                    style={{ padding: "5px 8px", border: "1.5px solid #e0e0e0", borderRadius: 6, fontSize: 12, fontFamily: "Nunito, sans-serif" }} />
                                  <input value={sponsorUrlDraft} onChange={(e) => setSponsorUrlDraft(e.target.value)} placeholder="https://sponsor.com (optional)"
                                    style={{ padding: "5px 8px", border: "1.5px solid #e0e0e0", borderRadius: 6, fontSize: 12, fontFamily: "Nunito, sans-serif" }} />
                                  {sponsorSaveError && <span style={{ fontSize: 10, color: "#c0392b" }}>{sponsorSaveError}</span>}
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button
                                      onClick={async () => {
                                        setSponsorSaveError(null);
                                        const r = await fetch("/api/admin/bundles/catalogue", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: b.id, sponsorName: sponsorNameDraft, sponsorUrl: sponsorUrlDraft }) });
                                        if (!r.ok) { setSponsorSaveError((await r.json().catch(() => ({}))).error ?? "Save failed"); return; }
                                        setSponsorEditId(null); fetchBundleAppCatalogue();
                                      }}
                                      style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: "#1a7a5e", color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Save</button>
                                    <button onClick={() => { setSponsorEditId(null); setSponsorSaveError(null); }}
                                      style={{ padding: "4px 10px", borderRadius: 6, border: "1.5px solid #e0e0e0", background: "none", color: "#666", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span style={{ fontSize: 12, color: b.sponsorName ? "#1a1a1a" : "#9ca3af", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.sponsorName ?? "—"}</span>
                                  <button onClick={() => { setSponsorEditId(b.id); setSponsorNameDraft(b.sponsorName ?? ""); setSponsorUrlDraft(b.sponsorUrl ?? ""); setSponsorSaveError(null); }}
                                    style={{ padding: "3px 8px", borderRadius: 6, border: "1.5px solid #e0e0e0", background: "none", color: "#1a7a5e", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>{b.sponsorName ? "Edit" : "Set"}</button>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "10px 10px" }}>
                              <button
                                onClick={async () => {
                                  await fetch("/api/admin/bundles/catalogue", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: b.id, isActive: !b.isActive }) });
                                  fetchBundleAppCatalogue();
                                }}
                                style={{ padding: "4px 12px", borderRadius: 8, border: "1.5px solid " + (b.isActive ? "#1a7a5e" : "#e0e0e0"), background: "none", color: b.isActive ? "#1a7a5e" : "#9ca3af", fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                              >
                                {b.isActive ? "Active" : "Paused"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}

                {bundleAppsView === "applications" && (
                  <div>
                    {/* Status filter */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                      {(["PENDING", "APPROVED", "REJECTED", "WAITLISTED"] as const).map((s) => (
                        <button key={s} onClick={() => { setBundleAppsFilter(s); fetchBundleApps(s); setExpandedAppId(null); }}
                          style={{ padding: "7px 14px", borderRadius: 20, border: "1.5px solid " + (bundleAppsFilter === s ? "#1a7a5e" : "#e0e0e0"), background: bundleAppsFilter === s ? "#1a7a5e" : "white", color: bundleAppsFilter === s ? "white" : "#555", fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                          {s.charAt(0) + s.slice(1).toLowerCase()}
                        </button>
                      ))}
                      <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af", fontFamily: "Nunito, sans-serif", alignSelf: "center" }}>
                        {bundleAppsTotal} total
                      </span>
                    </div>

                    {bundleAppsLoading ? <div className="loading"><div className="spinner" /></div> : bundleApps.length === 0 ? (
                      <div style={{ padding: "40px 0", textAlign: "center", color: "#555", fontSize: 14, fontFamily: "Nunito, sans-serif" }}>
                        No {bundleAppsFilter.toLowerCase()} applications.
                      </div>
                    ) : (
                      <div style={{ border: "1px solid #e0e0e0", borderRadius: 12, overflow: "hidden" }}>
                        {/* Column header */}
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 90px 110px 190px 24px", gap: 12, padding: "9px 16px", background: "#f9f9f9", borderBottom: "1px solid #e0e0e0", fontSize: 11, fontWeight: 800, color: "#9ca3af", fontFamily: "Nunito, sans-serif", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          <span>Mother</span><span>Bundle</span><span>Applied</span><span>Status</span><span>Actions</span><span />
                        </div>

                        {bundleApps.map((app, idx) => {
                          const isExpanded = expandedAppId === app.id;
                          const sc = app.status === "APPROVED"   ? { bg: "#e8f5f1", color: "#1a7a5e"  }
                                   : app.status === "REJECTED"   ? { bg: "#fdecea", color: "#c0392b"  }
                                   : app.status === "WAITLISTED" ? { bg: "#fff8ed", color: "#d97706"  }
                                   :                               { bg: "#f5f5f5", color: "#555"     };
                          return (
                            <div key={app.id} style={{ borderBottom: idx < bundleApps.length - 1 ? "1px solid #f0f0f0" : "none" }}>

                              {/* ── Row ── */}
                              <div
                                onClick={() => setExpandedAppId(isExpanded ? null : app.id)}
                                style={{ display: "grid", gridTemplateColumns: "2fr 2fr 90px 110px 190px 24px", gap: 12, padding: "12px 16px", alignItems: "center", cursor: "pointer", background: isExpanded ? "#fafafa" : "white" }}
                              >
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1a1a1a", fontFamily: "Nunito, sans-serif" }}>{app.fullName}</div>
                                  <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "Nunito, sans-serif", marginTop: 1 }}>{app.city}, {app.province}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", fontFamily: "Nunito, sans-serif" }}>{app.bundle.code} — {app.bundle.name}</div>
                                  <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "Nunito, sans-serif", marginTop: 1 }}>{app.bundle.itemCount} items</div>
                                </div>
                                <div style={{ fontSize: 12, color: "#555", fontFamily: "Nunito, sans-serif" }}>
                                  {new Date(app.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                                </div>
                                <div>
                                  <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, fontFamily: "Nunito, sans-serif", background: sc.bg, color: sc.color }}>
                                    {app.status.charAt(0) + app.status.slice(1).toLowerCase()}
                                  </span>
                                </div>
                                <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                  {app.status === "PENDING" && (
                                    <>
                                      <button onClick={() => reviewBundleApp(app.id, "APPROVED")}
                                        style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "#1a7a5e", color: "white", fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                                        Approve
                                      </button>
                                      <button onClick={() => reviewBundleApp(app.id, "REJECTED")}
                                        style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: "#fdecea", color: "#c0392b", fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                                        Reject
                                      </button>
                                    </>
                                  )}
                                </div>
                                <div style={{ fontSize: 13, color: "#ccc", textAlign: "center" }}>{isExpanded ? "▲" : "▼"}</div>
                              </div>

                              {/* ── Detail panel ── */}
                              {isExpanded && (
                                <div style={{ background: "#fafafa", borderTop: "1px solid #e8e8e8", padding: "20px 20px 24px" }}>

                                  {/* Two-column: identity + meta */}
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 18 }}>
                                    <div>
                                      <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, fontFamily: "Nunito, sans-serif" }}>Applicant</div>
                                      <div style={{ fontSize: 14, fontWeight: 800, color: "#1a1a1a", marginBottom: 3, fontFamily: "Nunito, sans-serif" }}>{app.fullName}</div>
                                      {app.userEmail && <div style={{ fontSize: 12, color: "#555", fontFamily: "Nunito, sans-serif" }}>{app.userEmail}</div>}
                                      <div style={{ fontSize: 12, color: "#555", fontFamily: "Nunito, sans-serif" }}>{app.phone}</div>
                                      {app.currentStage && (
                                        <div style={{ marginTop: 7 }}>
                                          <span style={{ fontSize: 11, fontWeight: 700, background: "#e8f5f1", color: "#1a7a5e", padding: "2px 9px", borderRadius: 20, fontFamily: "Nunito, sans-serif" }}>
                                            {app.currentStage.replace(/-/g, " ")}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, fontFamily: "Nunito, sans-serif" }}>Application</div>
                                      <div style={{ fontSize: 12, color: "#555", fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>
                                        <strong style={{ color: "#1a1a1a" }}>Bundle:</strong> {app.bundle.code} — {app.bundle.name} ({app.bundle.itemCount} items)
                                      </div>
                                      <div style={{ fontSize: 12, color: "#555", fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>
                                        <strong style={{ color: "#1a1a1a" }}>Submitted:</strong>{" "}
                                        {app.daysSince === 0 ? "Today" : `${app.daysSince} day${app.daysSince !== 1 ? "s" : ""} ago`}
                                        {" "}({new Date(app.createdAt).toLocaleDateString("en-CA")})
                                      </div>
                                      <div style={{ fontSize: 12, color: "#555", fontFamily: "Nunito, sans-serif", marginBottom: 4 }}>
                                        <strong style={{ color: "#1a1a1a" }}>Lifetime bundles received:</strong>{" "}
                                        <span style={{ fontWeight: 700, color: app.lifetimeApproved > 0 ? "#1a7a5e" : "#9ca3af" }}>
                                          {app.lifetimeApproved} approved
                                        </span>
                                      </div>
                                      {app.dueDate && <div style={{ fontSize: 12, color: "#555", fontFamily: "Nunito, sans-serif", marginBottom: 2 }}><strong style={{ color: "#1a1a1a" }}>Due date:</strong> {new Date(app.dueDate).toLocaleDateString("en-CA")}</div>}
                                      {app.babyDob && <div style={{ fontSize: 12, color: "#555", fontFamily: "Nunito, sans-serif" }}><strong style={{ color: "#1a1a1a" }}>Baby DOB:</strong> {new Date(app.babyDob).toLocaleDateString("en-CA")}</div>}
                                    </div>
                                  </div>

                                  {/* Story */}
                                  <div style={{ marginBottom: 14 }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, fontFamily: "Nunito, sans-serif" }}>Story</div>
                                    <div style={{ fontSize: 13, color: "#333", lineHeight: 1.7, background: "white", padding: "12px 14px", borderRadius: 8, border: "1px solid #e0e0e0", fontFamily: "Nunito, sans-serif" }}>
                                      {app.story}
                                    </div>
                                  </div>

                                  {/* Delivery address */}
                                  <div style={{ marginBottom: 18 }}>
                                    <div style={{ fontSize: 11, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, fontFamily: "Nunito, sans-serif" }}>Delivery Address</div>
                                    <div style={{ fontSize: 12, color: "#555", background: "white", padding: "10px 14px", borderRadius: 8, border: "1px solid #e0e0e0", lineHeight: 1.8, fontFamily: "Nunito, sans-serif" }}>
                                      {app.streetAddress}{app.unit ? `, ${app.unit}` : ""}<br />
                                      {app.city}, {app.province} {app.postalCode}
                                    </div>
                                  </div>

                                  {/* Admin actions */}
                                  {app.status === "PENDING" && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                      <textarea
                                        placeholder="Admin note (optional, max 200 chars)…"
                                        maxLength={200}
                                        value={appNoteMap[app.id] ?? ""}
                                        onChange={(e) => setAppNoteMap((m) => ({ ...m, [app.id]: e.target.value }))}
                                        rows={2}
                                        style={{ padding: "8px 10px", border: "1.5px solid #e0e0e0", borderRadius: 8, fontFamily: "Nunito, sans-serif", fontSize: 12, resize: "vertical", width: "100%", boxSizing: "border-box" as const }}
                                      />
                                      <div style={{ display: "flex", gap: 8 }}>
                                        <button onClick={() => reviewBundleApp(app.id, "APPROVED")}
                                          style={{ flex: 1, padding: "10px", background: "#1a7a5e", border: "none", borderRadius: 8, color: "white", fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                                          Approve
                                        </button>
                                        <button onClick={() => reviewBundleApp(app.id, "WAITLISTED")}
                                          style={{ flex: 1, padding: "10px", background: "#fff8ed", border: "1.5px solid #d97706", borderRadius: 8, color: "#d97706", fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                                          Waitlist
                                        </button>
                                        <button onClick={() => reviewBundleApp(app.id, "REJECTED")}
                                          style={{ flex: 1, padding: "10px", background: "#fdecea", border: "1.5px solid #c0392b", borderRadius: 8, color: "#c0392b", fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                                          Reject
                                        </button>
                                      </div>
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
                )}
              </div>
            )}

            {/* ── REGISTER SUGGESTIONS ─────────────────────────────────── */}
            {section === "register-suggestions" && (
              <div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, marginBottom: 6, color: "var(--ink)" }}>
                  Register Suggestions
                </div>
                <div style={{ fontSize: 13, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 20 }}>
                  Items mothers would like added to the catalogue. Grouped by name.
                </div>

                {/* Filter tabs */}
                <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
                  {(["pending", "promoted", "declined", "all"] as const).map((tab) => (
                    <button key={tab} onClick={() => setSuggestionFilter(tab)} style={{
                      padding: "8px 16px", background: "none", border: "none",
                      borderBottom: `2px solid ${suggestionFilter === tab ? "var(--green)" : "transparent"}`,
                      fontSize: 13, fontWeight: 700,
                      color: suggestionFilter === tab ? "var(--green)" : "var(--mid)",
                      cursor: "pointer", fontFamily: "Nunito, sans-serif", textTransform: "capitalize",
                    }}>
                      {tab}
                    </button>
                  ))}
                </div>

                {suggestLoading ? (
                  <div className="loading"><div className="spinner" /></div>
                ) : suggestions.length === 0 ? (
                  <div style={{ padding: "40px 0", textAlign: "center", fontSize: 14, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                    No {suggestionFilter} suggestions.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {suggestions.map((s) => {
                      const isExpanded = expandedSuggest === s.id;
                      const isPromoting = promotingId === s.id;
                      const CAT_COLORS: Record<string, string> = {
                        postpartum: "#9d174d", newborn: "#1e50a2",
                        pregnancy:  "#1a7a5e", labour:   "#b45309",
                      };
                      const catColor = CAT_COLORS[s.category] ?? "var(--mid)";

                      return (
                        <div key={s.id} style={{ background: "white", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
                          <div
                            style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                            onClick={() => setExpandedSuggest(isExpanded ? null : s.id)}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 800, color: "var(--ink)", marginBottom: 3 }}>
                                {s.itemName}
                                {s.suggestedByCount > 1 && (
                                  <span style={{ marginLeft: 8, fontSize: 11, background: "#e8f5f1", color: "var(--green)", fontWeight: 800, padding: "2px 8px", borderRadius: 20 }}>
                                    {s.suggestedByCount} mothers
                                  </span>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: catColor, textTransform: "capitalize" }}>{s.category}</span>
                                {s.notes && <span style={{ fontSize: 11, color: "var(--mid)" }}>· {s.notes.slice(0, 60)}{s.notes.length > 60 ? "…" : ""}</span>}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                              {s.status === "pending" && (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setPromotingId(s.id); setPromoteError(null); setPromoteForm({ sku: "", name: s.itemName, category: s.category, standardPriceCents: "", description: "" }); }}
                                    style={{ background: "#e8f5f1", color: "var(--green)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                                  >
                                    Promote to SKU
                                  </button>
                                  <button
                                    onClick={async (e) => { e.stopPropagation(); await fetch(`/api/admin/register/suggestions/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "decline" }) }); fetchSuggestions(suggestionFilter); }}
                                    style={{ background: "#fef2f2", color: "#c0392b", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                                  >
                                    Decline
                                  </button>
                                  <button
                                    onClick={async (e) => { e.stopPropagation(); await fetch(`/api/admin/register/suggestions/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "duplicate" }) }); fetchSuggestions(suggestionFilter); }}
                                    style={{ background: "#f3f4f6", color: "var(--mid)", border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                                  >
                                    Duplicate
                                  </button>
                                </>
                              )}
                              {s.status !== "pending" && (
                                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: s.status === "promoted" ? "#e8f5f1" : "#f3f4f6", color: s.status === "promoted" ? "var(--green)" : "var(--mid)", textTransform: "capitalize" }}>
                                  {s.status}
                                </span>
                              )}
                              <span style={{ fontSize: 13, color: "var(--mid)" }}>{isExpanded ? "▲" : "▼"}</span>
                            </div>
                          </div>

                          {/* Promote form */}
                          {isPromoting && s.status === "pending" && (
                            <div style={{ borderTop: "1px solid var(--border)", padding: "16px", background: "#f8faf9" }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", fontFamily: "Nunito, sans-serif", marginBottom: 12 }}>Promote to SKU</div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                                <div>
                                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--mid)", marginBottom: 4, fontFamily: "Nunito, sans-serif" }}>SKU *</label>
                                  <input style={{ width: "100%", padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "Nunito, sans-serif" }} placeholder="e.g. F11" value={promoteForm.sku} onChange={(e) => setPromoteForm(p => ({ ...p, sku: e.target.value }))} />
                                </div>
                                <div>
                                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--mid)", marginBottom: 4, fontFamily: "Nunito, sans-serif" }}>Category *</label>
                                  <input style={{ width: "100%", padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "Nunito, sans-serif" }} value={promoteForm.category} onChange={(e) => setPromoteForm(p => ({ ...p, category: e.target.value }))} />
                                </div>
                              </div>
                              <div style={{ marginBottom: 10 }}>
                                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--mid)", marginBottom: 4, fontFamily: "Nunito, sans-serif" }}>Item name *</label>
                                <input style={{ width: "100%", padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "Nunito, sans-serif" }} value={promoteForm.name} onChange={(e) => setPromoteForm(p => ({ ...p, name: e.target.value }))} />
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                                <div>
                                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--mid)", marginBottom: 4, fontFamily: "Nunito, sans-serif" }}>Price (cents) *</label>
                                  <input type="number" style={{ width: "100%", padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "Nunito, sans-serif" }} placeholder="e.g. 1650" value={promoteForm.standardPriceCents} onChange={(e) => setPromoteForm(p => ({ ...p, standardPriceCents: e.target.value }))} />
                                </div>
                                <div>
                                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--mid)", marginBottom: 4, fontFamily: "Nunito, sans-serif" }}>Description (optional)</label>
                                  <input style={{ width: "100%", padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "Nunito, sans-serif" }} value={promoteForm.description} onChange={(e) => setPromoteForm(p => ({ ...p, description: e.target.value }))} />
                                </div>
                              </div>
                              {promoteError && <div style={{ fontSize: 12, color: "#c0392b", marginBottom: 8 }}>{promoteError}</div>}
                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  onClick={async () => {
                                    const r = await fetch(`/api/admin/register/suggestions/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "promote", skuData: promoteForm }) });
                                    const d = await r.json().catch(() => ({}));
                                    if (!r.ok) { setPromoteError(d.error ?? "Failed"); return; }
                                    setPromotingId(null); fetchSuggestions(suggestionFilter);
                                  }}
                                  style={{ background: "var(--green)", color: "white", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                                >
                                  Create SKU
                                </button>
                                <button onClick={() => setPromotingId(null)} style={{ background: "var(--bg)", color: "var(--mid)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Expanded individual submissions */}
                          {isExpanded && s.similarSuggestions.length > 0 && (
                            <div style={{ borderTop: "1px solid var(--border)", padding: "12px 16px", background: "var(--bg)" }}>
                              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                All submissions ({s.similarSuggestions.length})
                              </div>
                              {s.similarSuggestions.map((sub, i) => (
                                <div key={sub.id} style={{ padding: "8px 0", borderBottom: i < s.similarSuggestions.length - 1 ? "1px solid var(--border)" : "none", fontSize: 12, fontFamily: "Nunito, sans-serif", color: "var(--mid)" }}>
                                  <span style={{ color: "var(--ink)" }}>{sub.notes ?? <em>No notes</em>}</span>
                                  <span style={{ marginLeft: 8, fontSize: 11 }}>· {new Date(sub.createdAt).toLocaleDateString()}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── IMPACT ───────────────────────────────────────────────── */}
            {section === "impact" && (
              <div style={{ fontFamily: "Nunito, sans-serif" }}>

                {/* Header */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontFamily: "Lora, serif", fontSize: 24, fontWeight: 700, color: "#1a1a1a", marginBottom: 4 }}>Platform Impact</div>
                  <div style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>Lifetime data across all channels</div>
                  {impactData?.firstActionDate && (
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      From {new Date(impactData.firstActionDate).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })} to today
                    </div>
                  )}
                </div>

                {impactLoading && <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="spinner" /></div>}

                {impactData && (() => {
                  const d = impactData;
                  const total   = Math.max(d.venn.totalMothersInNeed, 1);
                  const bFilled = Math.round((d.venn.bundles.helped   / total) * 50);
                  const rFilled = Math.round((d.venn.registers.helped / total) * 50);
                  const dFilled = Math.round((d.venn.discover.helped  / total) * 50);
                  const pLabel  = (n: number) => `${n} of ${total}`;

                  const trendData = d.trend.slice(-12);
                  const maxVal = Math.max(...trendData.map(t => t.total), 1);
                  const CW = 700, CH = 200, PT = 16, PB = 36, PL = 50, PR = 16;
                  const cw = CW - PL - PR, ch = CH - PT - PB;
                  const xs = (i: number) => PL + (trendData.length > 1 ? (i / (trendData.length - 1)) * cw : cw / 2);
                  const ys = (v: number) => PT + ch - (v / maxVal) * ch;
                  const pathD = (key: "total" | "bundles" | "registers" | "discover") =>
                    trendData.map((t, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(t[key]).toFixed(1)}`).join(" ");

                  return (
                    <>
                      {/* ── Totals strip ──────────────────────────────────────── */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
                        {[
                          { label: "Moms Served",          value: d.totals.momsServed.toLocaleString(),   color: "#1a7a5e", bg: "#e8f5f1" },
                          { label: "Essentials Delivered",  value: d.totals.essentials.toLocaleString(),   color: "#7c5fc2", bg: "#f0ecfb" },
                          { label: "Contributors",          value: d.totals.contributors.toLocaleString(), color: "#b07840", bg: "#fef3c7" },
                          { label: "Total Missions",        value: d.totals.missions.toLocaleString(),      color: "#4a7a3a", bg: "#f0fdf4" },
                        ].map(({ label, value, color, bg }) => (
                          <div key={label} style={{ background: bg, borderRadius: 14, padding: "18px 16px", border: `1.5px solid ${color}22` }}>
                            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: 1, color, marginBottom: 6 }}>{label}</div>
                            <div style={{ fontFamily: "Lora, serif", fontSize: 28, fontWeight: 700, color }}>{value}</div>
                          </div>
                        ))}
                      </div>

                      {/* ── Venn + Channel cards ─────────────────────────────── */}
                      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, marginBottom: 24 }}>

                        <div style={{ background: "white", borderRadius: 16, padding: "20px 16px", border: "1px solid #ede8df" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#1a7a5e", letterSpacing: 1.2, textTransform: "uppercase" as const, marginBottom: 12 }}>Lifetime Reach — Venn</div>
                          <svg viewBox="0 0 600 540" width="100%" style={{ display: "block" }}>
                            <circle cx={300} cy={180} r={170} fill="rgba(168,155,217,0.08)" stroke="#a89bd9" strokeWidth={1.8} />
                            <circle cx={200} cy={340} r={170} fill="rgba(212,165,116,0.08)" stroke="#d4a574" strokeWidth={1.8} />
                            <circle cx={400} cy={340} r={170} fill="rgba(141,181,128,0.10)" stroke="#8db580" strokeWidth={1.8} />
                            <text x={300} y={70}  textAnchor="middle" fill="#7c5fc2" fontWeight={700} fontSize={13} letterSpacing={1.4}>🎁 BUNDLES</text>
                            <text x={140} y={492} textAnchor="middle" fill="#b07840" fontWeight={700} fontSize={12}>📦 REGISTERS</text>
                            <text x={460} y={492} textAnchor="middle" fill="#4a7a3a" fontWeight={700} fontSize={12}>🛍️ DISCOVER</text>
                            <text x={300} y={115} textAnchor="middle" fill="#7c5fc2" fontWeight={700} fontSize={22} fontFamily="Lora, serif">{pLabel(d.venn.bundles.helped)}</text>
                            {Array.from({ length: 50 }, (_, idx) => { const row = Math.floor(idx / 10), col = idx % 10; return <rect key={`b${idx}`} x={230 + col * 14} y={124 + row * 14} width={12} height={12} rx={2} fill={idx < bFilled ? "#c4b8e8" : "#d4cfc8"} />; })}
                            <text x={300} y={208} textAnchor="middle" fill="#8a8a8a" fontSize={10}>of moms supported</text>
                            <text x={200} y={282} textAnchor="middle" fill="#b07840" fontWeight={700} fontSize={22} fontFamily="Lora, serif">{pLabel(d.venn.registers.helped)}</text>
                            {Array.from({ length: 50 }, (_, idx) => { const row = Math.floor(idx / 10), col = idx % 10; return <rect key={`r${idx}`} x={130 + col * 14} y={290 + row * 14} width={12} height={12} rx={2} fill={idx < rFilled ? "#e8b87c" : "#d4cfc8"} />; })}
                            <text x={200} y={374} textAnchor="middle" fill="#8a8a8a" fontSize={10}>of moms supported</text>
                            <text x={400} y={282} textAnchor="middle" fill="#4a7a3a" fontWeight={700} fontSize={22} fontFamily="Lora, serif">{pLabel(d.venn.discover.helped)}</text>
                            {Array.from({ length: 50 }, (_, idx) => { const row = Math.floor(idx / 10), col = idx % 10; return <rect key={`d${idx}`} x={330 + col * 14} y={290 + row * 14} width={12} height={12} rx={2} fill={idx < dFilled ? "#8db580" : "#d4cfc8"} />; })}
                            <text x={400} y={374} textAnchor="middle" fill="#8a8a8a" fontSize={10}>of moms supported</text>
                            <text x={300} y={255} textAnchor="middle" fill="#1a7a5e" fontWeight={700} fontSize={9} letterSpacing={1.5}>ALL 3 AREAS</text>
                            <text x={300} y={274} textAnchor="middle" fontSize={16}>💚</text>
                            <text x={300} y={300} textAnchor="middle" fill="#1a7a5e" fontWeight={700} fontSize={26} fontFamily="Lora, serif">{pLabel(d.venn.allThreeAreas.helped)}</text>
                            <text x={300} y={318} textAnchor="middle" fill="#6b7280" fontSize={10}>of moms</text>
                          </svg>
                          <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "center", marginTop: 4 }}>Each square represents 2% of lifetime moms in need</div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                          {[
                            { label: "Bundles",   icon: "🎁", color: "#7c5fc2", bg: "#f5f3fc", line1: `${d.channels.bundles.delivered} delivered`,   line2: `${d.channels.bundles.momsReached} moms reached`,   line3: `${d.channels.bundles.total} total applications`   },
                            { label: "Registers", icon: "📦", color: "#b07840", bg: "#fef9f0", line1: `${d.channels.registers.delivered} items fulfilled`, line2: `${d.channels.registers.momsReached} moms reached`, line3: `${d.channels.registers.total} total register items` },
                            { label: "Discover",  icon: "🛍️", color: "#4a7a3a", bg: "#f0fdf4", line1: `${d.channels.discover.fulfilled} items fulfilled`,  line2: `${d.channels.discover.momsReached} moms reached`,  line3: `${d.channels.discover.total} total requests`       },
                          ].map(({ label, icon, color, bg, line1, line2, line3 }) => (
                            <div key={label} style={{ background: bg, borderRadius: 14, padding: "16px 18px", border: `1.5px solid ${color}22`, flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 800, color, marginBottom: 8 }}>{icon} {label}</div>
                              <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color, marginBottom: 4 }}>{line1}</div>
                              <div style={{ fontSize: 12, color: "#555", marginBottom: 2 }}>{line2}</div>
                              <div style={{ fontSize: 11, color: "#9ca3af" }}>{line3}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── Monthly trend chart ──────────────────────────────── */}
                      <div style={{ background: "white", borderRadius: 16, padding: "20px", border: "1px solid #ede8df", marginBottom: 24 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#1a7a5e", letterSpacing: 1.2, textTransform: "uppercase" as const, marginBottom: 4 }}>Essentials Delivered per Month</div>
                        <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                          {([["Total","#1a7a5e",""],["Bundles","#a89bd9","4 2"],["Registers","#d4a574","4 2"],["Discover","#8db580","4 2"]] as [string,string,string][]).map(([lbl, clr, dash]) => (
                            <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#555" }}>
                              <svg width={24} height={8}><line x1={0} y1={4} x2={24} y2={4} stroke={clr} strokeWidth={2} strokeDasharray={dash} /></svg>
                              {lbl}
                            </div>
                          ))}
                        </div>
                        {trendData.length === 0 ? (
                          <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af", fontSize: 13 }}>No trend data yet</div>
                        ) : (
                          <svg viewBox={`0 0 ${CW} ${CH}`} width="100%" style={{ display: "block" }}>
                            {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                              const y = PT + ch * (1 - frac);
                              return (
                                <g key={frac}>
                                  <line x1={PL} y1={y} x2={PL + cw} y2={y} stroke="#f0f0f0" strokeWidth={1} />
                                  <text x={PL - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{Math.round(maxVal * frac)}</text>
                                </g>
                              );
                            })}
                            <path d={pathD("total")}     fill="none" stroke="#1a7a5e" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                            <path d={pathD("bundles")}   fill="none" stroke="#a89bd9" strokeWidth={1.5} strokeDasharray="4 2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d={pathD("registers")} fill="none" stroke="#d4a574" strokeWidth={1.5} strokeDasharray="4 2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d={pathD("discover")}  fill="none" stroke="#8db580" strokeWidth={1.5} strokeDasharray="4 2" strokeLinecap="round" strokeLinejoin="round" />
                            {trendData.map((t, i) => (
                              <text key={i} x={xs(i)} y={CH - 8} textAnchor="middle" fontSize={9} fill="#9ca3af">
                                {t.month.slice(5)}/{t.month.slice(2, 4)}
                              </text>
                            ))}
                          </svg>
                        )}
                      </div>

                      {/* ── Bottom row: Top teams + Fulfillment rates ─────────── */}
                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20 }}>

                        <div style={{ background: "white", borderRadius: 16, padding: "20px", border: "1px solid #ede8df" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#1a7a5e", letterSpacing: 1.2, textTransform: "uppercase" as const, marginBottom: 4 }}>Top 5 Mission Teams</div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 14 }}>Teams contributing the most essentials over time</div>
                          {d.topTeams.length === 0 ? (
                            <div style={{ color: "#9ca3af", fontSize: 13, padding: "20px 0" }}>No team data yet</div>
                          ) : d.topTeams.map((team, rank) => (
                            <div key={team.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: rank < d.topTeams.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                              <div style={{ width: 28, height: 28, borderRadius: "50%", background: rank === 0 ? "#fde68a" : "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, color: rank === 0 ? "#92400e" : "#555", flexShrink: 0 }}>
                                {rank + 1}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.missionName}</div>
                                <div style={{ fontSize: 11, color: "#9ca3af" }}>{team.month} · {team.memberCount} members · Tier {team.tier}</div>
                              </div>
                              <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: "#1a7a5e", flexShrink: 0 }}>{team.lifetimeEssentials.toLocaleString()}</div>
                            </div>
                          ))}
                        </div>

                        <div style={{ background: "white", borderRadius: 16, padding: "20px", border: "1px solid #ede8df" }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: "#1a7a5e", letterSpacing: 1.2, textTransform: "uppercase" as const, marginBottom: 4 }}>Fulfillment Rate by Channel</div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 20 }}>% of needs fulfilled out of total received</div>
                          {[
                            { label: "🎁 Bundles",   rate: d.fulfillmentRates.bundles,   total: d.fulfillmentRates.bundlesTotal,   color: "#7c5fc2" },
                            { label: "📦 Registers", rate: d.fulfillmentRates.registers, total: d.fulfillmentRates.registersTotal, color: "#b07840" },
                            { label: "🛍️ Discover",  rate: d.fulfillmentRates.discover,  total: d.fulfillmentRates.discoverTotal,  color: "#4a7a3a" },
                          ].map(({ label, rate, total, color }) => (
                            <div key={label} style={{ marginBottom: 20 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{label}</span>
                                <span style={{ fontSize: 13, fontWeight: 800, color }}>{rate}%</span>
                              </div>
                              <div style={{ height: 10, background: "#f5f5f5", borderRadius: 6, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${rate}%`, background: color, borderRadius: 6 }} />
                              </div>
                              <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{total.toLocaleString()} total</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
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
