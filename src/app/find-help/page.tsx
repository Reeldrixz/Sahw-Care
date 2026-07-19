import Link from "next/link";
import type { Metadata } from "next";
import { partnersByCity, type ReferralPartner } from "@/lib/partners";

const CREAM = "#faf6ee";
const CREAM_DEEP = "#f3ecdd";
const INK = "#1f2a24";
const GREEN = "#1a7a5e";
const GREEN_SOFT = "#e8f5f1";
const MUTED = "#5a6b62";
const SERIF = "Lora, Georgia, serif";
const SANS = "Nunito, sans-serif";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://sahw-care.vercel.app";

export const metadata: Metadata = {
  title: "Find help · Kradəl",
  description:
    "A friend thought Kradəl could help. Here are the community partners who can connect a mother to support for her baby.",
  alternates: { canonical: `${APP_URL}/find-help` },
  openGraph: {
    title: "Find help · Kradəl",
    description: "Community partners who connect mothers to Kradəl support.",
    url: `${APP_URL}/find-help`,
    siteName: "Kradəl",
    type: "website",
  },
};

const STEPS = [
  "A community partner gets to know you and confirms how Kradəl can help.",
  "With their support, you privately list the specific items you need for your baby.",
  "Neighbours fund those items, and they're delivered directly to you.",
];

function PartnerCard({ p }: { p: ReferralPartner }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #ece4d3",
        borderRadius: 18,
        padding: "24px 22px",
        flex: "1 1 320px",
        maxWidth: 460,
      }}
    >
      <h3 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, margin: "0 0 10px", color: INK }}>
        {p.orgName}
      </h3>
      <p style={{ fontFamily: SANS, fontSize: 14.5, lineHeight: 1.6, color: MUTED, margin: "0 0 14px" }}>
        {p.whatTheyDo}
      </p>
      <p style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.6, color: INK, margin: "0 0 16px" }}>
        {p.howToReach}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {p.phone && (
          <a href={`tel:${p.phone}`} style={{ fontFamily: SANS, fontSize: 14, fontWeight: 800, color: GREEN, textDecoration: "none" }}>
            Call {p.phone}
          </a>
        )}
        {p.email && (
          <a href={`mailto:${p.email}`} style={{ fontFamily: SANS, fontSize: 14, fontWeight: 800, color: GREEN, textDecoration: "none" }}>
            Email {p.email}
          </a>
        )}
        {p.website && (
          <a href={p.website} target="_blank" rel="noopener noreferrer" style={{ fontFamily: SANS, fontSize: 14, fontWeight: 800, color: GREEN, textDecoration: "none" }}>
            Visit website
          </a>
        )}
      </div>
    </div>
  );
}

export default async function FindHelpPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const grouped = partnersByCity();
  const { from } = await searchParams;
  const fromOnboarding = from === "onboarding";

  return (
    <main style={{ background: CREAM, color: INK, minHeight: "100vh", fontFamily: SANS }}>
      {/* ── Top bar ─────────────────────────────────────── */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", maxWidth: 1040, margin: "0 auto" }}>
        <Link href="/" style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, textDecoration: "none" }}>
          Kradəl
        </Link>
      </header>

      {/* ── Hero ────────────────────────────────────────── */}
      <section style={{ maxWidth: 720, margin: "0 auto", padding: "40px 22px 28px", textAlign: "center" }}>
        <span
          style={{
            display: "inline-block",
            fontFamily: SANS,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: GREEN,
            background: GREEN_SOFT,
            padding: "6px 14px",
            borderRadius: 20,
            marginBottom: 20,
          }}
        >
          {fromOnboarding ? "You're in the right place" : "A friend thought Kradəl could help"}
        </span>
        <h1 style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 700, lineHeight: 1.2, margin: "0 0 16px", color: INK }}>
          Here&apos;s how to get connected
        </h1>
        {fromOnboarding && (
          <p style={{ fontFamily: SANS, fontSize: 16.5, lineHeight: 1.65, color: GREEN, fontWeight: 700, margin: "0 auto 16px", maxWidth: 560 }}>
            Support for you and your baby starts with a caring introduction from a partner near you. Here&apos;s your next step.
          </p>
        )}
        <p style={{ fontFamily: SANS, fontSize: 16.5, lineHeight: 1.65, color: MUTED, margin: "0 auto", maxWidth: 560 }}>
          Kradəl helps mothers get the specific things they need for their baby, funded by neighbours and
          delivered with dignity. Mothers join through a trusted community partner who offers a warm,
          private introduction. Below are the partners you can reach out to.
        </p>
      </section>

      {/* ── How it works ────────────────────────────────── */}
      <section style={{ background: CREAM_DEEP, padding: "44px 22px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 700, textAlign: "center", margin: "0 0 28px", color: INK }}>
            How getting connected works
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 600, margin: "0 auto" }}>
            {STEPS.map((line, i) => (
              <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div
                  style={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: GREEN_SOFT,
                    color: GREEN,
                    fontFamily: SERIF,
                    fontSize: 16,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {i + 1}
                </div>
                <p style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.6, color: MUTED, margin: "5px 0 0" }}>{line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Partner directory ───────────────────────────── */}
      <section style={{ padding: "48px 22px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, textAlign: "center", margin: "0 0 32px", color: INK }}>
            Partners near you
          </h2>

          {grouped.length === 0 ? (
            <p style={{ fontFamily: SANS, fontSize: 15, color: MUTED, textAlign: "center" }}>
              We&apos;re adding community partners soon. Please check back shortly.
            </p>
          ) : (
            grouped.map(([city, partners]) => (
              <div key={city} style={{ marginBottom: 40 }}>
                <h3
                  style={{
                    fontFamily: SANS,
                    fontSize: 13,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: GREEN,
                    margin: "0 0 18px",
                    paddingBottom: 8,
                    borderBottom: "1px solid #e6dcc8",
                  }}
                >
                  {city}
                </h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "center" }}>
                  {partners.map((p) => (
                    <PartnerCard key={p.id} p={p} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Reassurance ─────────────────────────────────── */}
      <section style={{ background: CREAM_DEEP, padding: "40px 22px" }}>
        <div style={{ maxWidth: 620, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontFamily: SANS, fontSize: 15.5, lineHeight: 1.7, color: MUTED, margin: 0 }}>
            There&apos;s no form to fill out here and no account to create. You connect through a partner who
            knows your community. They&apos;ll make sure you&apos;re supported every step of the way.
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer style={{ padding: "30px 22px 40px", textAlign: "center" }}>
        <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: INK, marginBottom: 6 }}>Kradəl</div>
        <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, margin: 0 }}>
          Maternal &amp; baby care, delivered with dignity.
        </p>
      </footer>
    </main>
  );
}
