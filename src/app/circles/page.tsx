"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Users } from "lucide-react";
import BottomNav from "@/components/BottomNav";

// ── Location detection helpers (for country circle auto-join) ──────────────────

async function fetchCountryCircle(): Promise<{ circle: { id: string } } | null> {
  const res = await fetch("/api/circles/my", { cache: "no-store" });
  const d   = await res.json();
  return d.circle ? { circle: d.circle } : null;
}

async function joinViaLocation(location: string): Promise<{ circle: { id: string } } | null> {
  await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location }),
  });
  return fetchCountryCircle();
}

async function detectLocationViaIP(): Promise<{ location: string; countryCode: string } | null> {
  try {
    const res  = await fetch("https://ipapi.co/json/", { cache: "no-store" });
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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CirclesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loadingData,  setLoadingData]  = useState(true);
  const [geoDetecting, setGeoDetecting] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;

    if (user.journeyType === "donor") { router.replace("/"); return; }

    // Member with a stage circle — redirect directly (ID is on the auth user object)
    if (user.currentCircleId) {
      router.replace(`/circles/${user.currentCircleId}`);
      return;
    }

    // No stage circle — detect/join country circle, then redirect to it
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
        fetch("/api/circles/my", { method: "PATCH" }).catch(() => {});
        router.replace(`/circles/${result.circle.id}`);
        return;
      }
      // Truly no circle — show the "complete profile" prompt
      setLoadingData(false);
    })();
  }, [user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading / spinner ──────────────────────────────────────────────────────

  if (authLoading || loadingData || geoDetecting) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ background: "#1a7a5e", padding: "20px 16px 16px" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: "white" }}>Circles</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", gap: 14 }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
            {geoDetecting ? "Finding your circle…" : "Loading…"}
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

  // ── No circle found — prompt user to complete their profile ────────────────

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 80 }}>
      <div style={{ background: "#1a7a5e", padding: "20px 16px 16px" }}>
        <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: "white", marginBottom: 2 }}>
          Circles
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
          Connect with mothers at your stage
        </div>
      </div>

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

      <BottomNav />
    </div>
  );
}
