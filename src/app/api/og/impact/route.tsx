import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getImpactStats } from "@/lib/impact";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const name = searchParams.get("name") ?? "A Kradel Donor";

  let donations = 0, families = 0, babiesFed = 0;
  let rankLabel = "New Giver", rankEmoji = "🌱";

  if (userId) {
    try {
      const stats = await getImpactStats(userId);
      donations = stats.donations;
      families = stats.families;
      babiesFed = stats.babiesFed;
      rankLabel = stats.rank.label;
      rankEmoji = stats.rank.emoji;
    } catch {
      // fall through to defaults
    }
  }

  const firstName = name.split(" ")[0];

  // Headline copy varies by milestone
  const headline =
    donations === 0 ? "Just joined Kradel 💛" :
    donations === 1 ? "Made their first donation!" :
    families === 1 ? `Helped 1 family in need` :
    `Helped ${families} families`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(145deg, #0d3d2e 0%, #1a5c45 45%, #0a2e22 100%)",
          padding: "60px 64px",
          position: "relative",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Decorative circles */}
        <div style={{
          position: "absolute", top: -80, right: -80,
          width: 340, height: 340, borderRadius: "50%",
          background: "rgba(126,200,164,0.08)", display: "flex",
        }} />
        <div style={{
          position: "absolute", bottom: -60, left: -60,
          width: 260, height: 260, borderRadius: "50%",
          background: "rgba(126,200,164,0.06)", display: "flex",
        }} />

        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              background: "rgba(126,200,164,0.15)",
              border: "1.5px solid rgba(126,200,164,0.3)",
              borderRadius: 12,
              padding: "8px 18px",
              color: "#7ec8a4",
              fontSize: 22,
              fontWeight: 700,
              display: "flex",
            }}>
              Kradel
            </div>
          </div>
          <div style={{
            background: "rgba(255,255,255,0.08)",
            borderRadius: 20,
            padding: "6px 18px",
            color: "rgba(255,255,255,0.5)",
            fontSize: 18,
            display: "flex",
          }}>
            Impact Story
          </div>
        </div>

        {/* Center — main content */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 0,
        }}>
          {/* Rank badge */}
          <div style={{
            background: "rgba(126,200,164,0.12)",
            border: "1.5px solid rgba(126,200,164,0.25)",
            borderRadius: 50,
            padding: "10px 28px",
            marginBottom: 28,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span style={{ fontSize: 22 }}>{rankEmoji}</span>
            <span style={{ color: "#7ec8a4", fontSize: 20, fontWeight: 700 }}>{rankLabel}</span>
          </div>

          {/* Donor name */}
          <div style={{
            color: "rgba(255,255,255,0.7)",
            fontSize: 36,
            fontWeight: 600,
            letterSpacing: 1,
            marginBottom: 8,
            display: "flex",
          }}>
            {firstName}
          </div>

          {/* Headline */}
          <div style={{
            color: "#fff",
            fontSize: families > 0 ? 70 : 52,
            fontWeight: 900,
            textAlign: "center",
            lineHeight: 1.05,
            marginBottom: 12,
            display: "flex",
          }}>
            {headline}
          </div>

          {/* Stats row */}
          {donations > 0 && (
            <div style={{
              display: "flex",
              gap: 32,
              marginTop: 24,
            }}>
              {[
                { value: String(donations), label: "donations" },
                { value: String(families), label: "families helped" },
                { value: String(babiesFed), label: "babies nourished" },
              ].map(({ value, label }) => (
                <div key={label} style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 16,
                  padding: "18px 28px",
                  minWidth: 140,
                }}>
                  <div style={{ color: "#7ec8a4", fontSize: 44, fontWeight: 900, lineHeight: 1, display: "flex" }}>
                    {value}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 16, marginTop: 4, display: "flex" }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Zero-state message */}
          {donations === 0 && (
            <div style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 24,
              marginTop: 16,
              display: "flex",
            }}>
              Every journey starts with one donation.
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 18, display: "flex" }}>
            Helping mothers & babies across communities
          </div>
          <div style={{ color: "#7ec8a4", fontSize: 20, fontWeight: 700, display: "flex" }}>
            kradel.app
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
    }
  );
}
