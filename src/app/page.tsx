"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import ListCard, { ItemData } from "@/components/ListCard";
import DonateModal from "@/components/DonateModal";
import Toast from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/Avatar";
import { MapPin } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import BundleStatusTracker from "@/components/BundleStatusTracker";
import FulfillmentConfirmBanner, { PendingFulfillment } from "@/components/FulfillmentConfirmBanner";
import FulfillmentStatusBadge from "@/components/FulfillmentStatusBadge";

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

const CAT_BG: Record<string, string> = {
  "Feeding": "#e8f5f1", "Diapering": "#fff3e0", "Maternity": "#f3e5f5",
  "Clothing": "#e3f2fd", "Hygiene": "#e8f5e9", "Other": "#f5f5f5",
};
const CAT_EMOJI: Record<string, string> = {
  "Feeding": "🍼", "Diapering": "👶", "Maternity": "🤱",
  "Clothing": "👗", "Hygiene": "🧴", "Other": "📦",
};

export default function DiscoverPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [topItems, setTopItems] = useState<ItemData[]>([]);
  const [allItems, setAllItems] = useState<ItemData[]>([]);
  const [total, setTotal] = useState(0);
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [favs, setFavs] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [toast, setToast] = useState<string | null>(null);
  const [showDonate,    setShowDonate]    = useState(false);
  const [detectedCity,  setDetectedCity]  = useState<string | null>(null);
  const [campaigns,         setCampaigns]         = useState<LiveCampaign[]>([]);
  const [myBundle,          setMyBundle]          = useState<MyBundle | null>(null);
  const [toConfirm,         setToConfirm]         = useState<PendingFulfillment[]>([]);
  const [toFulfill,         setToFulfill]         = useState<ToFulfillItem[]>([]);
  const [donorSentItems,    setDonorSentItems]    = useState<DonorSentItem[]>([]);
  const [fulfillNote,       setFulfillNote]       = useState<Record<string, string>>({});
  const [fulfillLoading,    setFulfillLoading]    = useState<Record<string, boolean>>({});
  const [fulfillDone,       setFulfillDone]       = useState<Record<string, boolean>>({});

  const CATS = ["All", "Feeding", "Diapering", "Maternity", "Clothing", "Hygiene"];

  const showToast = (msg: string) => setToast(msg);

  // Auto-detect city via geolocation
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            data.address?.county;
          if (city) setDetectedCity(city);
        } catch {
          // silently fail
        }
      },
      () => {} // permission denied — do nothing
    );
  }, []);

  const fetchItems = useCallback(async () => {
    const res = await fetch("/api/items?limit=50");
    if (res.ok) {
      const data = await res.json();
      setTopItems((data.items ?? []).slice(0, 4));
      setAllItems(data.items ?? []);
      setTotal(data.total ?? 0);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Load favourites from DB when user is known; fall back to empty set for guests
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
    // Optimistic update
    setFavs((f) => ({ ...f, [itemId]: !f[itemId] }));
    if (!user) return; // guests: optimistic only (won't persist)
    try {
      const res = await fetch("/api/favourites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const d = await res.json();
      if (res.ok) setFavs((f) => ({ ...f, [itemId]: d.favourited }));
    } catch {
      // revert on network error
      setFavs((f) => ({ ...f, [itemId]: !f[itemId] }));
    }
  }, [user]);

  // Fetch bundle campaigns for all users; fetch active bundle only for logged-in mothers
  useEffect(() => {
    fetch("/api/bundles").then((r) => r.json()).then((d) => setCampaigns(d.campaigns ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user || user.journeyType === "donor" || !user.activeBundleId) return;
    fetch("/api/bundles/my").then((r) => r.json()).then((d) => {
      const active = (d.instances ?? []).find((i: MyBundle) =>
        !["COMPLETED", "REJECTED"].includes(i.status)
      );
      setMyBundle(active ?? null);
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/fulfillment/pending")
      .then((r) => r.json())
      .then((d) => {
        setToConfirm(d.toConfirm ?? []);
        setToFulfill(d.toFulfill ?? []);
        setDonorSentItems(d.donorSentItems ?? []);
      })
      .catch(() => {});
  }, [user]);

  const filtered = allItems.filter((i) => {
    const matchCat = cat === "All" || i.category === cat;
    const matchSearch =
      !search ||
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleMarkSent = async (requestId: string) => {
    if (fulfillLoading[requestId]) return;
    setFulfillLoading((p) => ({ ...p, [requestId]: true }));
    try {
      const note = fulfillNote[requestId]?.trim() || undefined;
      const res = await fetch(`/api/requests/${requestId}/fulfill`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ donorNote: note ?? null }),
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.error ?? "Something went wrong"); return; }
      setFulfillDone((p) => ({ ...p, [requestId]: true }));
      // Move item to donorSentItems immediately so donor can track its status
      const sentItem = toFulfill.find((r) => r.requestId === requestId);
      if (sentItem) {
        setDonorSentItems((prev) => [
          { requestId, itemTitle: sentItem.itemTitle, recipientName: sentItem.requesterName, fulfillStatus: "PENDING", markedAt: new Date().toISOString(), respondedAt: null },
          ...prev,
        ]);
      }
      showToast("Marked as sent! Recipient will be notified ✅");
    } finally {
      setFulfillLoading((p) => ({ ...p, [requestId]: false }));
    }
  };

  const handleRequest = async (item: ItemData) => {
    if (!user) { router.push("/auth"); return; }
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id }),
    });
    if (res.ok) {
      const d = await res.json();
      setRequested((r) => ({ ...r, [item.id]: true }));
      showToast("Requested! Opening chat with donor…");
      if (d.conversationId) {
        setTimeout(() => router.push(`/chat?conv=${d.conversationId}`), 900);
      }
    } else {
      const d = await res.json();
      showToast(d.error ?? "Something went wrong");
    }
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
    if (res.ok) { setShowDonate(false); showToast("Listed! 🎉 It'll appear after review."); fetchItems(); }
    else { const d = await res.json(); showToast(d.error ?? "Failed"); }
  };

  const locationLabel = detectedCity ?? "Lagos, Nigeria";

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      {/* Mobile header / Desktop search bar */}
      <div className="discover-desktop">
      <div style={{ background: "var(--white)" }} className="discover-mobile-header">
        <div className="topbar">
          <div className="location-pill" onClick={() => {}}>
            <MapPin size={14} strokeWidth={1.75} color="#1a7a5e" style={{ flexShrink: 0 }} />
            <span>{locationLabel}</span>
            <span className="location-arrow">▾</span>
          </div>
          <div className="topbar-right">
            <NotificationBell />
            {user ? (
              <button className="icon-btn" onClick={() => router.push("/profile")} style={{ padding: 2, background: "none", border: "none" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden" }}>
                  <Avatar src={user.avatar} name={user.name} size={28} />
                </div>
              </button>
            ) : (
              <button className="icon-btn" onClick={() => router.push("/auth")}>🔑</button>
            )}
          </div>
        </div>
        <div className="search-wrap">
          <div className="search-row">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                placeholder="Search baby & maternal items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="filter-btn" onClick={() => router.push("/browse")}>⚙️</button>
          </div>
        </div>
        <div className="cats">
          {CATS.map((c) => (
            <button key={c} className={`cat-chip ${cat === c ? "active" : ""}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      </div>
      </div>{/* end discover-desktop */}

      <div className="discover-desktop">
      <div className="scroll">
        {/* TOP PICKS */}
        {topItems.length > 0 && (
          <div className="section">
            <div className="section-head">
              <div className="section-title">Top picks {detectedCity ? `in ${detectedCity}` : "near you"}</div>
              <div className="see-all" onClick={() => router.push("/browse")}>See all</div>
            </div>
            <div className="hscroll">
              {topItems.map((item) => {
                const bg = CAT_BG[item.category] ?? "#f5f5f5";
                return (
                  <div key={item.id} className="pick-card" onClick={() => router.push(`/items/${item.id}`)}>
                    <div className="pick-img" style={{ background: bg }}>
                      {item.urgent && <div className="pick-badge">⚡ Urgent</div>}
                      <button className="pick-fav" onClick={(e) => { e.stopPropagation(); toggleFav(item.id); }}>
                        {favs[item.id] ? "❤️" : "🤍"}
                      </button>
                      <span>{CAT_EMOJI[item.category] ?? "📦"}</span>
                    </div>
                    <div className="pick-body">
                      <div className="pick-name">{item.title}</div>
                      <div className="pick-sub">{item.category} · {item.quantity}</div>
                      <div className="pick-meta">
                        <span className="pick-rating">⭐ {item.donor.trustRating.toFixed(1)}</span>
                        <span className="pick-dot">·</span>
                        <span>{item.location.split(",")[0]}</span>
                      </div>
                    </div>
                    <div className="pick-footer">
                      <div className="pick-qty">{item.quantity}</div>
                      <div className="pick-free">Free 🎁</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* FULFILLMENT — recipient confirmations */}
        {toConfirm.length > 0 && (
          <div className="section">
            <div className="section-head">
              <div className="section-title">Confirm receipt</div>
            </div>
            <FulfillmentConfirmBanner
              items={toConfirm}
              onResolved={(reqId, status) => {
                setToConfirm((p) => p.filter((i) => i.requestId !== reqId));
                showToast(
                  status === "VERIFIED"
                    ? "Confirmed received! Thank you ✅"
                    : "Dispute reported — our team will review ⚠️"
                );
              }}
            />
          </div>
        )}

        {/* FULFILLMENT — donor mark-as-sent */}
        {toFulfill.filter((r) => !fulfillDone[r.requestId]).length > 0 && (
          <div className="section">
            <div className="section-head">
              <div className="section-title">Mark items as sent</div>
            </div>
            {toFulfill.filter((r) => !fulfillDone[r.requestId]).map((r) => (
              <div
                key={r.requestId}
                style={{
                  background: "var(--white)", borderRadius: 14,
                  border: "1.5px solid var(--border)", padding: "14px 16px",
                  marginBottom: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 800, marginBottom: 2 }}>{r.itemTitle}</div>
                    <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>Requested by {r.requesterName}</div>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Optional note for recipient (e.g. 'Shipped via Canada Post')"
                  value={fulfillNote[r.requestId] ?? ""}
                  onChange={(e) => setFulfillNote((p) => ({ ...p, [r.requestId]: e.target.value }))}
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 8,
                    border: "1.5px solid var(--border)", fontSize: 12,
                    fontFamily: "Nunito, sans-serif", outline: "none",
                    marginBottom: 10, boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={() => handleMarkSent(r.requestId)}
                  disabled={!!fulfillLoading[r.requestId]}
                  style={{
                    width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
                    background: "#1a7a5e", color: "white", fontSize: 13, fontWeight: 800,
                    cursor: fulfillLoading[r.requestId] ? "default" : "pointer",
                    fontFamily: "Nunito, sans-serif",
                    opacity: fulfillLoading[r.requestId] ? 0.6 : 1,
                  }}
                >
                  {fulfillLoading[r.requestId] ? "…" : "📦 Mark as sent"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* DONOR SENT ITEMS — in-progress tracking (PENDING / DISPUTED) */}
        {donorSentItems.length > 0 && (
          <div className="section">
            <div className="section-head">
              <div className="section-title">Items you sent</div>
            </div>
            {donorSentItems.map((item) => {
              const isDisputed = item.fulfillStatus === "DISPUTED";
              return (
                <div
                  key={item.requestId}
                  style={{
                    background:   "var(--white)",
                    borderRadius: 14,
                    border:       `2px solid ${isDisputed ? "#c0392b" : "var(--border)"}`,
                    padding:      "14px 16px",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 800, marginBottom: 2 }}>
                        {item.itemTitle}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                        For {item.recipientName}
                      </div>
                    </div>
                    <FulfillmentStatusBadge status={item.fulfillStatus} small />
                  </div>
                  {isDisputed && (
                    <div style={{ marginTop: 10, padding: "9px 12px", background: "#fdecea", borderRadius: 8, fontSize: 12, color: "#c0392b", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>
                      ⚠️ The recipient reported they did not receive this item. Our team has been notified and will review the dispute.
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

        {/* BUNDLES — always visible */}
        <div className="section">
          <div className="section-head">
            <div className="section-title">Full care bundles</div>
          </div>

          {/* Active bundle tracker */}
          {myBundle && (
            <div style={{ marginBottom: 14 }}>
              <BundleStatusTracker
                instance={myBundle}
                onConfirmed={() => { setMyBundle(null); setToast("Bundle confirmed! Thank you 💛"); }}
              />
            </div>
          )}

          {/* Campaign cards */}
          {!myBundle && campaigns.length > 0 && (
            <div className="hscroll">
              {campaigns.map((c) => {
                const { eligible, reason, daysUntilEligible } = c.eligibility;
                const CARD_COLORS = ["#e8f5f1", "#fff8e6", "#f0f4ff", "#fdf0e8"];
                const colorIdx = campaigns.indexOf(c) % CARD_COLORS.length;
                const bg = CARD_COLORS[colorIdx];

                return (
                  <div key={c.id} className="bundle-card" onClick={() => router.push(`/bundles/${c.id}`)}>
                    <div className="bundle-img" style={{ background: bg }}>
                      <div className="bundle-tag" style={{ background: "white", color: "var(--green)", border: "1.5px solid var(--green)" }}>
                        {c.bundlesRemaining} left
                      </div>
                      <span style={{ fontSize: 36 }}>🎀</span>
                    </div>
                    <div className="bundle-body">
                      <div className="bundle-title">{c.template.name}</div>
                      <div className="bundle-items">Includes: {c.template.itemSummary}</div>
                      <div className="bundle-footer">
                        <div className="bundle-count">📦 {c.template.items.length} items</div>
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
                        ) : (
                          <div style={{ fontSize: 11, color: "var(--mid)" }}>Free 🎁</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Placeholder when no active campaigns */}
          {!myBundle && campaigns.length === 0 && (
            <div className="bundle-card" style={{ opacity: 0.6, pointerEvents: "none" }}>
              <div className="bundle-img" style={{ background: "#e8f5f1" }}>
                <span style={{ fontSize: 36 }}>🎀</span>
              </div>
              <div className="bundle-body">
                <div className="bundle-title">Kradəl Care Bundle</div>
                <div className="bundle-items">Free essentials for expecting & new moms</div>
                <div className="bundle-footer">
                  <div className="bundle-count">Coming soon</div>
                  <div style={{ fontSize: 11, color: "var(--mid)" }}>Free 🎁</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ALL ITEMS */}
        <div className="section" style={{ paddingBottom: 20 }}>
          <div className="section-head">
            <div className="section-title">All available items</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--mid)" }}>{filtered.length} nearby</div>
          </div>
          {filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📦</div>
              <div className="empty-title">No items yet</div>
              <div>Be the first to donate!</div>
              {user && (
                <button className="btn-primary" style={{ marginTop: 16, width: "auto", padding: "10px 24px" }} onClick={() => setShowDonate(true)}>
                  + Donate Item
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
                  onRequest={(e) => { e.stopPropagation(); handleRequest(item); }}
                  onFavourite={() => toggleFav(item.id)}
                  onClick={() => router.push(`/items/${item.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      </div>{/* end discover-desktop scroll */}

      {/* Donate FAB for all logged-in users */}
      {user && (
        <button
          onClick={() => setShowDonate(true)}
          style={{
            position: "fixed", bottom: 86, right: 16,
            width: 52, height: 52, borderRadius: "50%",
            background: "var(--green)", color: "white",
            border: "none", fontSize: 24, cursor: "pointer",
            boxShadow: "var(--shadow-lg)", zIndex: 50,
          }}
        >
          +
        </button>
      )}

      <BottomNav />
      {showDonate && <DonateModal onClose={() => setShowDonate(false)} onSubmit={handleDonate} />}
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
