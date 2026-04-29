"use client";

import { useState, useEffect } from "react";
import {
  X, Clock, CheckCircle, MapPin,
  Coffee, ShoppingCart, Building2, BookOpen, Pill, Store,
  type LucideIcon,
} from "lucide-react";
import { ItemData } from "@/components/ListCard";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { PICKUP_CATEGORIES, type PickupCategoryId } from "@/lib/pickup-categories";

interface Props {
  item: ItemData;
  onClose: () => void;
  onSubmitted: (itemId: string) => void;
}

type WhoFor = "ME" | "MY_BABY" | "MY_HOUSEHOLD_FAMILY";
type PickupPref = "PICKUP" | "DELIVERY_SUPPORT";

interface Suggestion {
  id: string;
  name: string;
  address: string;
  city: string;
}

interface CategoryBucket {
  id: string;
  label: string;
  icon: string;
  suggestions: Suggestion[];
}

const WHO_OPTIONS: { value: WhoFor; label: string }[] = [
  { value: "ME",                  label: "Me" },
  { value: "MY_BABY",             label: "My baby" },
  { value: "MY_HOUSEHOLD_FAMILY", label: "My household / family" },
];

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  CAFE:             Coffee,
  GROCERY_STORE:    ShoppingCart,
  COMMUNITY_CENTRE: Building2,
  LIBRARY:          BookOpen,
  PHARMACY:         Pill,
  MALL:             Store,
};

export default function RequestReviewSheet({ item, onClose, onSubmitted }: Props) {
  const router = useRouter();
  const { user } = useAuth();

  const [note, setNote]                           = useState("");
  const [whoFor, setWhoFor]                       = useState<WhoFor | null>(null);
  const [pickup, setPickup]                       = useState<PickupPref | null>(null);
  const [selectedCategory, setSelectedCategory]   = useState<PickupCategoryId | null>(null);
  const [categories, setCategories]               = useState<CategoryBucket[]>([]);
  const [locLoading, setLocLoading]               = useState(false);
  const [loading, setLoading]                     = useState(false);
  const [submitted, setSubmitted]                 = useState(false);
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);
  const [apiError, setApiError]                   = useState<string | null>(null);

  const donorFirstName = item.donor.name.split(" ")[0];
  const city = user?.preferredCity ?? (item.location.includes(",") ? item.location.split(",")[0].trim() : item.location);

  // Load category buckets when user selects PICKUP
  useEffect(() => {
    if (pickup !== "PICKUP") return;
    setLocLoading(true);
    fetch(`/api/pickup-locations?city=${encodeURIComponent(city)}`)
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => {})
      .finally(() => setLocLoading(false));
  }, [pickup, city]);

  // Derive locationId for the API from the selected category's first suggestion
  const derivedLocationId: string | null = (() => {
    if (!selectedCategory) return null;
    const bucket = categories.find((c) => c.id === selectedCategory);
    return bucket?.suggestions[0]?.id ?? null;
  })();

  const noteOk = note.trim().length === 0 || note.trim().length <= 100;
  const canSubmit =
    !!whoFor &&
    !!pickup &&
    noteOk &&
    (pickup !== "PICKUP" || !!selectedCategory);

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setApiError(null);
    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId:           item.id,
        requestNote:      note.trim() || null,
        whoIsItFor:       whoFor,
        pickupPreference: pickup,
        pickupLocationId: pickup === "PICKUP" ? derivedLocationId : null,
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

  const radioBtn = (active: boolean, onClick: () => void, label: string) => (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
        borderRadius: 12,
        border: `1.5px solid ${active ? "var(--green)" : "var(--border)"}`,
        background: active ? "var(--green-light)" : "var(--bg)",
        cursor: "pointer", textAlign: "left",
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
                Urgent
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
              {/* Request note */}
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
                  {radioBtn(pickup === "PICKUP", () => { setPickup("PICKUP"); setSelectedCategory(null); }, "I can pick up from a public place")}
                  {radioBtn(pickup === "DELIVERY_SUPPORT", () => { setPickup("DELIVERY_SUPPORT"); setSelectedCategory(null); }, "I need delivery support")}
                </div>
              </div>

              {/* Category picker */}
              {pickup === "PICKUP" && (
                <div style={{ marginBottom: 26 }}>
                  {/* Section header */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "Lora, serif", color: "var(--ink)", marginBottom: 4 }}>
                      Choose a public place type <span style={{ color: "var(--terra)" }}>*</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 400, fontFamily: "Nunito, sans-serif", color: "var(--mid)", lineHeight: 1.5 }}>
                      Pick the kind of place that&apos;s easy for you. You and the donor will agree on the exact spot together.
                    </div>
                  </div>

                  {locLoading ? (
                    <div style={{ padding: "20px 0", textAlign: "center" }}>
                      <div className="spinner" style={{ margin: "0 auto" }} />
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {PICKUP_CATEGORIES.map((cat) => {
                        const Icon = CATEGORY_ICONS[cat.id] ?? MapPin;
                        const isSelected = selectedCategory === cat.id;
                        const bucket = categories.find((c) => c.id === cat.id);
                        const suggestions = bucket?.suggestions ?? [];

                        return (
                          <div key={cat.id}>
                            <button
                              onClick={() => setSelectedCategory(cat.id as PickupCategoryId)}
                              style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "12px 14px", borderRadius: 12, width: "100%",
                                border: `1.5px solid ${isSelected ? "var(--green)" : "var(--border)"}`,
                                background: isSelected ? "var(--green-light)" : "white",
                                cursor: "pointer", textAlign: "left",
                              }}
                            >
                              <div style={{
                                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                                background: isSelected ? "var(--green-light)" : "var(--bg)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>
                                <Icon
                                  size={20}
                                  color={isSelected ? "var(--green)" : "var(--mid)"}
                                  strokeWidth={1.75}
                                />
                              </div>
                              <span style={{
                                flex: 1,
                                fontSize: 14, fontWeight: 700,
                                fontFamily: "Nunito, sans-serif",
                                color: isSelected ? "var(--green)" : "var(--ink)",
                              }}>
                                {cat.label}
                              </span>
                              {isSelected && (
                                <CheckCircle size={16} color="var(--green)" strokeWidth={2.5} />
                              )}
                            </button>

                            {/* Suggestions line — shown only when selected */}
                            {isSelected && (
                              <div style={{
                                marginTop: 6, marginLeft: 14,
                                fontSize: 13, fontWeight: 400,
                                fontFamily: "Nunito, sans-serif",
                                color: "#555555",
                              }}>
                                {suggestions.length > 0
                                  ? `Examples near you: ${suggestions.map((s) => s.name).join(", ")}`
                                  : "You'll agree on the exact spot together."}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Safety footer */}
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <MapPin size={12} color="var(--mid)" strokeWidth={1.75} />
                      <span style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                        Public places only. No home addresses or private residences.
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <MapPin size={12} color="var(--mid)" strokeWidth={1.75} />
                      <span style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
                        For safety, keep all coordination inside Kradəl.
                      </span>
                    </div>
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
