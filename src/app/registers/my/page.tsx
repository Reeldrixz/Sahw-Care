"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";

interface RegisterData {
  id: string;
  title: string;
  city: string;
  dueDate: string;
  items: { id: string; status: string }[];
}

interface AssignmentData {
  id: string;
  status: "RESERVED" | "PURCHASED" | "DELIVERED";
  item: {
    id: string;
    name: string;
    quantity: string;
    status: string;
    register: { id: string; title: string; city: string; creator: { name: string } };
  };
}

const ASSIGN_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  RESERVED: { label: "Committed", color: "#b8860b", bg: "var(--yellow-light)" },
  PURCHASED: { label: "Purchased", color: "var(--green)", bg: "var(--green-light)" },
  DELIVERED: { label: "Delivered", color: "var(--green)", bg: "var(--green-light)" },
};

export default function MyRegistersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [myRegisters, setMyRegisters] = useState<RegisterData[]>([]);
  const [commitments, setCommitments] = useState<AssignmentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) router.push("/auth");
  }, [user, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [regsRes, commitRes] = await Promise.all([
      fetch(`/api/registers?creatorId=${user.id}`),
      fetch(`/api/registers/commitments`),
    ]);
    if (regsRes.ok) {
      const d = await regsRes.json();
      setMyRegisters(d.registers ?? []);
    }
    if (commitRes.ok) {
      const d = await commitRes.json();
      setCommitments(d.assignments ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!user) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">
        {/* Header */}
        <div style={{ background: "var(--white)", padding: "16px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border)" }}>
          <button
            onClick={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg)", border: "none", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            ←
          </button>
          <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700 }}>My Registers</div>
        </div>

        <div style={{ padding: "16px 16px 120px" }}>
          {loading ? (
            <div className="loading" style={{ marginTop: 60 }}><div className="spinner" /></div>
          ) : (
            <>
              {/* My Registers */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700 }}>📋 My Register</div>
                  <button
                    onClick={() => router.push("/registers/new")}
                    style={{ background: "var(--green)", color: "white", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                  >
                    + New
                  </button>
                </div>

                {myRegisters.length === 0 ? (
                  <div style={{ background: "var(--white)", borderRadius: 12, padding: "24px", textAlign: "center", boxShadow: "var(--shadow)" }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>No register yet</div>
                    <div style={{ fontSize: 13, color: "var(--mid)", marginBottom: 16 }}>Create a register to share what you need for your baby</div>
                    <button className="btn-primary" style={{ width: "auto", padding: "10px 24px" }} onClick={() => router.push("/registers/new")}>
                      Create Register
                    </button>
                  </div>
                ) : (
                  myRegisters.map((reg) => {
                    const total = reg.items.length;
                    const fulfilled = reg.items.filter((i) => i.status === "FULFILLED").length;
                    const pct = total > 0 ? fulfilled / total : 0;
                    return (
                      <div
                        key={reg.id}
                        onClick={() => router.push(`/registers/${reg.id}`)}
                        style={{ background: "var(--white)", borderRadius: 12, padding: "14px", marginBottom: 10, boxShadow: "var(--shadow)", cursor: "pointer" }}
                      >
                        <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{reg.title}</div>
                        <div style={{ fontSize: 12, color: "var(--mid)", marginBottom: 8 }}>📍 {reg.city} · {total} items</div>
                        {total > 0 && (
                          <>
                            <div style={{ fontSize: 11, color: "var(--mid)", marginBottom: 4 }}>{fulfilled}/{total} fulfilled</div>
                            <div style={{ background: "var(--bg)", borderRadius: 4, height: 6 }}>
                              <div style={{ width: `${pct * 100}%`, height: "100%", background: "var(--green)", borderRadius: 4 }} />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* My Commitments */}
              <div>
                <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, marginBottom: 12 }}>💛 My Commitments</div>
                {commitments.length === 0 ? (
                  <div style={{ background: "var(--white)", borderRadius: 12, padding: "24px", textAlign: "center", boxShadow: "var(--shadow)" }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>💛</div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>No commitments yet</div>
                    <div style={{ fontSize: 13, color: "var(--mid)", marginBottom: 16 }}>Browse registers and commit to fulfilling items for moms in need</div>
                    <button className="btn-primary" style={{ width: "auto", padding: "10px 24px" }} onClick={() => router.push("/registers")}>
                      Browse Registers
                    </button>
                  </div>
                ) : (
                  commitments.map((a) => {
                    const cfg = ASSIGN_STATUS[a.status];
                    return (
                      <div
                        key={a.id}
                        onClick={() => router.push(`/registers/${a.item.register.id}`)}
                        style={{ background: "var(--white)", borderRadius: 12, padding: "14px", marginBottom: 10, boxShadow: "var(--shadow)", cursor: "pointer", display: "flex", gap: 12 }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>{a.item.name}</div>
                          <div style={{ fontSize: 12, color: "var(--mid)" }}>Qty: {a.item.quantity}</div>
                          <div style={{ fontSize: 11, color: "var(--mid)", marginTop: 2 }}>
                            From: {a.item.register.creator.name.split(" ")[0]}&apos;s register · {a.item.register.city}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: cfg.bg, color: cfg.color, flexShrink: 0, alignSelf: "flex-start" }}>
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
