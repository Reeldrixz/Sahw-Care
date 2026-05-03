"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, MapPin, Heart, ArrowLeft } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import Toast from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";

interface RegisterListItem {
  id: string;
  status: string;
  fundingStatus: string;
  standardPriceCents: number;
  totalFundedCents: number;
  _count: { funding: number };
  catalogItem: { imageUrl: string | null } | null;
}

interface RegisterData {
  id: string;
  title: string;
  city: string;
  dueDate: string;
  createdAt: string;
  creator: { id: string; name: string; location: string | null; verificationLevel: number };
  items: RegisterListItem[];
}

function fmtMoney(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function getStagePill(dueDate: string) {
  const due = new Date(dueDate);
  const now = new Date();
  const diffDays = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 0) {
    const weeks = Math.round(diffDays / 7);
    return { label: weeks <= 1 ? "Due this week" : `Due in ${weeks} weeks`, isNewborn: false };
  }
  const weeksOld = Math.abs(Math.round(diffDays / 7));
  return { label: `Newborn · ${weeksOld}w old`, isNewborn: true };
}

export default function SavedRegistersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [registers, setRegisters] = useState<RegisterData[]>([]);
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth");
    }
  }, [authLoading, user, router]);

  const fetchSaved = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/registers/saved");
    if (res.ok) {
      const data = await res.json();
      setRegisters(data.registers ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      fetchSaved();
    }
  }, [authLoading, user, fetchSaved]);

  const handleUnsave = async (e: React.MouseEvent, registerId: string) => {
    e.stopPropagation();
    setRegisters((prev) => prev.filter((r) => r.id !== registerId));
    const res = await fetch(`/api/registers/${registerId}/save`, { method: "POST" });
    if (!res.ok) {
      setToast("Failed to unsave register");
      fetchSaved();
    }
  };

  if (authLoading || (!authLoading && !user)) {
    return <div className="loading" style={{ marginTop: 80 }}><div className="spinner" /></div>;
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">

        {/* Header */}
        <div style={{ background: "var(--white)", padding: "16px 16px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <button
              onClick={() => router.back()}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 0", display: "flex", alignItems: "center", color: "#555555" }}
            >
              <ArrowLeft size={20} strokeWidth={1.75} />
            </button>
            <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700 }}>Saved Registers</div>
          </div>
          <p style={{ fontSize: 13, color: "var(--mid)", margin: 0 }}>
            Registers you&apos;ve saved to revisit.
          </p>
        </div>

        {/* List */}
        <div style={{ padding: "16px 16px 0" }}>
          {loading ? (
            <div className="loading" style={{ marginTop: 60 }}><div className="spinner" /></div>
          ) : registers.length === 0 ? (
            <div className="empty" style={{ marginTop: 40 }}>
              <div className="empty-icon">🔖</div>
              <div className="empty-title">No saved registers yet</div>
              <div style={{ marginBottom: 20, fontSize: 13, color: "var(--mid)" }}>
                Save a register from the main list to see it here.
              </div>
              <button
                className="btn-primary"
                style={{ width: "auto", padding: "10px 24px" }}
                onClick={() => router.push("/registers")}
              >
                Browse Registers
              </button>
            </div>
          ) : (
            registers.map((reg) => {
              const stage = getStagePill(reg.dueDate);
              const firstName = reg.creator.name.split(" ")[0];
              const isVerified = (reg.creator.verificationLevel ?? 0) >= 2;

              const totalFunded = reg.items.reduce((s, i) => s + i.totalFundedCents, 0);
              const totalNeeded = reg.items.reduce((s, i) => s + i.standardPriceCents, 0);
              const completedItems = reg.items.filter((i) => i.fundingStatus === "FULFILLED").length;
              const totalItems = reg.items.length;
              const pct = totalNeeded > 0 ? Math.min(1, totalFunded / totalNeeded) : 0;
              const isFullyFunded = totalNeeded > 0 && totalFunded >= totalNeeded;
              const hasNoFunding = totalFunded === 0;
              const totalDonors = reg.items.reduce((s, i) => s + i._count.funding, 0);

              const itemImages = reg.items.map((i) => i.catalogItem?.imageUrl).filter((u): u is string => !!u);
              const hasImages = itemImages.length > 0;
              const moreThanFive = reg.items.length > 5;
              const stripImages = moreThanFive ? itemImages.slice(0, 4) : itemImages.slice(0, 5);
              const moreCount = moreThanFive ? reg.items.length - 4 : 0;

              return (
                <div
                  key={reg.id}
                  onClick={() => router.push(`/registers/${reg.id}`)}
                  style={{
                    position: "relative",
                    background: "var(--white)", borderRadius: "var(--r)", padding: "16px",
                    marginBottom: 12, boxShadow: "var(--shadow)", cursor: "pointer",
                    transition: "transform 0.2s, box-shadow 0.2s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-lg)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow)"; }}
                >
                  {/* Heart un-save button — always filled */}
                  <button
                    onClick={(e) => handleUnsave(e, reg.id)}
                    style={{
                      position: "absolute", top: 12, right: 12,
                      background: "none", border: "none", cursor: "pointer",
                      padding: 4, display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "transform 0.15s",
                      zIndex: 1,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.15)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
                  >
                    <Heart size={22} strokeWidth={1.75} color="#1a7a5e" fill="#1a7a5e" />
                  </button>

                  {/* Stage pill + verified */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, paddingRight: 32 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, flexShrink: 0,
                      background: stage.isNewborn ? "#e8f5f1" : "#fff8e6",
                      color: stage.isNewborn ? "#1a7a5e" : "#b8860b",
                    }}>
                      {stage.label}
                    </span>
                    {isVerified && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "#1a7a5e", background: "#e8f5f1", padding: "3px 8px", borderRadius: 20 }}>
                        <BadgeCheck size={11} strokeWidth={1.75} /> Verified
                      </span>
                    )}
                    {isFullyFunded && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#1a7a5e", background: "#e8f5f1", padding: "3px 10px", borderRadius: 20, marginLeft: "auto" }}>
                        Completed ✓
                      </span>
                    )}
                  </div>

                  {/* Title + location */}
                  <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, marginBottom: 3 }}>
                    {firstName}&apos;s Register
                  </div>
                  <div style={{ fontSize: 12, color: "var(--mid)", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, marginBottom: 12 }}>
                    <MapPin size={11} strokeWidth={1.75} />
                    {reg.city}
                    {totalDonors > 0 && <span style={{ marginLeft: 6, color: "#1a7a5e" }}>· {totalDonors} contributor{totalDonors !== 1 ? "s" : ""}</span>}
                  </div>

                  {/* Image strip */}
                  {hasImages && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 12, overflow: "hidden" }}>
                      {stripImages.map((url, idx) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={idx} src={url} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", border: "1px solid #e0e0e0", flexShrink: 0 }} />
                      ))}
                      {moreCount > 0 && (
                        <div style={{ width: 40, height: 40, borderRadius: 8, background: "#f3f4f6", border: "1px solid #e0e0e0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10, fontWeight: 700, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                          +{moreCount}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Funding progress */}
                  {totalItems > 0 && totalNeeded > 0 && (
                    <>
                      <div style={{ height: 6, borderRadius: 6, background: "var(--bg)", overflow: "hidden", marginBottom: 6 }}>
                        <div style={{ width: `${pct * 100}%`, height: "100%", background: "#1a7a5e", borderRadius: 6, transition: "width 0.4s", opacity: isFullyFunded ? 1 : 0.7 }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--mid)", fontWeight: 600, marginBottom: 12 }}>
                        {hasNoFunding ? (
                          <span style={{ color: "#d97706", display: "flex", alignItems: "center", gap: 4 }}>
                            <Heart size={11} strokeWidth={1.75} /> Be the first to help
                          </span>
                        ) : (
                          <span>{fmtMoney(totalFunded)} funded of {fmtMoney(totalNeeded)}</span>
                        )}
                        <span>{completedItems}/{totalItems} needs completed</span>
                      </div>
                    </>
                  )}

                  {totalItems === 0 && (
                    <div style={{ fontSize: 12, color: "var(--light)", fontStyle: "italic", marginBottom: 12 }}>No items added yet</div>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--green)" }}>See what she needs →</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {(loading || registers.length === 0) && <div style={{ height: 100 }} />}
        {registers.length > 0 && <div style={{ height: 100 }} />}
      </div>

      <BottomNav />
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
