"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import ListCard, { ItemData } from "@/components/ListCard";
import Toast from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";

export default function FavouritesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ItemData[]>([]);
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.onboardingComplete && user.journeyType === "donor") {
      router.replace("/");
    }
  }, [user, router]);

  const fetchFavs = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const [favRes, itemsRes] = await Promise.all([
        fetch("/api/favourites"),
        fetch("/api/items?limit=200"),
      ]);
      const { itemIds } = await favRes.json();
      const { items: allItems } = await itemsRes.json();
      const idSet = new Set<string>(itemIds ?? []);
      setItems((allItems ?? []).filter((i: ItemData) => idSet.has(i.id)));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchFavs(); }, [fetchFavs]);

  const handleUnfavourite = async (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    await fetch("/api/favourites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
  };

  const handleRequest = async (item: ItemData) => {
    if (!user) { router.push("/auth"); return; }
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: item.id }),
    });
    if (res.ok) {
      setRequested((r) => ({ ...r, [item.id]: true }));
      setToast("Requested! 🎉");
    } else {
      const d = await res.json();
      setToast(d.error ?? "Something went wrong");
    }
  };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="browse-header">
        <div className="browse-title">Favourites</div>
      </div>

      <div className="scroll" style={{ height: "calc(100vh - 74px)" }}>
        {!user ? (
          <div className="empty">
            <div className="empty-icon">🤍</div>
            <div className="empty-title">Sign in to save favourites</div>
            <div>Your liked items will appear here</div>
          </div>
        ) : loading ? (
          <div className="empty">
            <div style={{ color: "var(--light)", fontSize: 14 }}>Loading...</div>
          </div>
        ) : items.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🤍</div>
            <div className="empty-title">No favourites yet</div>
            <div>Tap the heart on any item to save it here</div>
          </div>
        ) : (
          <div style={{ padding: "12px 16px 20px" }}>
            {items.map((item) => (
              <ListCard
                key={item.id}
                item={item}
                requested={requested[item.id]}
                favourited
                onRequest={(e) => { e.stopPropagation(); handleRequest(item); }}
                onFavourite={() => handleUnfavourite(item.id)}
                onClick={() => router.push(`/items/${item.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
