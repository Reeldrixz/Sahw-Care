"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";
import Toast from "@/components/Toast";

interface BundleItem { name: string; quantity: string; notes?: string }
interface Campaign {
  id: string;
  title: string;
  description: string;
  sponsorName: string;
  sponsorLogo: string | null;
  bundlesRemaining: number;
  totalBundles: number;
  status: string;
  template: {
    id: string;
    name: string;
    description: string;
    items: BundleItem[];
  };
}
interface Eligibility {
  eligible: boolean;
  reason: string | null;
  daysUntilEligible?: number;
}

const REASON_MSG: Record<string, string> = {
  not_mother:    "This bundle is available to pregnant women and mothers only.",
  not_verified:  "Verify your identity to access care bundles.",
  low_trust:     "Your account trust score is too low to request bundles.",
  active_bundle: "You already have a bundle in progress.",
  cooldown:      "You've recently received a bundle.",
  no_stock:      "This campaign is fully claimed.",
  wrong_stage:   "This bundle isn't available for your current stage.",
};

const STEP_LABELS = [
  { key: "fullName", label: "Full name", placeholder: "Your full name" },
  { key: "address",  label: "Street address", placeholder: "123 Main St, Apt 4" },
  { key: "city",     label: "City", placeholder: "Lagos" },
  { key: "state",    label: "State / Province", placeholder: "Lagos State" },
  { key: "country",  label: "Country", placeholder: "Nigeria" },
  { key: "phone",    label: "Phone number", placeholder: "+234 800 000 0000" },
];

export default function BundleDetailPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = use(params);
  const { user }       = useAuth();
  const router         = useRouter();

  const [campaign,    setCampaign]    = useState<Campaign | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [toast,       setToast]       = useState<string | null>(null);
  const [address, setAddress] = useState({
    fullName: user?.name ?? "", address: "", city: "", state: "", country: "", phone: user?.phone ?? "",
  });

  useEffect(() => {
    if (!user) return;
    fetch(`/api/bundles/${campaignId}`)
      .then((r) => r.json())
      .then((d) => {
        setCampaign(d.campaign);
        setEligibility(d.eligibility);
        setLoading(false);
      });
  }, [campaignId, user]);

  useEffect(() => {
    if (user?.name && !address.fullName) setAddress((a) => ({ ...a, fullName: user.name }));
    if (user?.phone && !address.phone)   setAddress((a) => ({ ...a, phone: user.phone ?? "" }));
  }, [user, address.fullName, address.phone]);

  const handleRequest = async () => {
    if (!address.fullName || !address.address || !address.city) {
      setToast("Please fill in all required address fields.");
      return;
    }
    setSubmitting(true);
    const res = await fetch(`/api/bundles/${campaignId}/request`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ deliveryAddress: address }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setToast(data.error ?? "Request failed"); return; }
    setSubmitted(true);
    setShowForm(false);
  };

  if (!user) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎀</div>
          <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Sign in to access bundles</div>
          <button className="btn-primary" onClick={() => router.push("/auth")} style={{ width: "auto", padding: "12px 28px" }}>Sign in</button>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (loading) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;
  if (!campaign) return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>😔</div>
      <div>Campaign not found</div>
      <BottomNav />
    </div>
  );

  const items = campaign.template.items as BundleItem[];

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0d3d2e 0%, #1a5c45 100%)", padding: "20px 20px 28px" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 20, padding: "6px 14px", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif", marginBottom: 16 }}>← Back</button>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }}>
          Sponsored by {campaign.sponsorName}
        </div>
        <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: "white", marginBottom: 8 }}>
          {campaign.title}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
          {campaign.description}
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 800, background: "rgba(255,255,255,0.15)", color: "white", padding: "4px 12px", borderRadius: 20 }}>
            📦 {campaign.bundlesRemaining} of {campaign.totalBundles} remaining
          </span>
          <span style={{ fontSize: 12, fontWeight: 800, background: "rgba(255,255,255,0.15)", color: "white", padding: "4px 12px", borderRadius: 20 }}>
            Free 🎁
          </span>
        </div>
      </div>

      <div style={{ padding: "20px 20px 0" }}>

        {/* Success state */}
        {submitted && (
          <div style={{ background: "var(--green-light)", borderRadius: 16, padding: "20px", textAlign: "center", marginBottom: 20, border: "1.5px solid var(--green)" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>💛</div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, color: "var(--green)", marginBottom: 6 }}>Request received!</div>
            <div style={{ fontSize: 13, color: "var(--green)", lineHeight: 1.6 }}>
              We'll review your request and get back to you within 1–2 business days. You can track the status on the home page.
            </div>
          </div>
        )}

        {/* What's included */}
        <div style={{ background: "var(--white)", borderRadius: 16, padding: "18px 20px", marginBottom: 16, boxShadow: "var(--shadow)", border: "1px solid var(--border)" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, marginBottom: 14 }}>What's included</div>
          <div style={{ fontSize: 13, color: "var(--mid)", marginBottom: 14, lineHeight: 1.5 }}>{campaign.template.description}</div>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, paddingBottom: 10, borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none", marginBottom: i < items.length - 1 ? 10 : 0 }}>
              <div style={{ width: 32, height: 32, background: "var(--green-light)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>📦</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: "var(--mid)" }}>{item.quantity}{item.notes ? ` · ${item.notes}` : ""}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Eligibility / CTA */}
        {!submitted && eligibility && (
          <>
            {eligibility.eligible ? (
              !showForm ? (
                <button
                  onClick={() => setShowForm(true)}
                  style={{ width: "100%", padding: "15px", borderRadius: 14, border: "none", background: "var(--green)", color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif", marginBottom: 16 }}
                >
                  Request this bundle 💛
                </button>
              ) : (
                <div style={{ background: "var(--white)", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "var(--shadow)", border: "1px solid var(--border)" }}>
                  <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Delivery details</div>
                  <p style={{ fontSize: 13, color: "var(--mid)", marginBottom: 18, lineHeight: 1.6 }}>
                    Where should we send your bundle? This is only visible to our fulfillment team.
                  </p>
                  {STEP_LABELS.map(({ key, label, placeholder }) => (
                    <div key={key} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--mid)", marginBottom: 4 }}>{label}</div>
                      <input
                        value={address[key as keyof typeof address]}
                        onChange={(e) => setAddress((a) => ({ ...a, [key]: e.target.value }))}
                        placeholder={placeholder}
                        style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 14, fontFamily: "Nunito, sans-serif", outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                  ))}
                  <button
                    onClick={handleRequest}
                    disabled={submitting}
                    style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "var(--green)", color: "white", fontSize: 14, fontWeight: 800, cursor: submitting ? "default" : "pointer", fontFamily: "Nunito, sans-serif", marginTop: 4, opacity: submitting ? 0.7 : 1 }}
                  >
                    {submitting ? "Submitting…" : "Submit request →"}
                  </button>
                  <button onClick={() => setShowForm(false)} style={{ width: "100%", marginTop: 10, padding: "10px", background: "none", border: "none", color: "var(--mid)", fontSize: 13, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Cancel</button>
                </div>
              )
            ) : (
              <div style={{ background: "var(--bg)", borderRadius: 14, padding: "16px 18px", marginBottom: 16, border: "1.5px solid var(--border)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "var(--ink)" }}>
                  {eligibility.reason === "not_verified" ? "🔒 Verify your identity to unlock" :
                   eligibility.reason === "active_bundle" ? "📦 Bundle in progress" :
                   eligibility.reason === "cooldown" ? "⏳ Cooldown period" :
                   eligibility.reason === "no_stock" ? "🚫 All claimed" : "Not available"}
                </div>
                <div style={{ fontSize: 12, color: "var(--mid)", lineHeight: 1.6, marginBottom: eligibility.reason === "not_verified" ? 14 : 0 }}>
                  {eligibility.reason === "cooldown" && eligibility.daysUntilEligible
                    ? `Available again in ${eligibility.daysUntilEligible} day${eligibility.daysUntilEligible !== 1 ? "s" : ""}`
                    : REASON_MSG[eligibility.reason ?? ""] ?? "You are not eligible for this bundle."}
                </div>
                {eligibility.reason === "not_verified" && (
                  <button onClick={() => router.push("/profile")} style={{ fontSize: 13, fontWeight: 800, background: "var(--green)", color: "white", border: "none", padding: "8px 18px", borderRadius: 20, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
                    Go to profile →
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
