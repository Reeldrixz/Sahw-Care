"use client";

import { useEffect, useState } from "react";

const GREEN = "#1a7a5e";
const INK = "#1f2a24";
const MUTED = "#5a6b62";
const SERIF = "Lora, Georgia, serif";
const SANS = "Nunito, sans-serif";

interface Data {
  linkVisits: number;
  membersJoined: number;
  contributions: number;
  mothersSupported: number;
}

// Private to the creator. Credits the AWARENESS they drove. Never claims the
// creator personally delivered care to any mother.
export default function CreatorDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/creators/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  const d = data ?? { linkVisits: 0, membersJoined: 0, contributions: 0, mothersSupported: 0 };

  const stat = (value: number, label: string) => (
    <div style={{ background: "#fff", border: "1px solid #ece4d3", borderRadius: 14, padding: "16px 14px", textAlign: "center" }}>
      <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, color: GREEN, lineHeight: 1 }}>{value.toLocaleString()}</div>
      <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: MUTED, marginTop: 6, lineHeight: 1.4 }}>{label}</div>
    </div>
  );

  return (
    <div>
      <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: INK, marginBottom: 4 }}>
        Your Impact Creator dashboard
      </div>
      <p style={{ fontFamily: SANS, fontSize: 14, color: INK, lineHeight: 1.6, margin: "0 0 16px" }}>
        Your sharing contributed to this mission&rsquo;s impact.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {stat(d.linkVisits, "link visits")}
        {stat(d.membersJoined, "people joined through your referral")}
      </div>

      <p style={{ fontFamily: SANS, fontSize: 14, color: INK, lineHeight: 1.65, margin: "0 0 6px" }}>
        Through your referral, <strong>{d.membersJoined.toLocaleString()}</strong> {d.membersJoined === 1 ? "person" : "people"} joined the mission.
      </p>
      <p style={{ fontFamily: SANS, fontSize: 14, color: INK, lineHeight: 1.65, margin: "0 0 6px" }}>
        <strong>{d.contributions.toLocaleString()}</strong> {d.contributions === 1 ? "contribution" : "contributions"} made by people you brought in.
      </p>
      <p style={{ fontFamily: SANS, fontSize: 14, color: INK, lineHeight: 1.65, margin: "0 0 16px" }}>
        Together, the people you brought in have helped provide maternity essentials to <strong>{d.mothersSupported.toLocaleString()}</strong> {d.mothersSupported === 1 ? "mother" : "mothers"} this month.
      </p>
    </div>
  );
}
