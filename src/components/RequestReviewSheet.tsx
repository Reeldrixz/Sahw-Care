"use client";

import { useState, useEffect } from "react";
import { X, Clock, CheckCircle, MapPin, ShoppingCart, Coffee, BookOpen, Building2, Pill, type LucideIcon } from "lucide-react";
import { ItemData } from "@/components/ListCard";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  item: ItemData;
  onClose: () => void;
  onSubmitted: (itemId: string) => void;
}

type WhoFor = "ME" | "MY_BABY" | "MY_HOUSEHOLD_FAMILY";
type PickupPref = "PICKUP" | "DELIVERY_SUPPORT";

interface Location {
  id: string;
  name: string;
  type: string;
  city: string;
}

const WHO_OPTIONS: { value: WhoFor; label: string }[] = [
  { value: "ME",                 label: "Me" },
  { value: "MY_BABY",            label: "My baby" },
  { value: "MY_HOUSEHOLD_FAMILY", label: "My household / family" },
];

const LOCATION_ICONS: Record<string, LucideIcon> = {
  GROCERY:          ShoppingCart,
  CAFE:             Coffee,
  LIBRARY:          BookOpen,
  COMMUNITY_CENTRE: Building2,
  PHARMACY:         Pill,
  TRANSIT:          MapPin,
};

const LOCATION_LABELS: Record<string, string> = {
  GROCERY:          "Grocery store",
  CAFE:             "Café",
  LIBRARY:          "Library",
  COMMUNITY_CENTRE: "Community centre",
  PHARMACY:         "Pharmacy",
  TRANSIT:          "Transit hub",
};

export default function RequestReviewSheet({ item, onClose, onSubmitted }: Props) {
  const router = useRouter();
  const { user } = useAuth();

  const [note, setNote]               = useState("");
  const [whoFor, setWhoFor]           = useState<WhoFor | null>(null);
  const [pickup, setPickup]           = useState<PickupPref | null>(null);
  const [locationId, setLocationId]   = useState<string | null>(null);
  const [locations, setLocations]     = useState<Location[]>([]);
  const [locLoading, setLocLoading]   = useState(false);
  const [loading, setLoading]         = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);
  const [apiError, setApiError]       = useState<string | null>(null);

  const donorFirstName = item.donor.name.split(" ")[0];
  const city = user?.preferredCity ?? (item.location.includes(",") ? item.location.split(",")[0].trim() : item.location);

  // Load pickup locations when user selects PICKUP
  useEffect(() => {
    if (pickup !== "PICKUP") return;
    setLocLoading(true);
    fetch(`/api/pickup-locations?city=${encodeURIComponent(city)}`)
      .then((r) => r.json())
      .then((d) => setLocations(d.locations ?? []))
      .catch(() => {})
      .finally(() => setLocLoading(false));
  }, [pickup, city]);

  const noteOk = note.trim().length === 0 || note.trim().length <= 100;
  const canSubmit =
    !!whoFor &&
    !!pickup &&
    noteOk &&
    (pickup !== "PICKUP" || !!locationId);

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setApiError(null);
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId:          item.id,
        requestNote:     note.trim() || null,
        whoIsItFor:      whoFor,
        pickupPreference: pickup,
        pickupLocationId: pickup === "PICKUP" ? locationId : null,
      }),
    });
    const d = await res.json();
    if (res.ok) {
      onSubmitted(item.id);
      setSubmittedRequestId(d.request?.id ?? null);
      setSubmitted(true);
    } else {
      setApiError(d.error ?? "Something went wrong");
    }
    setLoading(false);
  };

  const radioBtn = (active: boolean, onClick: () => void, label: string, wide = false) => (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
        borderRadius: 12,
        border: `1.5px solid ${active ? "var(--green)" : "var(--border)"}`,
        background: active ? "var(--green-light)" : "var(--bg)",
        cursor: "pointer", textAlign: "left",
        ...(wide ? { flex: 1 } : {}),
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${active ? "var(--green)" : "var(--border)"}`,
        background: active ? "var(--green)" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {active && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "white" }} />}
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", color: "var(--ink)" }}>
        {label}
      </span>
    </button>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 190 }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200,
        background: "var(--white)", borderRadius: "20px 20px 0 0",
        maxHeight: "92vh", overflowY: "auto",
        animation: "sheetUp 0.3s ease",
        paddingBottom: "env(safe-area-inset-bottom, 16px)",
      }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)" }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px 16px" }}>
          <div style={{ fontSize: 17, fontWeight: 800, fontFamily: "Lora, serif" }}>
            {submitted ? "Request sent" : "Request item"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={22} color="var(--mid)" />
          </button>
        </div>

        <div style={{ padding: "0 20px 32px" }}>
          {/* Item summary */}
          <div style={{
            background: "var(--bg)", borderRadius: 12, padding: "12px 14px",
            marginBottom: 22, display: "flex", alignItems: "center", gap: 12,
            border: "1.5px solid var(--border)",
          }}>
            <Avatar src={item.donor.avatar} name={item.donor.name} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "Nunito, sans-serif", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.title}
              </div>
              <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                From {donorFirstName} · {item.condition} · {item.location.split(",")[0]}
              </div>
            </div>
            {item.urgent && (
              <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 20, background: "#fff3e0", color: "#e65100", flexShrink: 0 }}>
                ⚡ Urgent
              </span>
            )}
          </div>

          {submitted ? (
            /* ── Confirmation ── */
            <div style={{ textAlign: "center", padding: "8px 0 8px" }}>
              <CheckCircle size={52} color="var(--green)" style={{ marginBottom: 16 }} />
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "Lora, serif", marginBottom: 10 }}>
                Request sent to {donorFirstName}
              </div>
              <div style={{ fontSize: 13, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.65, marginBottom: 22 }}>
                {donorFirstName} will review your request and confirm a pickup location.
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#fff8e1", border: "1.5px solid #fbbf24",
                borderRadius: 20, padding: "8px 18px",
                fontSize: 13, fontWeight: 700, color: "#92400e",
                marginBottom: 30,
              }}>
                <Clock size={15} color="#d97706" />
                Pending donor response
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {submittedRequestId && (
                  <button
                    onClick={() => router.push(`/coordination/${submittedRequestId}`)}
                    style={{
                      width: "100%", padding: "14px 0", borderRadius: 14,
                      background: "var(--green)", color: "white", border: "none",
                      fontSize: 14, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer",
                    }}
                  >
                    Track coordination
                  </button>
                )}
                <button
                  onClick={onClose}
                  style={{
                    width: "100%", padding: "14px 0", borderRadius: 14,
                    background: "transparent", color: "var(--ink)",
                    border: "1.5px solid var(--border)",
                    fontSize: 14, fontWeight: 700, fontFamily: "Nunito, sans-serif", cursor: "pointer",
                  }}
                >
                  Browse more items
                </button>
              </div>
            </div>
          ) : (
            /* ── Form ── */
            <>
              {/* Request note (optional, brief) */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", marginBottom: 6, color: "var(--ink)" }}>
                  Add a short request note <span style={{ color: "var(--light)", fontWeight: 600 }}>(optional)</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={100}
                  placeholder="Needed for newborn care"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={{
                    width: "100%", padding: "11px 14px", borderRadius: 12,
                    border: "1.5px solid var(--border)",
                    fontSize: 14, fontFamily: "Nunito, sans-serif", outline: "none",
                    resize: "none", boxSizing: "border-box",
                    background: "var(--bg)", color: "var(--ink)", lineHeight: 1.5,
                  }}
                />
                <div style={{ textAlign: "right", marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--light)", fontFamily: "Nunito, sans-serif" }}>
                    {note.length}/100
                  </span>
                </div>
              </div>

              {/* Who is it for */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", marginBottom: 10, color: "var(--ink)" }}>
                  Who is this for? <span style={{ color: "var(--terra)" }}>*</span>
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {WHO_OPTIONS.map((opt) => radioBtn(whoFor === opt.value, () => setWhoFor(opt.value), opt.label))}
                </div>
              </div>

              {/* Can you collect in person */}
              <div style={{ marginBottom: pickup === "PICKUP" ? 20 : 26 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", marginBottom: 10, color: "var(--ink)" }}>
                  Can you collect in person? <span style={{ color: "var(--terra)" }}>*</span>
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {radioBtn(pickup === "PICKUP", () => { setPickup("PICKUP"); setLocationId(null); }, "I can pick up from a public place")}
                  {radioBtn(pickup === "DELIVERY_SUPPORT", () => { setPickup("DELIVERY_SUPPORT"); setLocationId(null); }, "I need delivery support")}
                </div>
              </div>

              {/* Location selector */}
              {pickup === "PICKUP" && (
                <div style={{ marginBottom: 26 }}>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", color: "var(--ink)", marginBottom: 4 }}>
                      Choose a pickup location <span style={{ color: "var(--terra)" }}>*</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                      Select a public place near you. No home addresses.
                    </div>
                  </div>

                  {locLoading ? (
                    <div style={{ padding: "20px 0", textAlign: "center" }}>
                      <div className="spinner" style={{ margin: "0 auto" }} />
                    </div>
                  ) : locations.length === 0 ? (
                    <div style={{ background: "var(--bg)", borderRadius: 12, padding: "16px", textAlign: "center" }}>
                      <div style={{ fontSize: 13, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 12 }}>
                        We&apos;re adding pickup locations in your area soon.
                      </div>
                      {["Nearest grocery store", "Nearest library", "Nearest pharmacy"].map((name) => (
                        <button
                          key={name}
                          onClick={() => setLocationId(name)}
                          style={{
                            display: "block", width: "100%", padding: "11px 14px", borderRadius: 12, marginBottom: 8,
                            border: `1.5px solid ${locationId === name ? "var(--green)" : "var(--border)"}`,
                            background: locationId === name ? "var(--green-light)" : "var(--bg)",
                            fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif",
                            color: "var(--ink)", cursor: "pointer", textAlign: "left",
                          }}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {locations.map((loc) => {
                        const Icon = LOCATION_ICONS[loc.type] ?? MapPin;
                        const isSelected = locationId === loc.id;
                        return (
                          <button
                            key={loc.id}
                            onClick={() => setLocationId(loc.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12,
                              border: `1.5px solid ${isSelected ? "var(--green)" : "var(--border)"}`,
                              background: isSelected ? "var(--green-light)" : "var(--bg)",
                              cursor: "pointer", textAlign: "left",
                            }}
                          >
                            <div style={{
                              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                              background: isSelected ? "rgba(26,122,94,0.15)" : "white",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              <Icon size={18} color={isSelected ? "var(--green)" : "var(--mid)"} strokeWidth={1.75} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", color: "var(--ink)" }}>
                                {loc.name}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                                {LOCATION_LABELS[loc.type] ?? loc.type}
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircle size={16} color="var(--green)" strokeWidth={2.5} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
                    <MapPin size={12} color="var(--mid)" />
                    <span style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                      Public places only. No home addresses or private residences.
                    </span>
                  </div>
                </div>
              )}

              {apiError && (
                <div style={{ fontSize: 13, color: "var(--terra)", marginBottom: 14, fontFamily: "Nunito, sans-serif", fontWeight: 600 }}>
                  {apiError}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!canSubmit || loading}
                style={{
                  width: "100%", padding: "15px 0", borderRadius: 14,
                  background: canSubmit ? "var(--green)" : "var(--border)",
                  color: canSubmit ? "white" : "var(--mid)",
                  border: "none", fontSize: 15, fontWeight: 800,
                  fontFamily: "Nunito, sans-serif",
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  transition: "background 0.15s",
                }}
              >
                {loading ? "Sending…" : "Send request"}
              </button>

              <button
                onClick={onClose}
                style={{
                  width: "100%", padding: "13px 0", borderRadius: 14, marginTop: 10,
                  background: "transparent", color: "var(--mid)",
                  border: "none", fontSize: 14, fontWeight: 700,
                  fontFamily: "Nunito, sans-serif", cursor: "pointer",
                }}
              >
                Maybe later
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
