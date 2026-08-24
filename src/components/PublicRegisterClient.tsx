"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle, Loader2, Square, SquareDot, ChevronRight, Users,
  BadgeCheck, MapPin, HandHeart, Heart, ShieldCheck, ImageOff, Share2, Check,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { PublicRegister, PublicRegisterItem } from "@/lib/registers";

function fmtMoney(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function getStageLine(dueDate: string) {
  const due = new Date(dueDate);
  const now = new Date();
  const diffDays = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 0) {
    const weeks = Math.round(diffDays / 7);
    return weeks <= 1 ? "Due this week" : `Due in ${weeks} weeks`;
  }
  const weeksOld = Math.abs(Math.round(diffDays / 7));
  return `Newborn · ${weeksOld} weeks old`;
}

function getWhyItMatters(category: string, name: string): string {
  const cat = category.toLowerCase();
  const n = name.toLowerCase();
  if (cat.includes("diaper") || n.includes("diaper")) return "Newborns go through 8 to 12 diapers a day. This is one of the most urgent needs.";
  if (cat.includes("feeding") || n.includes("formula") || n.includes("breast")) return "Reliable feeding equipment is essential for a healthy start.";
  if (cat.includes("sleep") || n.includes("crib") || n.includes("bassinet") || n.includes("mattress")) return "Safe sleep is critical for newborns. This protects baby every night.";
  if (cat.includes("clothing") || n.includes("outfit") || n.includes("clothing")) return "Babies grow fast and need warm, comfortable layers from day one.";
  if (cat.includes("bath") || n.includes("bath")) return "A safe bath setup makes hygiene routines easier.";
  if (cat.includes("health") || n.includes("thermometer")) return "Health essentials on hand give peace of mind.";
  if (cat.includes("carrier") || n.includes("carrier") || n.includes("stroller") || n.includes("pram")) return "Mobility matters. This keeps baby close while moving around.";
  return "Every item here was chosen because it makes a real difference in the first weeks.";
}

const CATEGORY_ORDER = ["Feeding", "Sleep", "Diapers & Hygiene", "Clothing", "Health", "Mobility", "Other"];

function groupByCategory(items: PublicRegisterItem[]): [string, PublicRegisterItem[]][] {
  const map = new Map<string, PublicRegisterItem[]>();
  for (const item of items) {
    const cat = item.category || "Other";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(item);
  }
  const ordered: [string, PublicRegisterItem[]][] = [];
  for (const cat of CATEGORY_ORDER) {
    if (map.has(cat)) { ordered.push([cat, map.get(cat)!]); map.delete(cat); }
  }
  for (const [cat, items] of map) ordered.push([cat, items]);
  return ordered;
}

function ItemStateIcon({ status }: { status: string }) {
  if (status === "FULFILLED") return <CheckCircle size={18} color="#1a7a5e" strokeWidth={2} />;
  if (status === "IN_FULFILLMENT" || status === "FULLY_FUNDED") return <Loader2 size={18} color="#d97706" strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} />;
  if (status === "PARTIAL") return <SquareDot size={18} color="#1a7a5e" strokeWidth={2} />;
  return <Square size={18} color="#9ca3af" strokeWidth={1.5} />;
}

export default function PublicRegisterClient({
  register,
  appUrl,
}: {
  register: PublicRegister;
  appUrl: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const firstName  = register.firstName;
  const isVerified = register.verificationLevel >= 2;
  const isClosed   = register.status === "CLOSED";
  const isCompleted = register.status === "COMPLETED";
  const stageLine  = getStageLine(register.dueDate);

  const totalFunded = useMemo(() => register.items.reduce((s, i) => s + i.totalFundedCents, 0), [register.items]);
  const totalNeeded = useMemo(() => register.items.reduce((s, i) => s + i.standardPriceCents, 0), [register.items]);
  const fulfilledCount = register.items.filter((i) => i.fundingStatus === "FULFILLED").length;
  const totalItems  = register.items.length;
  const totalDonors = register.items.reduce((s, i) => s + i.contributorCount, 0);
  const pct = totalNeeded > 0 ? Math.min(1, totalFunded / totalNeeded) : 0;
  const isFullyFunded = totalNeeded > 0 && totalFunded >= totalNeeded;

  const groupedItems = groupByCategory(register.items);

  const shareUrl = `${appUrl}/r/${register.id}`;

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/r/${register.id}` : shareUrl;
    const shareData = {
      title: `${firstName}'s Register on Kradel`,
      text: `Help provide real essentials for ${firstName}'s baby. Every item is a genuine need.`,
      url,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share(shareData); return; } catch { /* user dismissed — fall through to copy */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch { /* clipboard unavailable */ }
  };

  const goFund = (itemId: string) => {
    const target = `/registers/${register.id}?item=${itemId}`;
    if (user) router.push(target);
    else router.push(`/auth?redirect=${encodeURIComponent(target)}`);
  };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="discover-desktop">

        {/* ── Header ─────────────────────────────── */}
        <div style={{ background: "#e8f5f1", padding: "16px 16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: "#1a3a2e" }}>Kradəl</div>
            <button
              onClick={handleShare}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--white)", border: "1.5px solid #1a7a5e", color: "#1a7a5e", borderRadius: 20, padding: "7px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif", flexShrink: 0 }}
            >
              {copied ? <><Check size={13} strokeWidth={2.5} /> Link copied</> : <><Share2 size={13} strokeWidth={2.25} /> Share</>}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, marginBottom: 6 }}>
            {isVerified && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: "#1a7a5e", background: "rgba(26,122,94,0.12)", padding: "3px 8px", borderRadius: 20 }}>
                <BadgeCheck size={11} strokeWidth={2.5} /> Verified mother
              </span>
            )}
            {(isCompleted || isFullyFunded) && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#1a7a5e", background: "rgba(26,122,94,0.12)", padding: "3px 10px", borderRadius: 20 }}>Fully funded ✓</span>
            )}
            {isClosed && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#c0392b", background: "rgba(192,57,43,0.1)", padding: "3px 10px", borderRadius: 20 }}>Closed</span>
            )}
          </div>

          <div style={{ fontFamily: "Lora, serif", fontSize: 22, fontWeight: 700, color: "#1a3a2e", marginBottom: 4 }}>
            {firstName}&apos;s Register
          </div>
          <div style={{ fontSize: 12, color: "#3d7a62", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <MapPin size={11} />
            {register.city}
            <span style={{ opacity: 0.5 }}>·</span>
            {stageLine}
          </div>
        </div>

        {/* ── Emotional context ─────────────── */}
        <div style={{ margin: "16px 16px 0", background: "var(--white)", borderRadius: 12, borderLeft: "3px solid #1a7a5e", padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <HandHeart size={18} color="#1a7a5e" strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", color: "var(--ink)", marginBottom: 4 }}>
              {firstName} is preparing for her baby
            </div>
            <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {register.intro?.trim()
                ? register.intro
                : `Every item on this register is something ${firstName} has identified as a real need: a preparation list for her baby's first weeks, not a wish list. Your contribution goes directly toward purchasing and delivering these items to her.`}
            </div>
          </div>
        </div>

        {/* ── Progress ────────────────────────── */}
        {totalItems > 0 && totalNeeded > 0 && (
          <div style={{ margin: "16px 16px 0", background: "var(--white)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "Nunito, sans-serif", color: "var(--ink)" }}>
                {isFullyFunded ? "Fully funded" : `${fmtMoney(totalFunded)} raised`}
              </span>
              <span style={{ fontSize: 12, color: "var(--mid)", fontWeight: 600, fontFamily: "Nunito, sans-serif" }}>of {fmtMoney(totalNeeded)} total</span>
            </div>
            <div style={{ height: 12, borderRadius: 8, background: "#e5e7eb", overflow: "hidden", marginBottom: 10 }}>
              <div style={{ width: `${pct * 100}%`, height: "100%", background: isFullyFunded ? "#1a7a5e" : "linear-gradient(90deg, #1a7a5e 0%, #2ea87a 100%)", borderRadius: 8, transition: "width 0.4s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--mid)", fontWeight: 600, fontFamily: "Nunito, sans-serif" }}>
              <span>{fulfilledCount} of {totalItems} needs completed</span>
              {totalDonors > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#1a7a5e" }}>
                  <Users size={11} />{totalDonors} contributor{totalDonors !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Items ───────────────────────────── */}
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, marginBottom: 14 }}>What she needs</div>

          {register.items.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🛍️</div>
              <div className="empty-title">No items listed yet</div>
            </div>
          ) : (
            groupedItems.map(([category, items]) => (
              <div key={category} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid var(--border)" }}>
                  {category}
                </div>
                {items.map((item) => {
                  const isFulfilled     = item.fundingStatus === "FULFILLED";
                  const isInFulfillment = item.fundingStatus === "IN_FULFILLMENT" || item.fundingStatus === "FULLY_FUNDED";
                  const canFundThis     = ["UNFUNDED", "PARTIAL"].includes(item.fundingStatus) && !isClosed;
                  const itemPct         = item.standardPriceCents > 0 ? Math.min(100, (item.totalFundedCents / item.standardPriceCents) * 100) : 0;

                  return (
                    <div
                      key={item.id}
                      onClick={() => canFundThis && goFund(item.id)}
                      style={{ background: "var(--white)", borderRadius: 12, border: `1.5px solid ${isFulfilled ? "#c6e9de" : "var(--border)"}`, padding: "14px", marginBottom: 8, cursor: canFundThis ? "pointer" : "default", opacity: isFulfilled ? 0.75 : 1 }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ position: "relative", width: 48, height: 48, flexShrink: 0 }}>
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: "1px solid #e0e0e0" }} />
                          ) : (
                            <div style={{ width: 48, height: 48, borderRadius: 8, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <ImageOff size={24} color="#9ca3af" strokeWidth={1.75} />
                            </div>
                          )}
                          <div style={{ position: "absolute", bottom: -4, right: -4, background: "white", borderRadius: "50%", padding: 2, boxShadow: "0 1px 3px rgba(0,0,0,0.15)", lineHeight: 0 }}>
                            <ItemStateIcon status={item.fundingStatus} />
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, textDecoration: isFulfilled ? "line-through" : "none", color: isFulfilled ? "var(--mid)" : "var(--ink)", fontFamily: "Nunito, sans-serif" }}>
                              {item.name}
                              {item.quantity && item.quantity !== "1" && (
                                <span style={{ fontWeight: 600, color: "var(--mid)", marginLeft: 4 }}>× {item.quantity}</span>
                              )}
                            </div>
                            {canFundThis && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 800, color: "#1a7a5e", border: "1.5px solid #1a7a5e", borderRadius: 20, padding: "3px 10px", flexShrink: 0, fontFamily: "Nunito, sans-serif" }}>
                                Help provide this
                              </span>
                            )}
                          </div>

                          {!isFulfilled && (
                            <div style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif", marginTop: 3, lineHeight: 1.5 }}>
                              {getWhyItMatters(item.category, item.name)}
                            </div>
                          )}

                          {item.standardPriceCents > 0 && !isFulfilled && (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ height: 4, borderRadius: 4, background: "#e5e7eb", overflow: "hidden" }}>
                                <div style={{ width: `${itemPct}%`, height: "100%", background: "#1a7a5e", borderRadius: 4, transition: "width 0.4s" }} />
                              </div>
                              <div style={{ fontSize: 11, color: "var(--mid)", fontWeight: 600, marginTop: 3, fontFamily: "Nunito, sans-serif" }}>
                                {item.fundingStatus === "PARTIAL"
                                  ? `${fmtMoney(item.totalFundedCents)} of ${fmtMoney(item.standardPriceCents)}`
                                  : fmtMoney(item.standardPriceCents)}
                                {isInFulfillment && " · Being fulfilled"}
                                {item.contributorCount > 0 && ` · ${item.contributorCount} contributor${item.contributorCount !== 1 ? "s" : ""}`}
                              </div>
                            </div>
                          )}

                          {isFulfilled && (
                            <div style={{ fontSize: 11, color: "#1a7a5e", fontWeight: 600, fontFamily: "Nunito, sans-serif", marginTop: 3 }}>
                              Delivered to {firstName}
                            </div>
                          )}
                        </div>
                        {canFundThis && <ChevronRight size={14} color="var(--light)" style={{ flexShrink: 0, marginTop: 2 }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* ── How Kradel works + trust ───────────── */}
        <div style={{ margin: "8px 16px 0", background: "var(--white)", borderRadius: 12, padding: "16px" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 15, fontWeight: 700, marginBottom: 10, color: "#1a3a2e" }}>How Kradel works</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              "A frontline partner refers a mother and verifies her need.",
              "She privately lists the specific items she needs for her baby.",
              "You fund an item. Kradel purchases it and delivers it to her door.",
            ].map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", background: "#e8f5f1", color: "#1a7a5e", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Nunito, sans-serif" }}>{i + 1}</div>
                <div style={{ fontSize: 12, color: "var(--mid)", fontFamily: "Nunito, sans-serif", lineHeight: 1.5 }}>{line}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            <ShieldCheck size={14} color="#1a7a5e" strokeWidth={1.75} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "var(--mid)", fontFamily: "Nunito, sans-serif" }}>
              {firstName}&apos;s address and contact details are kept private. Kradel handles delivery directly.
            </span>
          </div>
        </div>

        {/* ── Closing strip ───────────────────────── */}
        <div style={{ margin: "16px 16px 60px", padding: "16px", background: "#e8f5f1", borderRadius: 12, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Heart size={16} color="#1a7a5e" strokeWidth={1.75} />
            <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 14, fontWeight: 600, color: "#1a7a5e" }}>Every contribution makes a real difference.</span>
          </div>
          <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: "#555555" }}>Thank you for helping mothers feel supported, not alone.</span>
        </div>
      </div>
    </div>
  );
}
