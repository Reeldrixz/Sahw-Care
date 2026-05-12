"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChevronLeft, ChevronRight, Calendar, ShieldCheck,
  Lock, Heart, Package, Gift, MapPin, CheckCircle,
  Circle, ChevronDown, ChevronUp, Phone, ExternalLink,
  Sparkles, BookOpen, Users,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────

interface JourneyUser {
  dueDate: string | null;
  babyBirthDate: string | null;
  journeyType: string | null;
  currentStage: string | null;
  createdAt: string;
  isVerified: boolean;
}

interface ActiveRegister {
  id: string;
  title: string;
  totalItems: number;
  fundedItems: number;
}

interface BundleApp {
  id: string;
  status: string;
  createdAt: string;
  bundle: { name: string; code: string };
}

interface FulfillmentItem {
  id: string;
  name: string;
  registerId: string;
  registerTitle: string;
  status: string;
  queueStatus: string | null;
}

interface ActivePickup {
  requestId: string;
  itemTitle: string;
  donorFirstName: string;
  coordinationStatus: string;
}

interface Milestones {
  hasCircleMembership: boolean;
  hasRegister: boolean;
  hasItemFulfilled: boolean;
  hasBundleApproved: boolean;
  hasPickupDelivered: boolean;
  hasCommunityPost: boolean;
}

interface BundleSlot {
  code: string;
  name: string;
  slotsRemaining: number;
  slotsPerMonth: number;
}

interface JourneyData {
  user: JourneyUser;
  registers: ActiveRegister[];
  bundleApplications: BundleApp[];
  fulfillmentItems: FulfillmentItem[];
  activePickups: ActivePickup[];
  milestones: Milestones;
  bundleSlots: BundleSlot[];
}

// ── Stage calculation ──────────────────────────────────────

interface StageInfo {
  label: string;
  subtitle: string;
  calendarNote: string;
}

function computeStage(user: JourneyUser): StageInfo {
  const now = new Date();

  if (user.dueDate) {
    const due = new Date(user.dueDate);
    const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000);

    if (daysLeft > 90) {
      return {
        label: "Early Pregnancy",
        subtitle: "The first two trimesters. Your body is doing something extraordinary.",
        calendarNote: `Due in about ${Math.round(daysLeft / 7)} weeks`,
      };
    }
    if (daysLeft > 0) {
      return {
        label: "Third Trimester — Preparing for Birth",
        subtitle: "Getting ready for the big day. We're here with you.",
        calendarNote: `${daysLeft} days until your due date`,
      };
    }
    if (!user.babyBirthDate) {
      return {
        label: "Labour & Delivery Period",
        subtitle: "Your little one is almost here. You're so close.",
        calendarNote: "Any day now",
      };
    }
  }

  if (user.babyBirthDate) {
    const dob = new Date(user.babyBirthDate);
    const agedays = Math.floor((now.getTime() - dob.getTime()) / 86400000);

    if (agedays <= 84) {
      const weeks = Math.floor(agedays / 7);
      return {
        label: "Postpartum Recovery",
        subtitle: "The first 12 weeks. Rest, recover, and let us help.",
        calendarNote: `Baby is ${weeks} week${weeks === 1 ? "" : "s"} old`,
      };
    }
    if (agedays <= 365) {
      const months = Math.floor(agedays / 30);
      return {
        label: "Infant Stage",
        subtitle: "Your baby is growing. You're doing great.",
        calendarNote: `Baby is ${months} month${months === 1 ? "" : "s"} old`,
      };
    }
    const months = Math.floor(agedays / 30);
    return {
      label: "Growing Together",
      subtitle: "Every day is a new milestone. Thank you for letting us be part of it.",
      calendarNote: `Baby is ${months} months old`,
    };
  }

  // Fallback from journeyType
  if (user.journeyType === "pregnant") {
    return {
      label: "Your Pregnancy Journey",
      subtitle: "We're here to support you every step of the way.",
      calendarNote: "",
    };
  }
  if (user.journeyType === "postpartum") {
    return {
      label: "Postpartum Journey",
      subtitle: "The newborn stage. You're not alone.",
      calendarNote: "",
    };
  }

  return {
    label: "Your Support Journey",
    subtitle: "You're part of the Kradəl community. We're here for you.",
    calendarNote: "",
  };
}

// ── Recommendations per stage ──────────────────────────────

interface Recommendation {
  key: string;
  label: string;
  description: string;
  actionLabel: string;
  href: string;
}

function getRecommendations(user: JourneyUser): Recommendation[] {
  const now = new Date();

  if (user.dueDate) {
    const due = new Date(user.dueDate);
    const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000);

    if (daysLeft > 90) {
      return [
        { key: "B01", label: "First Trimester Essentials", description: "Vitamins, comfort items, and early pregnancy support.", actionLabel: "Apply", href: "/bundles" },
        { key: "B02", label: "Second Trimester Comfort Kit", description: "Maternity wear, belly support, and midstage essentials.", actionLabel: "Apply", href: "/bundles" },
        { key: "circles", label: "Prenatal circles", description: "Connect with other mothers in your stage.", actionLabel: "Explore", href: "/circles" },
        { key: "discover", label: "Find prenatal items near you", description: "Browse items donated by people in your community.", actionLabel: "Browse", href: "/" },
      ];
    }
    if (daysLeft > 0) {
      return [
        { key: "B03", label: "Third Trimester Preparation Kit", description: "Everything you need as you approach your due date.", actionLabel: "Apply", href: "/bundles" },
        { key: "B04", label: "Hospital Bag — Mother", description: "Essentials for labour and your hospital stay.", actionLabel: "Apply", href: "/bundles" },
        { key: "B05", label: "Hospital Bag — Baby", description: "First outfit, blanket, and newborn necessities.", actionLabel: "Apply", href: "/bundles" },
        { key: "reg", label: "Create a register for hospital essentials", description: "Let your community support you with specific items.", actionLabel: "Create", href: "/registers/new" },
      ];
    }
    // labour
    return [
      { key: "B04", label: "Hospital Bag — Mother", description: "Essentials for labour and your hospital stay.", actionLabel: "Apply", href: "/bundles" },
      { key: "B05", label: "Hospital Bag — Baby", description: "First outfit, blanket, and newborn necessities.", actionLabel: "Apply", href: "/bundles" },
      { key: "circles", label: "Connect with other mothers", description: "A community that's been through it — just like you.", actionLabel: "Explore", href: "/circles" },
    ];
  }

  if (user.babyBirthDate) {
    const dob = new Date(user.babyBirthDate);
    const agedays = Math.floor((now.getTime() - dob.getTime()) / 86400000);

    if (agedays <= 84) {
      return [
        { key: "B09", label: "Postpartum Recovery Kit", description: "Support for your body and mind in the first weeks.", actionLabel: "Apply", href: "/bundles" },
        { key: "B10", label: "Breastfeeding Support Kit", description: "Pumps, pads, and practical breastfeeding essentials.", actionLabel: "Apply", href: "/bundles" },
        { key: "B12", label: "First Month Home Kit", description: "Everything you need for the first weeks at home.", actionLabel: "Apply", href: "/bundles" },
        { key: "discover", label: "Find postpartum items near you", description: "Browse donated items in your community.", actionLabel: "Browse", href: "/" },
      ];
    }
    if (agedays <= 365) {
      return [
        { key: "B07", label: "Infant Feeding Kit", description: "Bottles, formula support, and feeding accessories.", actionLabel: "Apply", href: "/bundles" },
        { key: "B08", label: "Hygiene & Care Kit", description: "Baby bath, skincare, and essential care items.", actionLabel: "Apply", href: "/bundles" },
        { key: "B06", label: "Complete Newborn Bundle", description: "Clothing, sleep items, and newborn necessities.", actionLabel: "Apply", href: "/bundles" },
        { key: "discover", label: "Browse available items", description: "Discover what's being donated in your area.", actionLabel: "Browse", href: "/" },
      ];
    }
  }

  return [
    { key: "bundles", label: "Browse all bundles", description: "See all available support bundles.", actionLabel: "Browse", href: "/bundles" },
    { key: "reg", label: "Create a register", description: "Ask your community for specific items you need.", actionLabel: "Create", href: "/registers/new" },
    { key: "discover", label: "Discover donated items", description: "Find items near you, donated by community members.", actionLabel: "Browse", href: "/" },
  ];
}

// ── Fulfillment status labels ──────────────────────────────

function statusLabel(status: string, queueStatus: string | null): string {
  if (queueStatus === "QUEUED")     return "Being purchased";
  if (queueStatus === "PURCHASED")  return "Being purchased";
  if (queueStatus === "DISPATCHED") return "On its way";
  if (status === "AWAITING_ADDRESS")  return "Waiting for your address";
  if (status === "AWAITING_PURCHASE") return "Being purchased";
  return "In fulfilment";
}

function coordStatusLabel(s: string): string {
  if (s === "PENDING")           return "Awaiting donor response";
  if (s === "ACCEPTED")          return "Donor accepted";
  if (s === "TIME_PROPOSED")     return "Time being confirmed";
  if (s === "SCHEDULED")         return "Pickup scheduled";
  if (s === "DONOR_READY")       return "Donor is ready";
  return s.replace(/_/g, " ").toLowerCase();
}

// ── Static resources data ──────────────────────────────────

const RESOURCES = [
  {
    key: "mental",
    icon: Heart,
    title: "Postpartum mental health",
    items: [
      { name: "Postpartum Support International (Canada)", url: "https://www.postpartum.net", phone: "1-800-944-4773" },
      { name: "CAMH — Centre for Addiction and Mental Health", url: "https://www.camh.ca", phone: "1-800-463-2338" },
      { name: "Crisis Services Canada", url: "https://www.crisisservicescanada.ca", phone: "1-833-456-4566" },
    ],
  },
  {
    key: "breastfeeding",
    icon: Sparkles,
    title: "Breastfeeding support",
    items: [
      { name: "La Leche League Canada", url: "https://www.lllc.ca", phone: "Find local group at lllc.ca" },
      { name: "Public Health Ontario — Telehealth", url: "https://www.ontario.ca/page/telehealth-ontario", phone: "1-866-797-0000 (24/7 nurse line)" },
    ],
  },
  {
    key: "newcomer",
    icon: Users,
    title: "Newcomer & settlement support",
    items: [
      { name: "211 Ontario (social services directory)", url: "https://www.211ontario.ca", phone: "Dial 2-1-1" },
      { name: "Settlement.org", url: "https://settlement.org", phone: "" },
    ],
  },
  {
    key: "food",
    icon: Package,
    title: "Food & material support",
    items: [
      { name: "Food Banks Canada", url: "https://www.foodbankscanada.ca", phone: "" },
      { name: "The Salvation Army", url: "https://www.salvationarmy.ca", phone: "Find local branch at salvationarmy.ca" },
    ],
  },
  {
    key: "emergency",
    icon: ShieldCheck,
    title: "Emergency",
    items: [
      { name: "Kids Help Phone", url: "https://kidshelpphone.ca", phone: "1-800-668-6868" },
      { name: "Assaulted Women's Helpline", url: "https://www.awhl.org", phone: "1-866-863-0511" },
      { name: "Emergency", url: "", phone: "911" },
    ],
  },
];

// ── Component ──────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: "white", borderRadius: 16, padding: 16,
  marginBottom: 14, border: "1px solid #e0e0e0",
};

const SECTION_LABEL: React.CSSProperties = {
  fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 800,
  letterSpacing: "0.08em", textTransform: "uppercase", color: "#555555",
  marginBottom: 12,
};

const GREEN = "#1a7a5e";
const MID   = "#555555";

export default function JourneyPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [data, setData]       = useState<JourneyData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [openResource, setOpenResource] = useState<string>("mental");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/auth"); return; }
    if (user.journeyType === "donor") { router.replace("/profile"); return; }

    fetch("/api/journey")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { router.replace("/profile"); return; }
        setData(d);
      })
      .catch(() => router.replace("/profile"))
      .finally(() => setFetching(false));
  }, [user, authLoading, router]);

  if (authLoading || fetching || !data) {
    return (
      <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
        <div style={{ background: GREEN, padding: "20px 16px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <ChevronLeft size={22} color="white" strokeWidth={1.75} style={{ cursor: "pointer" }} onClick={() => router.back()} />
          <span style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: "white" }}>My Journey</span>
        </div>
        <div style={{ padding: "16px" }}>
          {[160, 220, 140, 180].map((h, i) => (
            <div key={i} style={{ ...CARD, height: h, background: "#f3f4f6", animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      </div>
    );
  }

  const stage = computeStage(data.user);
  const recs  = getRecommendations(data.user);
  const ms    = data.milestones;

  const allEmpty =
    data.registers.length === 0 &&
    data.bundleApplications.length === 0 &&
    data.fulfillmentItems.length === 0 &&
    data.activePickups.length === 0;

  const milestoneList = [
    {
      key: "created",
      done: true,
      label: "Account created",
      note: new Date(data.user.createdAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }),
      nudge: "",
    },
    {
      key: "verified",
      done: data.user.isVerified,
      label: "Identity verified",
      note: "ID document reviewed and approved",
      nudge: "Upload your ID to get verified →",
    },
    {
      key: "circle",
      done: ms.hasCircleMembership,
      label: "Joined a circle",
      note: "You're part of a care circle",
      nudge: "Find your circle →",
    },
    {
      key: "register",
      done: ms.hasRegister,
      label: "First register created",
      note: "You created your first wish register",
      nudge: "Create your first register →",
    },
    {
      key: "funded",
      done: ms.hasItemFulfilled,
      label: "First item fulfilled",
      note: "A community member fulfilled an item from your register",
      nudge: "Your register items are waiting for support",
    },
    {
      key: "bundle",
      done: ms.hasBundleApproved,
      label: "First bundle received",
      note: "A bundle application was approved for you",
      nudge: "Apply for a bundle →",
    },
    {
      key: "pickup",
      done: ms.hasPickupDelivered,
      label: "First pickup completed",
      note: "You completed a community pickup",
      nudge: "Browse available donations →",
    },
    {
      key: "community",
      done: ms.hasCommunityPost,
      label: "Community active",
      note: "You've shared in a circle",
      nudge: "Say hello in your circle →",
    },
  ];

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: GREEN, padding: "20px 16px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={() => router.push("/profile")}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}
          aria-label="Back to profile"
        >
          <ChevronLeft size={22} color="white" strokeWidth={1.75} />
        </button>
        <span style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: "white" }}>My Journey</span>
      </div>

      <div style={{ padding: "16px" }}>

        {/* ── SECTION 1: Current stage ─────────────────────── */}
        <div style={CARD}>
          <div style={SECTION_LABEL}>Where you are now</div>
          <div style={{
            fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700,
            color: GREEN, marginBottom: 6, lineHeight: 1.25,
          }}>
            {stage.label}
          </div>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, color: MID, lineHeight: 1.5, marginBottom: stage.calendarNote ? 14 : 0 }}>
            {stage.subtitle}
          </div>
          {stage.calendarNote && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
              <Calendar size={14} color={GREEN} strokeWidth={1.75} />
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: GREEN, fontWeight: 700 }}>
                {stage.calendarNote}
              </span>
            </div>
          )}
        </div>

        {/* ── SECTION 2: Active support ────────────────────── */}
        <div style={CARD}>
          <div style={SECTION_LABEL}>Your active support</div>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: MID, marginBottom: 14 }}>
            What&apos;s currently happening for you
          </div>

          {allEmpty ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <BookOpen size={32} color="#d1d5db" strokeWidth={1.75} style={{ marginBottom: 12 }} />
              <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                No active support right now
              </div>
              <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: MID, marginBottom: 16 }}>
                Browse bundles or create a register to get started.
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => router.push("/bundles")}
                  style={{ padding: "10px 20px", borderRadius: 20, background: GREEN, color: "white", border: "none", fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                  Browse bundles
                </button>
                <button onClick={() => router.push("/registers/new")}
                  style={{ padding: "10px 20px", borderRadius: 20, background: "none", color: GREEN, border: `1.5px solid ${GREEN}`, fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                  Create a register
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Registers */}
              {data.registers.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 800, color: "var(--ink)", marginBottom: 8 }}>
                    Your registers
                  </div>
                  {data.registers.map((reg) => (
                    <div key={reg.id}
                      onClick={() => router.push(`/registers/${reg.id}`)}
                      style={{ background: "#f9fafb", borderRadius: 12, padding: "12px", marginBottom: 8, cursor: "pointer", border: "1px solid #f0f0f0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{reg.title}</div>
                        <ChevronRight size={14} color="#9ca3af" strokeWidth={1.75} />
                      </div>
                      <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: MID, marginBottom: 6 }}>
                        {reg.fundedItems} of {reg.totalItems} item{reg.totalItems !== 1 ? "s" : ""} funded
                      </div>
                      <div style={{ background: "#e5e7eb", borderRadius: 4, height: 5 }}>
                        <div style={{
                          width: `${reg.totalItems > 0 ? (reg.fundedItems / reg.totalItems) * 100 : 0}%`,
                          height: "100%", background: GREEN, borderRadius: 4, transition: "width 0.3s",
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Bundle applications */}
              {data.bundleApplications.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 800, color: "var(--ink)", marginBottom: 8 }}>
                    Bundle applications
                  </div>
                  {data.bundleApplications.map((app) => {
                    const days = Math.floor((Date.now() - new Date(app.createdAt).getTime()) / 86400000);
                    return (
                      <div key={app.id}
                        onClick={() => router.push("/bundles")}
                        style={{ background: "#f9fafb", borderRadius: 12, padding: "12px", marginBottom: 8, cursor: "pointer", border: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 10 }}>
                        <Gift size={16} color={GREEN} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{app.bundle.name}</div>
                          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: MID }}>Applied {days === 0 ? "today" : `${days} day${days !== 1 ? "s" : ""} ago`}</div>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 20,
                          background: app.status === "APPROVED" ? "#e8f5f1" : app.status === "WAITLISTED" ? "#fff7ed" : "#f3f4f6",
                          color: app.status === "APPROVED" ? GREEN : app.status === "WAITLISTED" ? "#ea580c" : MID,
                        }}>
                          {app.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Items in fulfilment */}
              {data.fulfillmentItems.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 800, color: "var(--ink)", marginBottom: 8 }}>
                    Items in fulfilment
                  </div>
                  {data.fulfillmentItems.map((item) => (
                    <div key={item.id}
                      onClick={() => router.push(`/registers/${item.registerId}`)}
                      style={{ background: "#f9fafb", borderRadius: 12, padding: "12px", marginBottom: 8, cursor: "pointer", border: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 10 }}>
                      <Package size={16} color={GREEN} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{item.name}</div>
                        <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: MID }}>{statusLabel(item.status, item.queueStatus)}</div>
                      </div>
                      <ChevronRight size={14} color="#9ca3af" strokeWidth={1.75} />
                    </div>
                  ))}
                </div>
              )}

              {/* Active pickups */}
              {data.activePickups.length > 0 && (
                <div>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 800, color: "var(--ink)", marginBottom: 8 }}>
                    Active pickups
                  </div>
                  {data.activePickups.map((pickup) => (
                    <div key={pickup.requestId}
                      onClick={() => router.push(`/coordination/${pickup.requestId}`)}
                      style={{ background: "#f9fafb", borderRadius: 12, padding: "12px", marginBottom: 8, cursor: "pointer", border: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 10 }}>
                      <MapPin size={16} color={GREEN} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{pickup.itemTitle}</div>
                        <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: MID }}>
                          With {pickup.donorFirstName} · {coordStatusLabel(pickup.coordinationStatus)}
                        </div>
                      </div>
                      <ChevronRight size={14} color="#9ca3af" strokeWidth={1.75} />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── SECTION 3: Recommended support ──────────────── */}
        <div style={CARD}>
          <div style={SECTION_LABEL}>Recommended for you</div>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: MID, marginBottom: 14 }}>
            Based on your current stage
          </div>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
            {recs.map((rec) => (
              <div key={rec.key} style={{
                minWidth: 180, maxWidth: 200, flexShrink: 0,
                background: "#f9fafb", borderRadius: 14, padding: "14px",
                border: "1px solid #e5e7eb",
              }}>
                <div style={{ fontFamily: "Lora, serif", fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6, lineHeight: 1.3 }}>
                  {rec.label}
                </div>
                <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: MID, marginBottom: 12, lineHeight: 1.4 }}>
                  {rec.description}
                </div>
                <button
                  onClick={() => router.push(rec.href)}
                  style={{
                    padding: "7px 14px", borderRadius: 20, border: "none",
                    background: GREEN, color: "white",
                    fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 800, cursor: "pointer",
                  }}>
                  {rec.actionLabel}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── SECTION 4: Milestones ────────────────────────── */}
        <div style={CARD}>
          <div style={SECTION_LABEL}>Your milestones</div>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: MID, marginBottom: 16 }}>
            Honest progress, one step at a time
          </div>
          <div style={{ position: "relative" }}>
            {/* Vertical line */}
            <div style={{
              position: "absolute", left: 11, top: 8, bottom: 8,
              width: 2, background: "#e5e7eb", borderRadius: 2,
            }} />
            {milestoneList.map((m, i) => (
              <div key={m.key} style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: i < milestoneList.length - 1 ? 16 : 0, position: "relative" }}>
                <div style={{ flexShrink: 0, zIndex: 1 }}>
                  {m.done
                    ? <CheckCircle size={24} color={GREEN} strokeWidth={1.75} fill="#e8f5f1" />
                    : <Circle     size={24} color="#d1d5db" strokeWidth={1.75} />}
                </div>
                <div style={{ flex: 1, paddingTop: 2 }}>
                  <div style={{
                    fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700,
                    color: m.done ? "var(--ink)" : "#9ca3af",
                  }}>
                    {m.label}
                  </div>
                  {m.done ? (
                    <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: MID, marginTop: 2 }}>
                      {m.note}
                    </div>
                  ) : m.nudge ? (
                    <button
                      onClick={() => {
                        const nudgeRoutes: Record<string, string> = {
                          verified: "/profile",
                          circle: "/circles",
                          register: "/registers/new",
                          funded: "/registers",
                          bundle: "/bundles",
                          pickup: "/",
                          community: "/circles",
                        };
                        router.push(nudgeRoutes[m.key] ?? "/");
                      }}
                      style={{ background: "none", border: "none", padding: 0, fontFamily: "Nunito, sans-serif", fontSize: 11, color: GREEN, fontWeight: 700, cursor: "pointer", marginTop: 2, textAlign: "left" }}>
                      {m.nudge}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── SECTION 5: Resources ─────────────────────────── */}
        <div style={CARD}>
          <div style={SECTION_LABEL}>Support resources</div>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: MID, marginBottom: 14 }}>
            Real help, when you need it
          </div>
          {RESOURCES.map((cat) => {
            const isOpen = openResource === cat.key;
            const Icon = cat.icon;
            return (
              <div key={cat.key} style={{ marginBottom: 8, border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                <button
                  onClick={() => setOpenResource(isOpen ? "" : cat.key)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 14px", background: isOpen ? "#f0faf6" : "white",
                    border: "none", cursor: "pointer", textAlign: "left",
                  }}>
                  <Icon size={16} color={GREEN} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                    {cat.title}
                  </span>
                  {isOpen
                    ? <ChevronUp   size={16} color="#9ca3af" strokeWidth={1.75} />
                    : <ChevronDown size={16} color="#9ca3af" strokeWidth={1.75} />}
                </button>
                {isOpen && (
                  <div style={{ padding: "0 14px 12px" }}>
                    {cat.items.map((org) => (
                      <div key={org.name} style={{ paddingTop: 10, borderTop: "1px solid #f0f0f0", marginTop: 8 }}>
                        <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                          {org.name}
                        </div>
                        {org.phone && (
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: org.url ? 2 : 0 }}>
                            <Phone size={11} color={MID} strokeWidth={1.75} />
                            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: MID }}>{org.phone}</span>
                          </div>
                        )}
                        {org.url && (
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <ExternalLink size={11} color={GREEN} strokeWidth={1.75} />
                            <a href={org.url} target="_blank" rel="noopener noreferrer"
                              style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: GREEN, textDecoration: "none" }}>
                              {org.url.replace("https://", "").replace("www.", "")}
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 10, color: "#9ca3af", marginTop: 10, lineHeight: 1.5 }}>
            These are external resources. Kradəl is not affiliated with any of these organizations.
          </div>
        </div>

        {/* ── SECTION 6: Upcoming opportunities ───────────── */}
        {(data.bundleSlots.length > 0) && (
          <div style={CARD}>
            <div style={SECTION_LABEL}>Coming up</div>
            <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: MID, marginBottom: 14 }}>
              Don&apos;t miss these
            </div>
            {data.bundleSlots.map((slot) => (
              <div key={slot.code}
                onClick={() => router.push("/bundles")}
                style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12 }}>
                <Gift size={18} color={GREEN} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{slot.name}</div>
                  {slot.slotsRemaining > 0 ? (
                    <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: GREEN, fontWeight: 700, marginTop: 2 }}>
                      {slot.slotsRemaining} slot{slot.slotsRemaining !== 1 ? "s" : ""} remaining this month
                    </div>
                  ) : (
                    <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                      Full this month — check back next month
                    </div>
                  )}
                </div>
                <ChevronRight size={14} color="#9ca3af" strokeWidth={1.75} />
              </div>
            ))}
            {data.bundleSlots.length === 0 && (
              <div
                onClick={() => router.push("/bundles")}
                style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 14px", cursor: "pointer", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12 }}>
                <Gift size={18} color={GREEN} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: MID }}>
                  Check /bundles for available programmes
                </div>
                <ChevronRight size={14} color="#9ca3af" strokeWidth={1.75} />
              </div>
            )}
          </div>
        )}

        {/* ── SECTION 7: Safety & privacy controls ─────────── */}
        <div style={CARD}>
          <div style={SECTION_LABEL}>Your safety & privacy</div>
          <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: MID, marginBottom: 14 }}>
            You&apos;re in control
          </div>
          {[
            { label: "Manage delivery address",     href: "/profile" },
            { label: "Profile visibility",           href: "/profile" },
            { label: "Notification preferences",     href: "/profile/notifications" },
            { label: "Delete uploaded documents",    href: "/profile" },
            { label: "Trusted pickup contact",       href: "/profile" },
          ].map(({ label, href }) => (
            <button
              key={label}
              onClick={() => router.push(href)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12,
                padding: "13px 0", background: "none", border: "none",
                borderBottom: "1px solid #f0f0f0", cursor: "pointer", textAlign: "left",
              }}>
              <Lock size={16} color={GREEN} strokeWidth={1.75} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontFamily: "Nunito, sans-serif", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                {label}
              </span>
              <ChevronRight size={16} color="#9ca3af" strokeWidth={1.75} />
            </button>
          ))}
          <div style={{ marginTop: 14, fontFamily: "Nunito, sans-serif", fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>
            Your personal information is never shared with donors or the public.{" "}
            <span
              onClick={() => router.push("/privacy")}
              style={{ color: GREEN, fontWeight: 700, cursor: "pointer" }}>
              Read our Privacy Policy →
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
