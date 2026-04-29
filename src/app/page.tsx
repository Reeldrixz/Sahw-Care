"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import ListCard, { ItemData } from "@/components/ListCard";
import DonateModal from "@/components/DonateModal";
import Toast from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/Avatar";
import {
  MapPin, Lock, CheckCircle, XCircle, MessageCircle,
  Gift, Search, Package, Bell, X, ChevronDown,
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import RequestReviewSheet from "@/components/RequestReviewSheet";
import BundleStatusTracker from "@/components/BundleStatusTracker";
import FulfillmentConfirmBanner, { PendingFulfillment } from "@/components/FulfillmentConfirmBanner";
import FulfillmentStatusBadge from "@/components/FulfillmentStatusBadge";
import LocationSelector from "@/components/LocationSelector";
import SearchBar from "@/components/SearchBar";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BundleItem { name: string; quantity: string }
interface LiveCampaign {
  id: string; title: string; sponsorName: string;
  bundlesRemaining: number; totalBundles: number;
  template: { name: string; itemSummary: string; items: BundleItem[] };
  eligibility: { eligible: boolean; reason: string | null; daysUntilEligible?: number };
}
interface MyBundle {
  id: string; status: string; requestedAt: string;
  approvedAt: string | null; shippedAt: string | null; confirmedAt: string | null;
  trackingNumber: string | null;
  campaign: { title: string; sponsorName: string };
  template: { name: string; items: BundleItem[] };
}
interface ToFulfillItem {
  requestId: string; itemId: string; itemTitle: string;
  requesterName: string; requesterAvatar: string | null; requestedAt: string;
}
interface DonorSentItem {
  requestId: string; itemTitle: string; recipientName: string;
  fulfillStatus: "PENDING" | "DISPUTED";
  markedAt: string; respondedAt: string | null;
}
interface PendingRequest {
  requestId: string; itemId: string; itemTitle: string;
  requesterId: string; requesterName: string; requesterAvatar: string | null;
  requesterTrustScore: number;
  reasonForRequest: string | null; whoIsItFor: string | null; pickupPreference: string | null;
  requestedAt: string;
}

// ── Category config ────────────────────────────────────────────────────────────

const CATS = [
  { display: "Everything",           api: "All"       },
  { display: "Feeding & Formula",    api: "Feeding"   },
  { display: "Nappies & Wipes",      api: "Diapering" },
  { display: "Baby Clothing",        api: "Clothing"  },
  { display: "Baby Hygiene",         api: "Hygiene"   },
  { display: "Maternity",            api: "Maternity" },
  { display: "Maternity & Recovery", api: "Recovery"  },
  { display: "Travel & Gear",        api: "Travel"    },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function useTooltipDismissed() {
  const KEY = "kradel_fab_tooltip_dismissed";
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(KEY) === "1";
  });
  const dismiss = () => {
    localStorage.setItem(KEY, "1");
    setDismissed(true);
  };
  return [dismissed, dismiss] as const;
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const { user, refreshUser, loading } = useAuth();
  const router = useRouter();

  const [allItems,        setAllItems]        = useState<ItemData[]>([]);
  const [total,           setTotal]           = useState(0);
  const [requested,       setRequested]       = useState<Record<string, boolean>>({});
  const [favs,            setFavs]            = useState<Record<string, boolean>>({});
  const [search,          setSearch]          = useState("");
  const [catIdx,          setCatIdx]          = useState(0);
  const [toast,           setToast]           = useState<string | null>(null);
  const [showDonate,      setShowDonate]      = useState(false);
  const [trustCount,      setTrustCount]      = useState(0);
  const [campaigns,       setCampaigns]       = useState<LiveCampaign[]>([]);
  const [myBundle,        setMyBundle]        = useState<MyBundle | null>(null);
  const [toConfirm,       setToConfirm]       = useState<PendingFulfillment[]>([]);
  const [toFulfill,       setToFulfill]       = useState<ToFulfillItem[]>([]);
  const [donorSentItems,  setDonorSentItems]  = useState<DonorSentItem[]>([]);
  const [fulfillNote,     setFulfillNote]     = useState<Record<string, string>>({});
  const [fulfillLoading,  setFulfillLoading]  = useState<Record<string, boolean>>({});
  const [fulfillDone,     setFulfillDone]     = useState<Record<string, boolean>>({});
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [reviewItem,      setReviewItem]      = useState<ItemData | null>(null);
  const [reviewLoading,   setReviewLoading]   = useState<Record<string, boolean>>({});
  const [loadingItems,     setLoadingItems]     = useState(true);
  const [noLocalItems,     setNoLocalItems]     = useState(false);
  const [showLocationSheet,setShowLocationSheet]= useState(false);
  const [activeCity,       setActiveCity]       = useState<string | null>(null);
  const [activeRadius,     setActiveRadius]     = useState(10);
  const [activeSetByGPS,   setActiveSetByGPS]   = useState(false);

  const [tooltipDismissed, dismissTooltip] = useTooltipDismissed();
  const locationInitRef = useRef(false);

  const selectedCat = CATS[catIdx];
  const showToast = (msg: string) => setToast(msg);

  // ── Location init — from user.preferredCity or localStorage ───────────────
  useEffect(() => {
    if (loading || locationInitRef.current) return;
    locationInitRef.current = true;

    if (user?.preferredCity) {
      setActiveCity(user.preferredCity);
      setActiveRadius(user.preferredRadius ?? 10);
      setActiveSetByGPS(user.locationSetByGPS ?? false);
      return;
    }

    try {
      const stored = localStorage.getItem("kradel_location");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.city) {
          setActiveCity(parsed.city);
          setActiveRadius(parsed.radius ?? 10);
          setActiveSetByGPS(parsed.setByGPS ?? false);
          // Migrate to DB if logged in but no preferredCity yet
          if (user) {
            fetch("/api/user/location", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ city: parsed.city, radius: parsed.radius ?? 10, setByGPS: parsed.setByGPS ?? false }),
            }).catch(() => {});
          }
        }
      }
    } catch { /* ignore */ }
  }, [loading, user]);

  // ── Trust strip count ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeCity) return;
    fetch(`/api/items/trust-stats?city=${encodeURIComponent(activeCity)}`)
      .then((r) => r.json())
      .then((d) => setTrustCount(d.fulfilledThisMonth ?? 0))
      .catch(() => {});
  }, [activeCity]);

  // ── Fetch items ────────────────────────────────────────────────────────────
  const fetchItems = useCallback(async () => {
    setLoadingItems(true);
    const params = new URLSearchParams();
    if (selectedCat.api !== "All") params.set("category", selectedCat.api);
    if (search) params.set("search", search);
    if (activeCity) params.set("location", activeCity);
    params.set("limit", "50");
    const res = await fetch(`/api/items?${params}`);
    if (res.ok) {
      const data = await res.json();
      let items: ItemData[] = data.items ?? [];

      // Fallback: if city filter returned nothing, load all items and show notice
      if (activeCity && !search && items.length === 0) {
        const fallbackParams = new URLSearchParams();
        if (selectedCat.api !== "All") fallbackParams.set("category", selectedCat.api);
        fallbackParams.set("limit", "50");
        const res2 = await fetch(`/api/items?${fallbackParams}`);
        if (res2.ok) {
          const data2 = await res2.json();
          items = data2.items ?? [];
          setNoLocalItems(true);
        }
      } else {
        setNoLocalItems(false);
      }

      setAllItems(items);
      setTotal(items.length);
    }
    setLoadingItems(false);
  }, [selectedCat.api, search, activeCity]);

  useEffect(() => {
    const t = setTimeout(fetchItems, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchItems, search]);

  // ── Favourites ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetch("/api/favourites")
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, boolean> = {};
        (d.itemIds ?? []).forEach((id: string) => { map[id] = true; });
        setFavs(map);
      })
      .catch(() => {});
  }, [user]);

  const toggleFav = useCallback(async (itemId: string) => {
    setFavs((f) => ({ ...f, [itemId]: !f[itemId] }));
    if (!user) return;
    try {
      const res = await fetch("/api/favourites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const d = await res.json();
      if (res.ok) setFavs((f) => ({ ...f, [itemId]: d.favourited }));
    } catch {
      setFavs((f) => ({ ...f, [itemId]: !f[itemId] }));
    }
  }, [user]);

  // ── Bundle campaigns ───────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/bundles").then((r) => r.json()).then((d) => setCampaigns(d.campaigns ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user || user.journeyType === "donor" || !user.activeBundleId) return;
    fetch("/api/bundles/my").then((r) => r.json()).then((d) => {
      const active = (d.instances ?? []).find((i: MyBundle) => !["COMPLETED", "REJECTED"].includes(i.status));
      setMyBundle(active ?? null);
    }).catch(() => {});
  }, [user]);

  // ── Fulfillment pending ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetch("/api/fulfillment/pending")
      .then((r) => r.json())
      .then((d) => {
        setToConfirm(d.toConfirm ?? []);
        setToFulfill(d.toFulfill ?? []);
        setDonorSentItems(d.donorSentItems ?? []);
        setPendingRequests(d.pendingRequests ?? []);
      })
      .catch(() => {});
  }, [user]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleMarkSent = async (requestId: string) => {
    if (fulfillLoading[requestId]) return;
    setFulfillLoading((p) => ({ ...p, [requestId]: true }));
    try {
      const note = fulfillNote[requestId]?.trim() || undefined;
      const res = await fetch(`/api/requests/${requestId}/fulfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donorNote: note ?? null }),
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.error ?? "Something went wrong"); return; }
      setFulfillDone((p) => ({ ...p, [requestId]: true }));
      const sentItem = toFulfill.find((r) => r.requestId === requestId);
      if (sentItem) {
        setDonorSentItems((prev) => [
          { requestId, itemTitle: sentItem.itemTitle, recipientName: sentItem.requesterName, fulfillStatus: "PENDING", markedAt: new Date().toISOString(), respondedAt: null },
          ...prev,
        ]);
      }
      showToast("Marked as sent! Recipient will be notified.");
    } finally {
      setFulfillLoading((p) => ({ ...p, [requestId]: false }));
    }
  };

  const handleRequest = (item: ItemData) => {
    if (!user) { router.push("/auth"); return; }
    if (user.activeRequestLockedUntil && new Date(user.activeRequestLockedUntil) > new Date()) {
      const msLeft = new Date(user.activeRequestLockedUntil).getTime() - Date.now();
      const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
      showToast(`Request limit reached. Try again in ${hoursLeft}h.`);
      return;
    }
    setReviewItem(item);
  };

  const handleAcceptRequest = async (requestId: string) => {
    if (reviewLoading[requestId]) return;
    setReviewLoading((p) => ({ ...p, [requestId]: true }));
    const res = await fetch(`/api/requests/${requestId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    if (res.ok) {
      const d = await res.json();
      setPendingRequests((p) => p.filter((r) => r.requestId !== requestId));
      showToast("Request accepted — recipient has been notified.");
      if (d.conversationId) setTimeout(() => router.push(`/chat?conv=${d.conversationId}`), 800);
    } else {
      showToast("Something went wrong");
    }
    setReviewLoading((p) => ({ ...p, [requestId]: false }));
  };

  const handleDeclineRequest = async (requestId: string) => {
    if (reviewLoading[requestId]) return;
    setReviewLoading((p) => ({ ...p, [requestId]: true }));
    const res = await fetch(`/api/requests/${requestId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline" }),
    });
    if (res.ok) {
      setPendingRequests((p) => p.filter((r) => r.requestId !== requestId));
      showToast("Request declined");
    } else {
      showToast("Something went wrong");
    }
    setReviewLoading((p) => ({ ...p, [requestId]: false }));
  };

  const handleDonate = async (formData: FormData) => {
    let imageUrl: string | undefined;
    const file = formData.get("file") as File | null;
    if (file && file.size > 0) {
      const fd = new FormData(); fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      if (up.ok) {
        const { url } = await up.json();
        imageUrl = url;
      } else {
        const upErr = await up.json().catch(() => ({}));
        showToast((upErr as { error?: string }).error ?? "Photo upload failed — listing saved without photo");
      }
    }
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: formData.get("title"), category: formData.get("category"),
        condition: formData.get("condition"), quantity: formData.get("quantity"),
        location: formData.get("location"), description: formData.get("description"),
        urgent: formData.get("urgent") === "true", images: imageUrl ? [imageUrl] : [],
      }),
    });
    if (res.ok) {
      setShowDonate(false);
      showToast("Listed! It'll appear after review.");
      fetchItems();
    } else {
      const d = await res.json();
      showToast(d.error ?? "Failed");
    }
  };

  // ── FAB role detection ────────────────────────────────────────────────────
  const isMother = user?.journeyType === "pregnant" || user?.journeyType === "postpartum";

  const fabAction = () => {
    if (!user) { router.push("/auth"); return; }
    setShowDonate(true);
  };

  // ── Location selection handler ─────────────────────────────────────────────
  const handleLocationSelect = useCallback((city: string, radius: number, byGPS: boolean) => {
    setActiveCity(city);
    setActiveRadius(radius);
    setActiveSetByGPS(byGPS);
    showToast(`Showing items in ${city}`);
    if (user) {
      fetch("/api/user/location", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, radius, setByGPS: byGPS }),
      }).catch(() => {});
    } else {
      try {
        localStorage.setItem("kradel_location", JSON.stringify({ city, radius, setByGPS: byGPS }));
      } catch { /* ignore */ }
    }
  }, [user]);

  const locationLabel = activeSetByGPS
    ? "Near you"
    : activeCity
    ? activeCity
    : "Set location";

  const locationLabelColor = activeSetByGPS ? "#1a7a5e" : activeCity ? "#1a1a1a" : "#555555";

  // ── Items filtered locally ─────────────────────────────────────────────────
  const filtered = allItems.filter((i) => {
    const matchSearch = !search ||
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  const isLocked = !!(user?.activeRequestLockedUntil && new Date(user.activeRequestLockedUntil) > new Date());

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">

        {/* ── Sticky top bar ──────────────────────────────────────────────── */}
        <div style={{ background: "var(--white)" }} className="discover-mobile-header">
          <div className="topbar">
            <button
              className="location-pill"
              onClick={() => setShowLocationSheet(true)}
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              <MapPin size={13} strokeWidth={2} color="#1a7a5e" style={{ flexShrink: 0 }} />
              <span style={{ color: locationLabelColor }}>{locationLabel}</span>
              <ChevronDown size={12} color="#1a7a5e" />
            </button>
            <div className="topbar-right">
              <NotificationBell />
              {user ? (
                <button className="icon-btn" onClick={() => router.push("/profile")} style={{ padding: 2, background: "none", border: "none" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden" }}>
                    <Avatar src={user.avatar} name={user.name} size={28} />
                  </div>
                </button>
              ) : (
                <button className="icon-btn" onClick={() => router.push("/auth")} style={{ background: "none", border: "none" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <MessageCircle size={14} color="var(--mid)" />
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Search bar */}
          <div className="search-wrap">
            <SearchBar value={search} onChange={setSearch} />
          </div>

          {/* Category chips */}
          <div className="cats" style={{ scrollbarWidth: "none" }}>
            {CATS.map((c, i) => (
              <button
                key={c.api}
                className={`cat-chip ${catIdx === i ? "active" : ""}`}
                onClick={() => setCatIdx(i)}
              >
                {c.display}
              </button>
            ))}
          </div>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────────── */}
        <div className="scroll">

          {/* No local items notice */}
          {noLocalItems && !search && (
            <div style={{ padding: "8px 16px", fontSize: 12, color: "#555555", fontFamily: "Nunito, sans-serif", background: "#fafafa", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span>No items in {activeCity ?? "your area"} yet. Showing all available items.</span>
              <button
                onClick={() => setShowLocationSheet(true)}
                style={{ fontSize: 12, fontWeight: 700, color: "#1a7a5e", background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "Nunito, sans-serif" }}
              >
                Change location
              </button>
            </div>
          )}

          {/* Community trust strip */}
          {trustCount > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#e8f5f1", height: 36, padding: "0 16px",
              fontSize: 12, color: "#1a5c45", fontFamily: "Nunito, sans-serif", fontWeight: 600,
            }}>
              <CheckCircle size={13} color="#1a7a5e" strokeWidth={2.5} />
              {trustCount} item{trustCount !== 1 ? "s" : ""} fulfilled{activeCity ? ` in ${activeCity}` : ""} this month · All donors verified
            </div>
          )}

          {/* Recipient fulfillment confirmations */}
          {toConfirm.length > 0 && (
            <div className="section">
              <div className="section-head">
                <div className="section-title">Confirm receipt</div>
              </div>
              <FulfillmentConfirmBanner
                items={toConfirm}
                onResolved={(reqId, status) => {
                  setToConfirm((p) => p.filter((i) => i.requestId !== reqId));
                  showToast(status === "VERIFIED" ? "Confirmed received! Thank you." : "Dispute reported — our team will review.");
                }}
              />
            </div>
          )}

          {/* Donor: incoming pending requests */}
          {pendingRequests.length > 0 && (
            <div className="section">
              <div className="section-head">
                <div className="section-title">New requests</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#d97706", background: "#fff8e1", border: "1px solid #fbbf24", borderRadius: 20, padding: "3px 10px" }}>
                  {pendingRequests.length} pending
                </div>
              </div>
              {pendingRequests.map((r) => {
                const isTrusted = r.requesterTrustScore >= 70;
                const whoLabel: Record<string, string> = { ME: "For themselves", MY_BABY: "For their baby", SOMEONE_I_CARE_FOR: "For someone they care for" };
                const pickupLabel: Record<string, string> = { PICKUP: "Can pick up", DELIVERY: "Needs delivery support" };
                return (
                  <div key={r.requestId} style={{ background: "var(--white)", borderRadius: 14, border: "1.5px solid var(--border)", padding: "14px 16px", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {r.requesterAvatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.requesterAvatar} alt={r.requesterName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <span style={{ fontSize: 18, fontWeight: 800 }}>{r.requesterName[0]}</span>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "Nunito, sans-serif" }}>{r.requesterName.split(" ")[0]}</div>
                        <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>re: {r.itemTitle}</div>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                        background: isTrusted ? "var(--green-light)" : "var(--bg)",
                        color: isTrusted ? "var(--green)" : "var(--mid)",
                        border: `1px solid ${isTrusted ? "var(--green)" : "var(--border)"}`,
                      }}>
                        {isTrusted ? "Trusted member" : "New member"}
                      </span>
                    </div>
                    {r.reasonForRequest && (
                      <div style={{ background: "var(--bg)", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Why they need it</div>
                        <div style={{ fontSize: 13, fontFamily: "Nunito, sans-serif", color: "var(--ink)", lineHeight: 1.5 }}>"{r.reasonForRequest}"</div>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                      {r.whoIsItFor && (
                        <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: "#e8f5f1", color: "#1a7a5e", fontFamily: "Nunito, sans-serif" }}>
                          {whoLabel[r.whoIsItFor] ?? r.whoIsItFor}
                        </span>
                      )}
                      {r.pickupPreference && (
                        <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: "#e3f2fd", color: "#1565c0", fontFamily: "Nunito, sans-serif" }}>
                          {pickupLabel[r.pickupPreference] ?? r.pickupPreference}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleAcceptRequest(r.requestId)}
                        disabled={reviewLoading[r.requestId]}
                        style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "none", background: "#1a7a5e", color: "white", fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: reviewLoading[r.requestId] ? "default" : "pointer", opacity: reviewLoading[r.requestId] ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                      >
                        <CheckCircle size={15} /> Accept
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(r.requestId)}
                        disabled={reviewLoading[r.requestId]}
                        style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1.5px solid var(--border)", background: "transparent", color: "var(--mid)", fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: reviewLoading[r.requestId] ? "default" : "pointer", opacity: reviewLoading[r.requestId] ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                      >
                        <XCircle size={15} /> Decline
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Donor: mark as sent */}
          {toFulfill.filter((r) => !fulfillDone[r.requestId]).length > 0 && (
            <div className="section">
              <div className="section-head">
                <div className="section-title">Mark items as sent</div>
              </div>
              {toFulfill.filter((r) => !fulfillDone[r.requestId]).map((r) => (
                <div key={r.requestId} style={{ background: "var(--white)", borderRadius: 14, border: "1.5px solid var(--border)", padding: "14px 16px", marginBottom: 10 }}>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 800, marginBottom: 2 }}>{r.itemTitle}</div>
                    <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>Requested by {r.requesterName}</div>
                  </div>
                  <input
                    type="text"
                    placeholder="Optional note (e.g. 'Shipped via Canada Post')"
                    value={fulfillNote[r.requestId] ?? ""}
                    onChange={(e) => setFulfillNote((p) => ({ ...p, [r.requestId]: e.target.value }))}
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid var(--border)", fontSize: 12, fontFamily: "Nunito, sans-serif", outline: "none", marginBottom: 10, boxSizing: "border-box" }}
                  />
                  <button
                    onClick={() => handleMarkSent(r.requestId)}
                    disabled={!!fulfillLoading[r.requestId]}
                    style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: "#1a7a5e", color: "white", fontSize: 13, fontWeight: 800, cursor: fulfillLoading[r.requestId] ? "default" : "pointer", fontFamily: "Nunito, sans-serif", opacity: fulfillLoading[r.requestId] ? 0.6 : 1 }}
                  >
                    {fulfillLoading[r.requestId] ? "…" : "Mark as sent"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Donor: sent items tracking */}
          {donorSentItems.length > 0 && (
            <div className="section">
              <div className="section-head"><div className="section-title">Items you sent</div></div>
              {donorSentItems.map((item) => {
                const isDisputed = item.fulfillStatus === "DISPUTED";
                return (
                  <div key={item.requestId} style={{ background: "var(--white)", borderRadius: 14, border: `2px solid ${isDisputed ? "#c0392b" : "var(--border)"}`, padding: "14px 16px", marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 800, marginBottom: 2 }}>{item.itemTitle}</div>
                        <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>For {item.recipientName}</div>
                      </div>
                      <FulfillmentStatusBadge status={item.fulfillStatus} small />
                    </div>
                    {isDisputed && (
                      <div style={{ marginTop: 10, padding: "9px 12px", background: "#fdecea", borderRadius: 8, fontSize: 12, color: "#c0392b", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>
                        The recipient reported they did not receive this item. Our team has been notified.
                      </div>
                    )}
                    {!isDisputed && (
                      <div style={{ marginTop: 8, fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                        Waiting for recipient to confirm · auto-confirms in 7 days
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Request limit banner */}
          {user && user.role === "RECIPIENT" && (() => {
            const locked2 = !!(user.activeRequestLockedUntil && new Date(user.activeRequestLockedUntil) > new Date());
            const count = user.requestCountSinceReset ?? 0;
            if (!locked2 && count < 5) return null;
            if (locked2) {
              const msLeft = new Date(user.activeRequestLockedUntil!).getTime() - Date.now();
              const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
              return (
                <div style={{ margin: "0 16px 14px", padding: "12px 14px", background: "#fff8e1", border: "1.5px solid #f59e0b", borderRadius: 12, display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <Lock size={18} color="#b45309" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#92400e" }}>Request limit reached</div>
                    <div style={{ fontSize: 12, color: "#b45309", marginTop: 2, lineHeight: 1.4 }}>Unlocks in {hoursLeft} hour{hoursLeft === 1 ? "" : "s"} — or sooner when you confirm receipt of pending items.</div>
                  </div>
                </div>
              );
            }
            return (
              <div style={{ margin: "0 16px 14px", padding: "9px 14px", background: "#fff8e1", border: "1.5px solid #fbbf24", borderRadius: 12, fontSize: 12, fontWeight: 700, color: "#92400e", display: "flex", alignItems: "center", gap: 8 }}>
                <Lock size={15} color="#b45309" />
                {count} of 8 requests used · limit resets after confirming received items
              </div>
            );
          })()}

          {/* ── Bundle section ─────────────────────────────────────────────── */}
          {(campaigns.length > 0 || myBundle) && (
            <div className="section">
              <div className="section-head" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                <div className="section-title">Community bundles</div>
                <div style={{ fontSize: 12, color: "#555555", fontFamily: "Nunito, sans-serif" }}>Funded together, delivered by Kradəl</div>
              </div>

              {myBundle && (
                <div style={{ marginBottom: 14 }}>
                  <BundleStatusTracker
                    instance={myBundle}
                    onConfirmed={() => { setMyBundle(null); setToast("Bundle confirmed! Thank you."); }}
                  />
                </div>
              )}

              {!myBundle && campaigns.length > 0 && (
                <div className="hscroll">
                  {campaigns.map((c) => {
                    const { eligible, reason, daysUntilEligible } = c.eligibility;
                    const CARD_COLORS = ["#e8f5f1", "#fff8e6", "#f0f4ff", "#fdf0e8"];
                    const bg = CARD_COLORS[campaigns.indexOf(c) % CARD_COLORS.length];
                    return (
                      <div key={c.id} className="bundle-card" onClick={() => router.push(`/bundles/${c.id}`)}>
                        <div className="bundle-img" style={{ background: bg }}>
                          <div className="bundle-tag" style={{ background: "white", color: "var(--green)", border: "1.5px solid var(--green)" }}>
                            {c.bundlesRemaining} left
                          </div>
                          <Package size={36} color="#1a7a5e" strokeWidth={1.25} style={{ opacity: 0.6 }} />
                        </div>
                        <div className="bundle-body">
                          <div className="bundle-title">{c.template.name}</div>
                          <div className="bundle-items">Includes: {c.template.itemSummary}</div>
                          <div className="bundle-footer">
                            <div className="bundle-count">{c.template.items.length} items</div>
                            {eligible ? (
                              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--green)" }}>Request →</div>
                            ) : reason === "not_logged_in" ? (
                              <div style={{ fontSize: 11, color: "var(--mid)" }}>Sign in →</div>
                            ) : reason === "not_verified" ? (
                              <div style={{ fontSize: 11, color: "var(--mid)" }}>Verify to unlock</div>
                            ) : reason === "cooldown" ? (
                              <div style={{ fontSize: 11, color: "var(--mid)" }}>In {daysUntilEligible}d</div>
                            ) : reason === "active_bundle" ? (
                              <div style={{ fontSize: 11, color: "var(--mid)" }}>In progress</div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Items section ──────────────────────────────────────────────── */}
          <div className="section" style={{ paddingBottom: 100 }}>
            <div className="section-head" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <div className="section-title">Available near you</div>
              <div style={{ fontSize: 11, color: "#555555", fontFamily: "Nunito, sans-serif" }}>Nearest · Most recent</div>
            </div>

            {loadingItems ? (
              <div className="loading"><div className="spinner" /></div>
            ) : filtered.length === 0 && search ? (
              // Empty state: no search results
              <div style={{ textAlign: "center", padding: "60px 20px 40px" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Search size={28} color="#9ca3af" strokeWidth={1.5} />
                </div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
                  Nothing found for &ldquo;{search}&rdquo;
                </div>
                <div style={{ fontSize: 13, color: "#555555", marginBottom: 20, lineHeight: 1.6 }}>
                  Try a different category or broaden your search.
                </div>
                <button
                  onClick={() => setSearch("")}
                  style={{ padding: "10px 24px", borderRadius: 12, border: "1.5px solid var(--border)", background: "white", color: "var(--ink)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                >
                  Clear search
                </button>
              </div>
            ) : filtered.length === 0 ? (
              // Empty state: no nearby items
              <div style={{ textAlign: "center", padding: "60px 20px 40px" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Package size={28} color="#1a7a5e" strokeWidth={1.5} />
                </div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
                  {catIdx === 0
                    ? "No items near you right now."
                    : `No ${selectedCat.display} items near you right now.`}
                </div>
                <div style={{ fontSize: 13, color: "#555555", marginBottom: 20, lineHeight: 1.6 }}>
                  Donors add items regularly — check back soon.
                </div>
                {catIdx !== 0 && (
                  <button
                    onClick={() => setCatIdx(0)}
                    style={{ padding: "10px 24px", borderRadius: 12, border: "1.5px solid var(--border)", background: "white", color: "var(--ink)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                  >
                    See all items
                  </button>
                )}
              </div>
            ) : (
              <div className="items-grid">
                {filtered.map((item) => (
                  <ListCard
                    key={item.id}
                    item={item}
                    requested={requested[item.id]}
                    favourited={favs[item.id]}
                    locked={isLocked}
                    onRequest={(e) => { e.stopPropagation(); handleRequest(item); }}
                    onFavourite={() => toggleFav(item.id)}
                    onClick={() => router.push(`/items/${item.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>{/* end discover-desktop */}

      {/* ── FAB pill — donors and guests only ──────────────────────────────── */}
      {!isMother && (
      <div style={{ position: "fixed", bottom: 86, left: "50%", transform: "translateX(-50%)", zIndex: 50, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        {/* Tooltip (first-time only) */}
        {!tooltipDismissed && (
          <div style={{
            background: "white", borderRadius: 12, padding: "10px 14px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)", border: "1px solid var(--border)",
            fontSize: 12, color: "#1a1a1a", maxWidth: 220, textAlign: "center",
            lineHeight: 1.5, fontFamily: "Nunito, sans-serif", position: "relative",
          }}>
            Have something a mother could use? Offer it here — it&apos;s free.
            <button
              onClick={(e) => { e.stopPropagation(); dismissTooltip(); }}
              style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", cursor: "pointer", display: "flex" }}
            >
              <X size={12} color="#9ca3af" />
            </button>
            {/* Arrow */}
            <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", width: 12, height: 12, background: "white", border: "1px solid var(--border)", borderTop: "none", borderLeft: "none", rotate: "45deg" }} />
          </div>
        )}

        {/* Pill button */}
        <button
          onClick={fabAction}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#1a7a5e", color: "white",
            border: "none", borderRadius: 999, height: 44,
            padding: "0 22px", minWidth: 160,
            fontSize: 14, fontWeight: 800, fontFamily: "Nunito, sans-serif",
            cursor: "pointer", boxShadow: "0 4px 16px rgba(26,122,94,0.4)",
            whiteSpace: "nowrap",
          }}
        >
          <Gift size={16} strokeWidth={2} />
          Offer an item
        </button>
      </div>
      )}

      <BottomNav />
      {showDonate && <DonateModal onClose={() => setShowDonate(false)} onSubmit={handleDonate} />}
      {reviewItem && (
        <RequestReviewSheet
          item={reviewItem}
          onClose={() => setReviewItem(null)}
          onSubmitted={(itemId) => {
            setRequested((r) => ({ ...r, [itemId]: true }));
            refreshUser();
          }}
        />
      )}
      {showLocationSheet && (
        <LocationSelector
          currentCity={activeCity}
          setByGPS={activeSetByGPS}
          radius={activeRadius}
          onSelect={handleLocationSelect}
          onClose={() => setShowLocationSheet(false)}
        />
      )}
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
