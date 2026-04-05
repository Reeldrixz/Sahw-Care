"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import ListCard, { ItemData } from "@/components/ListCard";
import Toast from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";

export default function FavouritesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [allItems, setAllItems] = useState<ItemData[]>([]);
  const [favs, setFavs] = useState<Record<string, boolean>>({});
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);

  // Load favs from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("cc_favs");
    if (stored) setFavs(JSON.parse(stored));
  }, []);

  // Persist favs
  useEffect(() => {
    localStorage.setItem("cc_favs", JSON.stringify(favs));
  }, [favs]);

  useEffect(() => {
    fetch("/api/items?limit=100")
      .then((r) => r.json())
      .then((d) => setAllItems(d.items ?? []));
  }, []);

  const favourited = allItems.filter((i) => favs[i.id]);

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
        {favourited.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🤍</div>
            <div className="empty-title">No favourites yet</div>
            <div>Tap the heart on any item to save it here</div>
          </div>
        ) : (
          <div style={{ padding: "12px 16px 20px" }}>
            {favourited.map((item) => (
              <ListCard
                key={item.id}
                item={item}
                requested={requested[item.id]}
                favourited
                onRequest={(e) => { e.stopPropagation(); handleRequest(item); }}
                onFavourite={() => setFavs((f) => ({ ...f, [item.id]: false }))}
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
