"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import ListCard, { ItemData } from "@/components/ListCard";
import DonateModal from "@/components/DonateModal";
import Toast from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/Avatar";
import { MapPin, Bell } from "lucide-react";

const BUNDLES = [
  { id: 1, emoji: "🎀", title: "Full Newborn Starter Kit", items: "Formula · Diapering · Clothes · Bath set", count: "4 items", tag: "Bundle", tagColor: "#e8f5f1", tagText: "#1a7a5e", bg: "#e8f5f1" },
  { id: 2, emoji: "🤰", title: "Complete Maternity Kit", items: "Maternity pads · Breast pump · Nursing bra", count: "3 items", tag: "Popular", tagColor: "#fff3e0", tagText: "#c4622d", bg: "#fff3e0" },
  { id: 3, emoji: "👼", title: "Baby Essentials Pack", items: "Clothes · Toys · Hygiene · Wipes", count: "6 items", tag: "New", tagColor: "#f3e5f5", tagText: "#7b1fa2", bg: "#f3e5f5" },
];

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
  const [showDonate, setShowDonate] = useState(false);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);

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

  const filtered = allItems.filter((i) => {
    const matchCat = cat === "All" || i.category === cat;
    const matchSearch =
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase());
    const matchCity = !detectedCity || i.location.toLowerCase().includes(detectedCity.toLowerCase());
    return matchCat && matchSearch && (search ? true : matchCity || !detectedCity);
  });

  const handleRequest = async (item: ItemData) => {
    if (!user) { router.push("/auth"); return; }
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id }),
    });
    if (res.ok) {
      setRequested((r) => ({ ...r, [item.id]: true }));
      showToast("Requested! Donor will be notified 🎉");
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
      if (up.ok) { const { url } = await up.json(); imageUrl = url; }
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
            <button className="icon-btn notif-dot">
              <Bell size={20} strokeWidth={1.75} color="#1a7a5e" />
            </button>
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
                      <button className="pick-fav" onClick={(e) => { e.stopPropagation(); setFavs((f) => ({ ...f, [item.id]: !f[item.id] })); }}>
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

        {/* CLAIM BEFORE IT'S GONE */}
        {filtered.filter((i) => i.urgent).length > 0 && (
          <div className="section">
            <div className="section-head">
              <div className="section-title">Claim before it&apos;s gone</div>
              <div className="see-all" onClick={() => router.push("/browse")}>See all</div>
            </div>
            {filtered.filter((i) => i.urgent).slice(0, 2).map((item) => (
              <ListCard
                key={item.id}
                item={item}
                requested={requested[item.id]}
                favourited={favs[item.id]}
                badge={`🔥 ${item.quantity} left`}
                onRequest={(e) => { e.stopPropagation(); handleRequest(item); }}
                onFavourite={() => setFavs((f) => ({ ...f, [item.id]: !f[item.id] }))}
                onClick={() => router.push(`/items/${item.id}`)}
              />
            ))}
          </div>
        )}

        {/* BUNDLES */}
        <div className="section">
          <div className="section-head">
            <div className="section-title">Full care bundles</div>
            <div className="see-all">See all</div>
          </div>
          <div className="hscroll">
            {BUNDLES.map((b) => (
              <div key={b.id} className="bundle-card" onClick={() => showToast("Bundle requests coming soon!")}>
                <div className="bundle-img" style={{ background: b.bg }}>
                  <div className="bundle-tag" style={{ background: b.tagColor, color: b.tagText }}>{b.tag}</div>
                  <span>{b.emoji}</span>
                </div>
                <div className="bundle-body">
                  <div className="bundle-title">{b.title}</div>
                  <div className="bundle-items">{b.items}</div>
                  <div className="bundle-footer">
                    <div className="bundle-count">📦 {b.count}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--green)" }}>Free 🎁</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                  onFavourite={() => setFavs((f) => ({ ...f, [item.id]: !f[item.id] }))}
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
