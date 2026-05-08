"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { STAGE_META, StageKey } from "@/lib/stage";
import {
  HeartPulse, Heart, Smile, Star, Users, ChevronRight,
  type LucideIcon,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";

const STAGE_ICONS: Record<string, LucideIcon> = {
  "pregnancy-0-3":    HeartPulse,
  "pregnancy-4-6":    HeartPulse,
  "pregnancy-7-9":    HeartPulse,
  "postpartum-0-3":   Heart,
  "postpartum-4-6":   Smile,
  "postpartum-7-12":  Smile,
  "postpartum-13-24": Star,
};

const STAGE_COLORS: Record<string, { bg: string; color: string }> = {
  "pregnancy-0-3":    { bg: "#d4edda", color: "#1a7a5e" },
  "pregnancy-4-6":    { bg: "#d4edda", color: "#1a7a5e" },
  "pregnancy-7-9":    { bg: "#c3e6cb", color: "#155724" },
  "postpartum-0-3":   { bg: "#f8d7da", color: "#9d174d" },
  "postpartum-4-6":   { bg: "#f8d7da", color: "#9d174d" },
  "postpartum-7-12":  { bg: "#fff3cd", color: "#b45309" },
  "postpartum-13-24": { bg: "#d1ecf1", color: "#1e50a2" },
};

interface StageCircle {
  id: string;
  name: string;
  emoji: string | null;
  stageKey: string;
  groupLetter: string | null;
  memberCount: number;
  postCount: number;
  isPrimary: boolean;
  isGraduated: boolean;
  accessType: string | null;
}

interface CountryCircle {
  id: string;
  name: string;
  country: string;
  _count: { members: number; posts: number };
}

async function fetchCountryCircle(): Promise<{ circle: CountryCircle; member: { joinedAt: string } } | null> {
  const res = await fetch("/api/circles/my", { cache: "no-store" });
  const d = await res.json();
  return d.circle ? { circle: d.circle, member: d.member } : null;
}

async function joinViaLocation(location: string): Promise<{ circle: CountryCircle; member: { joinedAt: string } } | null> {
  await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location }),
  });
  return fetchCountryCircle();
}

async function detectLocationViaIP(): Promise<{ location: string; countryCode: string } | null> {
  try {
    const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    const data = await res.json();
    const city    = data.city         as string | undefined;
    const country = data.country_name as string | undefined;
    const code    = data.country_code as string | undefined;
    if (!country || !code) return null;
    return { location: city ? `${city}, ${country}` : country, countryCode: code };
  } catch {
    return null;
  }
}

export default function CirclesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [circles,      setCircles]      = useState<StageCircle[]>([]);
  const [countryCircle, setCountryCircle] = useState<CountryCircle | null>(null);
  const [loadingData,  setLoadingData]  = useState(true);
  const [geoDetecting, setGeoDetecting] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;

    if (user.journeyType === "donor") { router.replace("/"); return; }

    if (user.currentCircleId) {
      fetch("/api/circles/stages", { cache: "no-store" })
        .then(r => r.json())
        .then(d => { setCircles(d.circles ?? []); setLoadingData(false); });
    } else {
      (async () => {
        let result = await fetchCountryCircle();
        if (!result && user.location) {
          setGeoDetecting(true);
          result = await joinViaLocation(user.location);
          setGeoDetecting(false);
        }
        if (!result) {
          setGeoDetecting(true);
          const detected = await detectLocationViaIP();
          if (detected) {
            fetch("/api/profile", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ location: detected.location, countryCode: detected.countryCode }),
            }).catch(() => {});
            result = await joinViaLocation(detected.location);
          }
          setGeoDetecting(false);
        }
        if (result) {
          setCountryCircle(result.circle);
          fetch("/api/circles/my", { method: "PATCH" }).catch(() => {});
        }
        setLoadingData(false);
      })();
    }
  }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (authLoading || loadingData || geoDetecting) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ background: "#1a7a5e", padding: "20px 16px 16px" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: "white" }}>Circles</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", gap: 14 }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
            {geoDetecting ? "Finding your circle…" : "Loading circles…"}
          </div>
          <div className="spinner" />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>Join the Circle</div>
        <p style={{ color: "var(--mid)", fontSize: 14, marginBottom: 24, lineHeight: 1.6, textAlign: "center", maxWidth: 300 }}>
          Sign in to connect with mothers at your stage of the journey.
        </p>
        <button className="btn-primary" onClick={() => router.push("/auth")}>Sign in to join</button>
      </div>
    );
  }

  const hasNoCircles = circles.length === 0 && !countryCircle;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
      <style>{`
        .circle-row {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px; border-radius: 16px;
          border: 2px solid var(--border); background: var(--white);
          box-shadow: var(--shadow); cursor: default;
        }
        .circle-row.primary {
          border-color: #1a7a5e; background: #f0faf7;
        }
      `}</style>

      {/* Header */}
      <div style={{ background: "#1a7a5e", padding: "20px 16px 16px" }}>
        <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: "white", marginBottom: 2 }}>
          Circles
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
          Connect with mothers at your stage
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {hasNoCircles ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20, background: "#e8f5f1",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <Users size={28} color="#1a7a5e" strokeWidth={1.75} />
            </div>
            <div style={{ fontFamily: "Lora, serif", fontSize: 18, fontWeight: 700, marginBottom: 10, color: "var(--ink)" }}>
              Find your stage circle
            </div>
            <p style={{ color: "var(--mid)", fontSize: 13, lineHeight: 1.6, marginBottom: 24, maxWidth: 300, margin: "0 auto 24px" }}>
              Complete your profile to be placed with mothers at exactly your stage of pregnancy or parenthood.
            </p>
            <button className="btn-primary" onClick={() => router.push("/profile")}>Complete profile</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Stage circles */}
            {circles.map((circle) => {
              const meta  = STAGE_META[circle.stageKey as StageKey];
              const theme = STAGE_COLORS[circle.stageKey] ?? { bg: "#f0f4f2", color: "#1a7a5e" };
              const Icon  = STAGE_ICONS[circle.stageKey] ?? Heart;

              return (
                <div key={circle.id} className={`circle-row${circle.isPrimary ? " primary" : ""}`}>
                  {/* Stage icon */}
                  <div style={{
                    width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                    background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={22} strokeWidth={1.75} color={theme.color} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                      <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                        {meta?.label ?? circle.name}
                      </div>
                      {circle.isPrimary && (
                        <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "#1a7a5e", color: "white", fontFamily: "Nunito, sans-serif" }}>
                          Your Circle
                        </span>
                      )}
                      {circle.isGraduated && !circle.isPrimary && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "#f3f4f6", color: "#6b7280", fontFamily: "Nunito, sans-serif" }}>
                          Previously here
                        </span>
                      )}
                    </div>
                    {meta?.description && (
                      <div style={{ fontSize: 11, color: "var(--mid)", lineHeight: 1.4, marginBottom: 3 }}>
                        {meta.description}
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--mid)" }}>
                      <Users size={11} strokeWidth={1.75} />
                      {circle.memberCount.toLocaleString()} members
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => router.push(`/circles/${circle.id}`)}
                    style={{
                      flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
                      padding: "8px 14px", borderRadius: 20, fontSize: 12, fontWeight: 800,
                      fontFamily: "Nunito, sans-serif", cursor: "pointer",
                      border: circle.isPrimary ? "none" : "1.5px solid var(--border)",
                      background: circle.isPrimary ? "#1a7a5e" : "var(--white)",
                      color: circle.isPrimary ? "white" : "var(--ink)",
                    }}
                  >
                    {circle.isPrimary ? "Open" : "Visit"}
                    <ChevronRight size={13} strokeWidth={2.5} />
                  </button>
                </div>
              );
            })}

            {/* Country circle fallback */}
            {countryCircle && (
              <div className="circle-row primary">
                <div style={{
                  width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                  background: "#d4edda", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Users size={22} strokeWidth={1.75} color="#1a7a5e" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <div style={{ fontFamily: "Lora, serif", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                      {countryCircle.name}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "#1a7a5e", color: "white", fontFamily: "Nunito, sans-serif" }}>
                      Your Circle
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--mid)", marginBottom: 3 }}>Country-wide support circle</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--mid)" }}>
                    <Users size={11} strokeWidth={1.75} />
                    {countryCircle._count.members.toLocaleString()} members
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/circles/${countryCircle.id}`)}
                  style={{
                    flexShrink: 0, display: "flex", alignItems: "center", gap: 4,
                    padding: "8px 14px", borderRadius: 20, border: "none",
                    background: "#1a7a5e", color: "white",
                    fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "Nunito, sans-serif",
                  }}
                >
                  Open
                  <ChevronRight size={13} strokeWidth={2.5} />
                </button>
              </div>
            )}

          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
