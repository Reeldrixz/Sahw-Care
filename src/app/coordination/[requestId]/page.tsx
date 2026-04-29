"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, MapPin, Calendar, ShieldCheck, Flag, CheckCircle,
  Navigation, AlertTriangle, X, Clock,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { getCategoryLabel } from "@/lib/pickup-categories";

// ── Types ────────────────────────────────────────────────────────────────────

interface Location {
  id: string; name: string; type: string; city: string;
}

interface CoordMsg {
  id: string; messageType: string; content: string | null; createdAt: string;
  sender: { id: string; name: string };
}

interface Coordination {
  id: string; requestId: string; locationId: string | null;
  proposedTime: string | null; proposedBy: string | null;
  confirmedTime: string | null; status: string;
  cancelledById: string | null; cancelReason: string | null;
  request: {
    id: string; requesterId: string; whoIsItFor: string | null; requestNote: string | null;
    pickupPreference: string | null;
    item: { id: string; title: string; donorId: string };
    requester: { id: string; name: string; verificationLevel: number; trustScore: number };
    preferredLocation: Location | null;
  };
  location: Location | null;
  messages: CoordMsg[];
  reports: { id: string; reason: string; reviewed: boolean }[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  PENDING:           "Waiting for donor to confirm",
  LOCATION_CONFIRMED: "Location agreed — propose a time",
  TIME_PROPOSED:     "Time proposed — waiting for confirmation",
  SCHEDULED:         "Meetup scheduled ✓",
  DONOR_READY:       "Donor is at the location",
  DELIVERED:         "Item handed over — please confirm",
  CONFIRMED:         "Pickup complete ✓",
  CANCELLED:         "Coordination cancelled",
  REPORTED:          "Under review by Kradəl team",
};

const QUICK_MSG_LABELS: Record<string, string> = {
  IM_HERE:        "I'm here",
  RUNNING_LATE:   "Running a few minutes late",
  ON_MY_WAY:      "On my way",
  CANT_MAKE_IT:   "Can't make this time",
  PICKUP_COMPLETE: "Pickup complete",
  CUSTOM:         "",
};

const CANCEL_REASONS = [
  "I no longer have the item",
  "I can't make the scheduled time",
  "I changed my mind",
  "I feel uncomfortable with this request",
  "Other",
];

const REPORT_REASONS = [
  "INAPPROPRIATE_MESSAGES",
  "REQUESTING_PERSONAL_INFO",
  "PRESSURE_OR_HARASSMENT",
  "OFF_PLATFORM_CONTACT_ATTEMPT",
  "SUSPICIOUS_BEHAVIOUR",
  "OTHER",
];

const REPORT_LABELS: Record<string, string> = {
  INAPPROPRIATE_MESSAGES:      "Inappropriate messages",
  REQUESTING_PERSONAL_INFO:    "Requesting personal information",
  PRESSURE_OR_HARASSMENT:      "Pressure or harassment",
  OFF_PLATFORM_CONTACT_ATTEMPT: "Trying to move off-platform",
  SUSPICIOUS_BEHAVIOUR:        "Suspicious behaviour",
  OTHER:                       "Other",
};

const TIME_BLOCKS = [
  { key: "MORNING",   label: "Morning", sub: "8am–12pm" },
  { key: "AFTERNOON", label: "Afternoon", sub: "12pm–5pm" },
  { key: "EVENING",   label: "Evening", sub: "5pm–8pm" },
];

const AVATAR_COLORS = ["#1a7a5e", "#2a9d7f", "#d97706", "#6366f1", "#f43f5e"];

function coordAvatar(userId: string, name: string, size = 40) {
  const color = AVATAR_COLORS[userId.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "white", fontFamily: "Nunito, sans-serif", fontWeight: 800,
      fontSize: size * 0.4,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function containsContactInfo(text: string): boolean {
  const phoneRegex = /(\+?\d[\d\s\-().]{7,}\d)/;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const socialRegex = /whatsapp|wa\.me|telegram|snapchat|instagram/i;
  return phoneRegex.test(text) || emailRegex.test(text) || socialRegex.test(text);
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function timeBlock(iso: string | null): string {
  if (!iso) return "";
  const h = new Date(iso).getHours();
  if (h < 12) return "Morning (8am–12pm)";
  if (h < 17) return "Afternoon (12pm–5pm)";
  return "Evening (5pm–8pm)";
}

function timeBlockKey(iso: string | null): string {
  if (!iso) return "";
  const h = new Date(iso).getHours();
  if (h < 12) return "MORNING";
  if (h < 17) return "AFTERNOON";
  return "EVENING";
}

// ── Next 7 days ───────────────────────────────────────────────────────────────

function getNext7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  });
}

// ── Progress bar ──────────────────────────────────────────────────────────────

const PROGRESS_STEPS = ["SCHEDULED", "DONOR_READY", "DELIVERED", "CONFIRMED"];

function ProgressBar({ status }: { status: string }) {
  const idx = PROGRESS_STEPS.indexOf(status);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "12px 16px 8px" }}>
      {PROGRESS_STEPS.map((step, i) => (
        <div key={step} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            width: "100%", height: 4, borderRadius: 4,
            background: i <= idx ? "#1a7a5e" : "#e5e7eb",
            transition: "background 0.3s",
          }} />
          <span style={{ fontSize: 9, color: i <= idx ? "#1a7a5e" : "#9ca3af", fontFamily: "Nunito, sans-serif", fontWeight: 700, textAlign: "center" }}>
            {["Scheduled", "Donor ready", "Delivered", "Confirmed"][i]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CoordinationPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [coord, setCoord]           = useState<Coordination | null>(null);
  const [loading, setLoading]       = useState(true);
  const [acting, setActing]         = useState(false);

  // sheets
  const [showCancel, setShowCancel]     = useState(false);
  const [showReport, setShowReport]     = useState(false);
  const [showSafety, setShowSafety]     = useState(false);
  const [showTimeSheet, setShowTimeSheet] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);

  // form state
  const [cancelReason, setCancelReason]     = useState("");
  const [reportReason, setReportReason]     = useState("");
  const [reportNotes, setReportNotes]       = useState("");
  const [noteText, setNoteText]             = useState("");
  const [noteError, setNoteError]           = useState("");
  const [selectedDate, setSelectedDate]     = useState<Date | null>(null);
  const [selectedBlock, setSelectedBlock]   = useState<string | null>(null);

  // safety banner dismissed state
  const [safetyDismissed, setSafetyDismissed] = useState(false);

  const fetchCoord = useCallback(async () => {
    const res = await fetch(`/api/coordination/${requestId}`);
    if (res.ok) {
      const d = await res.json();
      setCoord(d.coordination);
    }
    setLoading(false);
  }, [requestId]);

  useEffect(() => { fetchCoord(); }, [fetchCoord]);

  // Show safety banner when SCHEDULED
  useEffect(() => {
    if (coord?.status === "SCHEDULED" && !safetyDismissed) setShowSafety(true);
  }, [coord?.status, safetyDismissed]);

  if (!user) return null;

  const donorId     = coord?.request.item.donorId ?? "";
  const recipientId = coord?.request.requesterId ?? "";
  const isDonor     = user.id === donorId;
  const isRecipient = user.id === recipientId;
  const otherName   = isDonor
    ? coord?.request.requester.name.split(" ")[0] ?? "Recipient"
    : "Donor";
  const status = coord?.status ?? "PENDING";

  const post = async (endpoint: string, body?: Record<string, unknown>) => {
    setActing(true);
    try {
      const res = await fetch(`/api/coordination/${requestId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) await fetchCoord();
    } finally {
      setActing(false);
    }
  };

  const sendQuick = async (messageType: string) => {
    await fetch(`/api/coordination/${requestId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageType }),
    });
    fetchCoord();
  };

  const sendNote = async () => {
    if (!noteText.trim()) return;
    if (containsContactInfo(noteText)) {
      setNoteError("Please keep contact details inside Kradəl only.");
      return;
    }
    if (noteText.trim().length > 200) {
      setNoteError("Message too long (max 200 characters).");
      return;
    }
    await fetch(`/api/coordination/${requestId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageType: "CUSTOM", content: noteText.trim() }),
    });
    setNoteText("");
    setNoteError("");
    setShowNoteInput(false);
    fetchCoord();
  };

  if (loading) {
    return (
      <div className="loading" style={{ minHeight: "100vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!coord) {
    return (
      <div style={{ padding: 24, textAlign: "center", fontFamily: "Nunito, sans-serif" }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Coordination not yet started</div>
        <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 24 }}>The donor hasn't confirmed the pickup location yet.</div>
        <button onClick={() => router.back()} style={{ background: "none", border: "1.5px solid #e5e7eb", borderRadius: 12, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>
          Go back
        </button>
      </div>
    );
  }

  const locationRaw  = coord.location ?? coord.request.preferredLocation ?? null;
  const locationLabel = locationRaw ? getCategoryLabel(locationRaw.type) : "TBD";
  const locationSuggestion = locationRaw?.name ?? null;
  const isTerminal   = ["CONFIRMED", "CANCELLED", "REPORTED"].includes(status);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">

        {/* Header */}
        <div style={{ background: "white", borderBottom: "1px solid #f3f4f6", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px 10px" }}>
            <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}>
              <ArrowLeft size={20} color="#1a1a1a" />
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: "#1a1a1a", lineHeight: 1.2 }}>
                Pickup coordination
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "Nunito, sans-serif", marginTop: 2 }}>
                {coord.request.item.title} · {locationLabel}
              </div>
            </div>
          </div>

          {/* Status bar */}
          <div style={{
            margin: "0 16px 12px",
            background: status === "CONFIRMED" ? "#e8f5f1" : status === "CANCELLED" || status === "REPORTED" ? "#fef2f2" : "#fff8e1",
            borderRadius: 10, padding: "8px 12px",
          }}>
            <div style={{
              fontSize: 12, fontWeight: 700, fontFamily: "Nunito, sans-serif",
              color: status === "CONFIRMED" ? "#1a7a5e" : status === "CANCELLED" || status === "REPORTED" ? "#c0392b" : "#92400e",
            }}>
              {STATUS_LABELS[status] ?? status}
            </div>
          </div>

          {/* Progress bar — only for SCHEDULED+ */}
          {["SCHEDULED", "DONOR_READY", "DELIVERED", "CONFIRMED"].includes(status) && (
            <ProgressBar status={status} />
          )}
        </div>

        <div style={{ paddingBottom: 140 }}>

          {/* Safety reminder — shown when SCHEDULED */}
          {/* TODO(safety): consider DB-backed CoordinationMessage with messageType=SYSTEM_NOTICE */}
          {/* for audit trail of safety reminders shown. Requires nullable senderId or */}
          {/* dedicated system user. Deferred — client-side banner sufficient for MVP. */}
          {showSafety && (
            <div style={{ margin: "12px 16px 0", background: "#fffbeb", border: "1.5px solid #fbbf24", borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldCheck size={18} color="#d97706" />
                  <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "Lora, serif", color: "#92400e" }}>Before you go</span>
                </div>
                <button onClick={() => { setShowSafety(false); setSafetyDismissed(true); }} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  <X size={16} color="#9ca3af" />
                </button>
              </div>
              {["Meet in a busy, public area", "Bring a friend if you can", "Let someone know where you're going", "Keep all coordination inside Kradəl"].map((tip) => (
                <div key={tip} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <CheckCircle size={12} color="#d97706" />
                  <span style={{ fontSize: 12, fontFamily: "Nunito, sans-serif", color: "#92400e" }}>{tip}</span>
                </div>
              ))}
            </div>
          )}

          {/* Location card */}
          <div style={{ margin: "12px 16px 0", background: "white", borderRadius: 14, border: "1.5px solid #f3f4f6", padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: coord.confirmedTime ? 10 : 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <MapPin size={18} color="#1a7a5e" strokeWidth={1.75} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, fontFamily: "Nunito, sans-serif", color: "#1a1a1a" }}>{locationLabel}</div>
                {locationSuggestion && (
                  <div style={{ fontSize: 14, fontWeight: 400, fontFamily: "Nunito, sans-serif", color: "#555555", marginTop: 2 }}>
                    Suggested: {locationSuggestion}
                  </div>
                )}
                <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "Nunito, sans-serif", marginTop: 2 }}>Agreed pickup location</div>
              </div>
            </div>

            {coord.confirmedTime && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid #f3f4f6", paddingTop: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#e8f5f1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Calendar size={18} color="#1a7a5e" strokeWidth={1.75} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "Nunito, sans-serif", color: "#1a1a1a" }}>{fmtTime(coord.confirmedTime)}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "Nunito, sans-serif" }}>{timeBlock(coord.confirmedTime)}</div>
                </div>
              </div>
            )}

            {coord.proposedTime && !coord.confirmedTime && (
              <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 10, marginTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#d97706", fontFamily: "Nunito, sans-serif", marginBottom: 6 }}>
                  ⏳ Proposed time
                </div>
                <div style={{ fontSize: 13, fontFamily: "Nunito, sans-serif", color: "#1a1a1a", fontWeight: 800 }}>
                  {fmtTime(coord.proposedTime)} · {timeBlock(coord.proposedTime)}
                </div>
                {/* Confirm time — if you're not the proposer */}
                {coord.proposedBy !== user.id && status === "TIME_PROPOSED" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button
                      onClick={() => post("confirm-time")}
                      disabled={acting}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 12, background: "#1a7a5e", color: "white", border: "none", fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer" }}
                    >
                      This works for me ✓
                    </button>
                    <button
                      onClick={() => setShowTimeSheet(true)}
                      style={{ flex: 1, padding: "10px 0", borderRadius: 12, background: "transparent", color: "#555", border: "1.5px solid #e5e7eb", fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer" }}
                    >
                      Suggest another
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recipient request note */}
          {coord.request.requestNote && (
            <div style={{ margin: "10px 16px 0", background: "white", borderRadius: 14, border: "1.5px solid #f3f4f6", padding: "12px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", fontFamily: "Nunito, sans-serif", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                Request note
              </div>
              <div style={{ fontSize: 13, fontFamily: "Nunito, sans-serif", color: "#1a1a1a", lineHeight: 1.55 }}>
                &ldquo;{coord.request.requestNote}&rdquo;
              </div>
            </div>
          )}

          {/* Messages */}
          {coord.messages.length > 0 && (
            <div style={{ margin: "12px 16px 0" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", fontFamily: "Nunito, sans-serif", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Updates
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {coord.messages.map((msg) => {
                  const isMe = msg.sender.id === user.id;
                  const msgText = msg.messageType === "CUSTOM" ? msg.content : QUICK_MSG_LABELS[msg.messageType];
                  return (
                    <div key={msg.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, flexDirection: isMe ? "row-reverse" : "row" }}>
                      {coordAvatar(msg.sender.id, msg.sender.name, 28)}
                      <div style={{
                        maxWidth: "70%", background: isMe ? "#e8f5f1" : "white",
                        borderRadius: isMe ? "12px 12px 0 12px" : "12px 12px 12px 0",
                        padding: "8px 12px", border: "1px solid #f3f4f6",
                      }}>
                        <div style={{ fontSize: 12, fontFamily: "Nunito, sans-serif", color: "#1a1a1a", fontWeight: isMe ? 600 : 700 }}>
                          {msgText}
                        </div>
                        <div style={{ fontSize: 10, color: "#9ca3af", fontFamily: "Nunito, sans-serif", marginTop: 4 }}>
                          {isMe ? "You" : msg.sender.name.split(" ")[0]} · {new Date(msg.createdAt).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Action bar (sticky bottom) ── */}
        {!isTerminal && (
          <div style={{
            position: "fixed", bottom: 64, left: 0, right: 0, zIndex: 20,
            background: "white", borderTop: "1px solid #f3f4f6", padding: "12px 16px",
            maxWidth: 430, margin: "0 auto",
          }}>

            {/* Donor: confirm location (PENDING) */}
            {isDonor && status === "PENDING" && (
              <button
                onClick={() => post("confirm-location")}
                disabled={acting}
                style={{ width: "100%", padding: "14px 0", borderRadius: 14, background: "#1a7a5e", color: "white", border: "none", fontSize: 15, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer", marginBottom: 8 }}
              >
                <CheckCircle size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
                Confirm pickup location
              </button>
            )}

            {/* Propose time (LOCATION_CONFIRMED — either party) */}
            {["LOCATION_CONFIRMED"].includes(status) && (
              <button
                onClick={() => setShowTimeSheet(true)}
                style={{ width: "100%", padding: "14px 0", borderRadius: 14, background: "#1a7a5e", color: "white", border: "none", fontSize: 15, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer", marginBottom: 8 }}
              >
                <Calendar size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
                Propose a pickup time
              </button>
            )}

            {/* Donor: "I'm here" (SCHEDULED) */}
            {isDonor && status === "SCHEDULED" && (
              <button
                onClick={() => { post("ready"); sendQuick("IM_HERE"); }}
                disabled={acting}
                style={{ width: "100%", padding: "14px 0", borderRadius: 14, background: "#1a7a5e", color: "white", border: "none", fontSize: 15, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer", marginBottom: 8 }}
              >
                <Navigation size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
                I&apos;m at the pickup location
              </button>
            )}

            {/* Donor: hand over (DONOR_READY) */}
            {isDonor && status === "DONOR_READY" && (
              <button
                onClick={() => post("delivered")}
                disabled={acting}
                style={{ width: "100%", padding: "14px 0", borderRadius: 14, background: "#1a7a5e", color: "white", border: "none", fontSize: 15, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer", marginBottom: 8 }}
              >
                <CheckCircle size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
                I&apos;ve handed it over
              </button>
            )}

            {/* Recipient: confirm received (DELIVERED) */}
            {isRecipient && status === "DELIVERED" && (
              <button
                onClick={() => post("confirm-received")}
                disabled={acting}
                style={{ width: "100%", padding: "14px 0", borderRadius: 14, background: "#1a7a5e", color: "white", border: "none", fontSize: 15, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer", marginBottom: 8 }}
              >
                <CheckCircle size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
                I received it ✓
              </button>
            )}

            {/* Quick actions — SCHEDULED or DONOR_READY */}
            {["SCHEDULED", "DONOR_READY"].includes(status) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                {[
                  { key: "ON_MY_WAY",    label: "On my way" },
                  { key: "RUNNING_LATE", label: "Running late" },
                  { key: "CANT_MAKE_IT", label: "Can't make it" },
                  { key: "IM_HERE",      label: "I'm here" },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => sendQuick(key)}
                    style={{ padding: "10px 0", borderRadius: 12, background: "var(--bg)", border: "1.5px solid #e5e7eb", fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", color: "#1a1a1a", cursor: "pointer" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Persistent safety footer */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0 4px" }}>
              <ShieldCheck size={13} color="#1a7a5e" strokeWidth={1.75} />
              <span style={{ fontSize: 11, color: "#1a7a5e", fontFamily: "Nunito, sans-serif", fontWeight: 600 }}>
                Keep all coordination inside Kradəl
              </span>
            </div>

            {/* Send a note */}
            {!isTerminal && (
              showNoteInput ? (
                <div style={{ marginBottom: 8 }}>
                  <textarea
                    rows={2}
                    maxLength={200}
                    placeholder="Keep it brief — coordination only"
                    value={noteText}
                    onChange={(e) => { setNoteText(e.target.value); setNoteError(""); }}
                    style={{
                      width: "100%", padding: "10px 12px", borderRadius: 12,
                      border: `1.5px solid ${noteError ? "#c0392b" : "#e5e7eb"}`,
                      fontSize: 13, fontFamily: "Nunito, sans-serif", outline: "none",
                      resize: "none", boxSizing: "border-box", marginBottom: 6,
                    }}
                  />
                  {noteError && <div style={{ fontSize: 12, color: "#c0392b", fontFamily: "Nunito, sans-serif", marginBottom: 6 }}>{noteError}</div>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={sendNote} style={{ flex: 1, padding: "9px 0", borderRadius: 10, background: "#1a7a5e", color: "white", border: "none", fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: "pointer" }}>Send</button>
                    <button onClick={() => { setShowNoteInput(false); setNoteText(""); setNoteError(""); }} style={{ padding: "9px 14px", borderRadius: 10, background: "transparent", color: "#555", border: "1.5px solid #e5e7eb", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNoteInput(true)}
                  style={{ width: "100%", padding: "10px 0", borderRadius: 12, background: "transparent", color: "#555", border: "1.5px solid #e5e7eb", fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", cursor: "pointer", marginBottom: 8 }}
                >
                  Send a note
                </button>
              )
            )}

            {/* Report button */}
            <button
              onClick={() => setShowReport(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: "6px 0", color: "#9ca3af", fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700 }}
            >
              <Flag size={13} /> Report an issue
            </button>

            {/* Cancel button */}
            <button
              onClick={() => setShowCancel(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: "4px 0", color: "#c0392b", fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700 }}
            >
              <X size={13} /> Cancel this pickup
            </button>
          </div>
        )}

        {/* CONFIRMED state */}
        {status === "CONFIRMED" && (
          <div style={{ margin: "16px 16px 0", background: "#e8f5f1", border: "1.5px solid #1a7a5e", borderRadius: 16, padding: "20px", textAlign: "center" }}>
            <CheckCircle size={40} color="#1a7a5e" style={{ marginBottom: 12 }} />
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>Pickup complete ✓</div>
            <div style={{ fontSize: 13, color: "#555", fontFamily: "Nunito, sans-serif", lineHeight: 1.6 }}>
              This coordination is complete. Thank you for using Kradəl safely.
            </div>
          </div>
        )}

        {/* CANCELLED state */}
        {status === "CANCELLED" && (
          <div style={{ margin: "16px 16px 0", background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: 16, padding: "20px", textAlign: "center" }}>
            <X size={40} color="#c0392b" style={{ marginBottom: 12 }} />
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>Coordination cancelled</div>
            {coord.cancelReason && (
              <div style={{ fontSize: 13, color: "#555", fontFamily: "Nunito, sans-serif" }}>Reason: {coord.cancelReason}</div>
            )}
          </div>
        )}

        {/* Other party info */}
        <div style={{ margin: "12px 16px 0", background: "white", borderRadius: 14, border: "1.5px solid #f3f4f6", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          {coordAvatar(isDonor ? recipientId : donorId, otherName, 36)}
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", color: "#1a1a1a" }}>{otherName}</div>
            {!isDonor && (
              <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "Nunito, sans-serif" }}>
                {coord.request.requester.verificationLevel >= 1 ? "✓ Verified member" : "New member"} · Trust score {coord.request.requester.trustScore}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Time proposal sheet ── */}
      {showTimeSheet && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowTimeSheet(false)}>
          <div style={{ background: "white", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, padding: "20px 20px 40px", animation: "sheetUp 0.25s ease" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "#e5e7eb", borderRadius: 4, margin: "0 auto 20px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <Calendar size={20} color="#1a7a5e" />
              <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700 }}>Propose a pickup time</div>
            </div>

            {/* Date selector */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", fontFamily: "Nunito, sans-serif", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Date</div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
                {getNext7Days().map((d) => {
                  const isSelected = selectedDate?.toDateString() === d.toDateString();
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => setSelectedDate(d)}
                      style={{
                        flexShrink: 0, padding: "10px 14px", borderRadius: 12, textAlign: "center",
                        border: `1.5px solid ${isSelected ? "#1a7a5e" : "#e5e7eb"}`,
                        background: isSelected ? "#e8f5f1" : "white",
                        cursor: "pointer", fontFamily: "Nunito, sans-serif",
                      }}
                    >
                      <div style={{ fontSize: 11, color: isSelected ? "#1a7a5e" : "#9ca3af", fontWeight: 700 }}>
                        {d.toLocaleDateString("en", { weekday: "short" })}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: isSelected ? "#1a7a5e" : "#1a1a1a" }}>
                        {d.getDate()}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time block selector */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", fontFamily: "Nunito, sans-serif", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Time</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {TIME_BLOCKS.map(({ key, label, sub }) => {
                  const isSelected = selectedBlock === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedBlock(key)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, textAlign: "left",
                        border: `1.5px solid ${isSelected ? "#1a7a5e" : "#e5e7eb"}`,
                        background: isSelected ? "#e8f5f1" : "white", cursor: "pointer",
                      }}
                    >
                      <Clock size={16} color={isSelected ? "#1a7a5e" : "#9ca3af"} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "Nunito, sans-serif", color: isSelected ? "#1a7a5e" : "#1a1a1a" }}>{label}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "Nunito, sans-serif" }}>{sub}</div>
                      </div>
                      {isSelected && <CheckCircle size={16} color="#1a7a5e" style={{ marginLeft: "auto" }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              disabled={!selectedDate || !selectedBlock || acting}
              onClick={async () => {
                if (!selectedDate || !selectedBlock) return;
                await post("propose-time", { date: selectedDate.toISOString(), timeBlock: selectedBlock });
                setShowTimeSheet(false);
                setSelectedDate(null);
                setSelectedBlock(null);
              }}
              style={{
                width: "100%", padding: "14px 0", borderRadius: 14,
                background: selectedDate && selectedBlock ? "#1a7a5e" : "#e5e7eb",
                color: selectedDate && selectedBlock ? "white" : "#9ca3af",
                border: "none", fontSize: 15, fontWeight: 800, fontFamily: "Nunito, sans-serif",
                cursor: selectedDate && selectedBlock ? "pointer" : "not-allowed",
              }}
            >
              Propose this time
            </button>
          </div>
        </div>
      )}

      {/* ── Cancel sheet ── */}
      {showCancel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowCancel(false)}>
          <div style={{ background: "white", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, padding: "20px 20px 40px", animation: "sheetUp 0.25s ease" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "#e5e7eb", borderRadius: 4, margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 16, color: "#1a1a1a", marginBottom: 16 }}>Cancel this pickup?</div>
            {CANCEL_REASONS.map((r) => (
              <label key={r} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #f5f5f5", cursor: "pointer" }}>
                <input type="radio" name="cancel-reason" value={r} checked={cancelReason === r} onChange={() => setCancelReason(r)} style={{ accentColor: "#c0392b", width: 16, height: 16 }} />
                <span style={{ fontSize: 13, fontFamily: "Nunito, sans-serif", color: "#1a1a1a" }}>{r}</span>
              </label>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={async () => {
                  if (!cancelReason) return;
                  await post("cancel", { reason: cancelReason });
                  setShowCancel(false);
                }}
                disabled={!cancelReason || acting}
                style={{ flex: 1, padding: "13px 0", borderRadius: 12, background: cancelReason ? "#c0392b" : "#e5e7eb", color: cancelReason ? "white" : "#9ca3af", border: "none", fontSize: 14, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: cancelReason ? "pointer" : "not-allowed" }}
              >
                Cancel coordination
              </button>
              <button onClick={() => setShowCancel(false)} style={{ padding: "13px 20px", borderRadius: 12, background: "transparent", color: "#555", border: "1.5px solid #e5e7eb", fontSize: 14, fontWeight: 700, fontFamily: "Nunito, sans-serif", cursor: "pointer" }}>
                Go back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Report sheet ── */}
      {showReport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={() => setShowReport(false)}>
          <div style={{ background: "white", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 430, padding: "20px 20px 40px", animation: "sheetUp 0.25s ease" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "#e5e7eb", borderRadius: 4, margin: "0 auto 20px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <AlertTriangle size={18} color="#d97706" />
              <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 16, color: "#1a1a1a" }}>Report an issue</div>
            </div>
            {REPORT_REASONS.map((r) => (
              <label key={r} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #f5f5f5", cursor: "pointer" }}>
                <input type="radio" name="report-reason" value={r} checked={reportReason === r} onChange={() => setReportReason(r)} style={{ accentColor: "#d97706", width: 16, height: 16 }} />
                <span style={{ fontSize: 13, fontFamily: "Nunito, sans-serif", color: "#1a1a1a" }}>{REPORT_LABELS[r]}</span>
              </label>
            ))}
            <textarea
              rows={2}
              maxLength={500}
              placeholder="Additional notes (optional)"
              value={reportNotes}
              onChange={(e) => setReportNotes(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1.5px solid #e5e7eb", fontSize: 13, fontFamily: "Nunito, sans-serif", outline: "none", resize: "none", boxSizing: "border-box", marginTop: 14 }}
            />
            <button
              onClick={async () => {
                if (!reportReason) return;
                await post("report", { reason: reportReason, notes: reportNotes || null });
                setShowReport(false);
              }}
              disabled={!reportReason || acting}
              style={{ width: "100%", padding: "13px 0", borderRadius: 12, marginTop: 16, background: reportReason ? "#d97706" : "#e5e7eb", color: reportReason ? "white" : "#9ca3af", border: "none", fontSize: 14, fontWeight: 800, fontFamily: "Nunito, sans-serif", cursor: reportReason ? "pointer" : "not-allowed" }}
            >
              Submit report
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
