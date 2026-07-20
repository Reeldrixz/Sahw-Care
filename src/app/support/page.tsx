"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import Toast from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";

const QUICK_AMOUNTS = [500, 1000, 2500];

export default function SupportPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [selected,    setSelected]    = useState<number | null>(null);
  const [custom,      setCustom]      = useState("");
  const [showCustom,  setShowCustom]  = useState(false);
  const [processing,  setProcessing]  = useState(false);
  const [toast,       setToast]       = useState<string | null>(null);

  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success") {
      setToast("Thank you for supporting Kradəl!");
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      window.history.replaceState({}, "", url.toString());
    } else if (payment === "cancel") {
      setToast("Contribution cancelled.");
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const amountCents = showCustom
    ? Math.round(parseFloat(custom || "0") * 100)
    : (selected ?? 0);
  const amountValid = Number.isInteger(amountCents) && amountCents >= 100;

  const handleContribute = async () => {
    if (!user) { router.push("/auth"); return; }
    if (!amountValid) return;
    setProcessing(true);
    try {
      const res  = await fetch("/api/support/contribute", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ amountCents }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error ?? "Something went wrong");
        setProcessing(false);
        return;
      }
      window.location.href = data.sessionUrl;
    } catch {
      setToast("Something went wrong. Please try again.");
      setProcessing(false);
    }
  };

  if (authLoading) {
    return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 80 }}>
      <div className="browse-header">
        <div className="browse-title" style={{ fontFamily: "Lora, serif", fontSize: 28, fontWeight: 700 }}>
          Support Kradəl
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "24px 16px" }}>

        {/* Header copy */}
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 16, color: "#555555", margin: "0 0 16px", lineHeight: 1.5 }}>
            Help keep the platform running.
          </p>
          <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, color: "#555555", lineHeight: 1.7, margin: 0 }}>
            Mothers use Kradəl for free. Donors fund specific items. The platform itself (hosting,
            payment processing, fulfilment time) is funded by people like you who want Kradəl to keep
            running. Every contribution goes directly to operations.
          </p>
        </div>

        {/* Contribution card */}
        <div style={{ background: "var(--white)", borderRadius: 16, padding: 24, border: "1px solid #e0e0e0" }}>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: "#555555", fontWeight: 600, marginBottom: 12 }}>
            Choose an amount
          </div>

          {/* Quick-pick pills */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {QUICK_AMOUNTS.map((cents) => {
              const active = !showCustom && selected === cents;
              return (
                <button
                  key={cents}
                  onClick={() => { setSelected(cents); setShowCustom(false); setCustom(""); }}
                  style={{
                    padding:     "10px 20px",
                    borderRadius: 24,
                    border:      `2px solid ${active ? "#1a7a5e" : "#e0e0e0"}`,
                    background:  active ? "#1a7a5e" : "var(--white)",
                    color:       active ? "#fff" : "#555555",
                    fontFamily:  "Nunito, sans-serif",
                    fontSize:    15,
                    fontWeight:  700,
                    cursor:      "pointer",
                  }}
                >
                  ${cents / 100}
                </button>
              );
            })}
            <button
              onClick={() => { setShowCustom(true); setSelected(null); }}
              style={{
                padding:     "10px 20px",
                borderRadius: 24,
                border:      `2px solid ${showCustom ? "#1a7a5e" : "#e0e0e0"}`,
                background:  showCustom ? "#1a7a5e" : "var(--white)",
                color:       showCustom ? "#fff" : "#555555",
                fontFamily:  "Nunito, sans-serif",
                fontSize:    15,
                fontWeight:  700,
                cursor:      "pointer",
              }}
            >
              Other
            </button>
          </div>

          {/* Custom amount input */}
          {showCustom && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ position: "relative" }}>
                <span style={{
                  position:  "absolute",
                  left:      14,
                  top:       "50%",
                  transform: "translateY(-50%)",
                  fontFamily: "Nunito, sans-serif",
                  fontSize:  16,
                  color:     "#555555",
                  fontWeight: 700,
                  pointerEvents: "none",
                }}>
                  $
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="0"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  style={{
                    width:       "100%",
                    padding:     "12px 14px 12px 28px",
                    borderRadius: 12,
                    border:      "2px solid #e0e0e0",
                    fontFamily:  "Nunito, sans-serif",
                    fontSize:    16,
                    outline:     "none",
                    boxSizing:   "border-box",
                  }}
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleContribute}
            disabled={!amountValid || processing}
            style={{
              width:       "100%",
              padding:     "16px",
              borderRadius: 12,
              border:      "none",
              background:  amountValid && !processing ? "#1a7a5e" : "#b0c4bd",
              color:       "#fff",
              fontFamily:  "Nunito, sans-serif",
              fontSize:    16,
              fontWeight:  700,
              cursor:      amountValid && !processing ? "pointer" : "not-allowed",
            }}
          >
            {processing ? "Redirecting to payment…" : "Contribute via Stripe"}
          </button>

          {/* Trust line */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, justifyContent: "center" }}>
            <ShieldCheck size={14} color="#1a7a5e" strokeWidth={1.75} />
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: "#555555" }}>
              Secure payment via Stripe. Your card details never touch our servers.
            </span>
          </div>
        </div>
      </div>

      <BottomNav />
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
