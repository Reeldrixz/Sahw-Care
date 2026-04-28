"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, MapPin, Heart } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";

interface RegisterListItem {
  id: string;
  status: string;
  fundingStatus: string;
  standardPriceCents: number;
  totalFundedCents: number;
  _count: { funding: number };
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

export default function RegistersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [registers, setRegisters] = useState<RegisterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user?.onboardingComplete && user.journeyType === "donor") {
      router.replace("/");
    }
  }, [user, router]);

  const fetchRegisters = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/registers");
    if (res.ok) {
      const data = await res.json();
      setRegisters(data.registers ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRegisters(); }, [fetchRegisters]);

  const filtered = registers.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.city.toLowerCase().includes(search.toLowerCase()) ||
      r.creator.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">
        {/* Header */}
        <div style={{ background: "var(--white)", padding: "16px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700 }}>Registers</div>
            {user && (
              <button
                onClick={() => router.push("/registers/new")}
                style={{ background: "var(--green)", color: "white", border: "none", borderRadius: 20, padding: "8px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
              >
                + Create
              </button>
            )}
          </div>
          <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 14 }}>
            Mothers share what they need. You choose what to give.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
            <span style={{ fontSize: 14, color: "var(--light)" }}>🔍</span>
            <input
              placeholder="Search by name or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: "none", background: "transparent", fontFamily: "Nunito, sans-serif", fontSize: 14, color: "var(--ink)", outline: "none", flex: 1 }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ padding: "16px 16px 100px" }}>
          {loading ? (
            <div className="loading" style={{ marginTop: 60 }}><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty" style={{ marginTop: 40 }}>
              <div className="empty-icon">📋</div>
              <div className="empty-title">No registers yet</div>
              <div style={{ marginBottom: 20 }}>Be the first to create one!</div>
              {user && (
                <button className="btn-primary" style={{ width: "auto", padding: "10px 24px" }} onClick={() => router.push("/registers/new")}>
                  + Create Register
                </button>
              )}
            </div>
          ) : (
            filtered.map((reg) => {
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

              return (
                <div
                  key={reg.id}
                  onClick={() => router.push(`/registers/${reg.id}`)}
                  style={{
                    background: "var(--white)", borderRadius: "var(--r)", padding: "16px",
                    marginBottom: 12, boxShadow: "var(--shadow)", cursor: "pointer",
                    transition: "transform 0.2s, box-shadow 0.2s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-lg)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow)"; }}
                >
                  {/* Stage pill + verified */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, flexShrink: 0,
                      background: stage.isNewborn ? "#e8f5f1" : "#fff8e6",
                      color: stage.isNewborn ? "#1a7a5e" : "#b8860b",
                    }}>
                      {stage.label}
                    </span>
                    {isVerified && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "#1a7a5e", background: "#e8f5f1", padding: "3px 8px", borderRadius: 20 }}>
                        <BadgeCheck size={11} strokeWidth={2.5} /> Verified
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
                    <MapPin size={11} />
                    {reg.city}
                    {totalDonors > 0 && <span style={{ marginLeft: 6, color: "#1a7a5e" }}>· {totalDonors} contributor{totalDonors !== 1 ? "s" : ""}</span>}
                  </div>

                  {/* Funding progress */}
                  {totalItems > 0 && totalNeeded > 0 && (
                    <>
                      <div style={{ height: 6, borderRadius: 6, background: "var(--bg)", overflow: "hidden", marginBottom: 6 }}>
                        <div style={{ width: `${pct * 100}%`, height: "100%", background: isFullyFunded ? "#1a7a5e" : "#1a7a5e", borderRadius: 6, transition: "width 0.4s", opacity: isFullyFunded ? 1 : 0.7 }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--mid)", fontWeight: 600, marginBottom: 12 }}>
                        {hasNoFunding ? (
                          <span style={{ color: "#d97706", display: "flex", alignItems: "center", gap: 4 }}>
                            <Heart size={11} /> Be the first to help
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
      </div>
      <BottomNav />
    </div>
  );
}
