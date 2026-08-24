import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  visibleCommunityPartners,
  getCommunityPartner,
  daysSince,
} from "@/data/communityPartners";

// ── Palette ───────────────────────────────────────────────────────────────
const CREAM = "#faf6ee";
const CREAM_DEEP = "#f3ecdd";
const INK = "#1f2a24";
const GREEN = "#1a7a5e";
const GREEN_SOFT = "#e8f5f1";
const MUTED = "#5a6b62";
const CARD_BORDER = "#ece4d3";
const SERIF = "Lora, Georgia, serif";
const SANS = "Nunito, sans-serif";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://sahw-care.vercel.app";

const dollars = (n: number) => `$${n.toLocaleString("en-US")}`;

// Pre-render every visible partner. Stable URLs — in-store QR codes point here.
export function generateStaticParams() {
  return visibleCommunityPartners().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const partner = getCommunityPartner(slug);
  if (!partner) return { title: "Community Partner · Kradel" };

  const title = `${partner.name} — Community Care Partner`;
  const description = `${partner.name} is a Kradel Community Care Partner in ${partner.area}, funding register items for families since ${partner.joinedDate}.`;
  const url = `${APP_URL}/community-partners/${partner.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Kradel",
      type: "profile",
    },
  };
}

function aliveSignal(isoDate: string): string {
  const days = daysSince(isoDate);
  if (days <= 0) return "Last supported a family today";
  if (days === 1) return "Last supported a family yesterday";
  return `Last supported a family ${days} days ago`;
}

export default async function CommunityPartnerProfile({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const partner = getCommunityPartner(slug);
  if (!partner) notFound();

  const facts: { label: string; value: string }[] = [
    { label: "Families supported", value: String(partner.facts.familiesSupported) },
    { label: "Register items funded", value: String(partner.facts.itemsFunded) },
    { label: "Total contributed", value: dollars(partner.facts.dollarsContributed) },
  ];
  if (typeof partner.facts.deliveredWithin72hPct === "number") {
    facts.push({
      label: "Delivered within 72 hours",
      value: `${partner.facts.deliveredWithin72hPct}%`,
    });
  }

  return (
    <main style={{ background: CREAM, color: INK, minHeight: "100vh", fontFamily: SANS }}>
      {/* ── Top bar ─────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 22px",
          maxWidth: 820,
          margin: "0 auto",
        }}
      >
        <Link href="/" style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, textDecoration: "none" }}>
          Kradel
        </Link>
        <Link
          href="/community-partners"
          style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: GREEN, textDecoration: "none" }}
        >
          ← All partners
        </Link>
      </header>

      {/* ── Identity block ──────────────────────────────── */}
      <section style={{ maxWidth: 820, margin: "0 auto", padding: "36px 22px 8px" }}>
        {!partner.live && (
          <span
            style={{
              display: "inline-block",
              fontFamily: SANS,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#8a6d3b",
              background: "#fcf3d9",
              padding: "3px 9px",
              borderRadius: 20,
              marginBottom: 14,
            }}
          >
            Preview · not live
          </span>
        )}
        <span
          style={{
            display: "block",
            fontFamily: SANS,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: GREEN,
            marginBottom: 12,
          }}
        >
          Community Care Partner
        </span>
        <h1 style={{ fontFamily: SERIF, fontSize: 36, fontWeight: 700, lineHeight: 1.15, margin: "0 0 10px", color: INK }}>
          {partner.name}
        </h1>
        <p style={{ fontFamily: SANS, fontSize: 16, color: MUTED, margin: "0 0 6px" }}>
          {partner.category} · {partner.area}
        </p>
        <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, margin: 0 }}>
          Partner since {partner.joinedDate} · {aliveSignal(partner.lastActiveDate)}
        </p>
      </section>

      {/* ── Lifetime facts ──────────────────────────────── */}
      <section style={{ maxWidth: 820, margin: "0 auto", padding: "24px 22px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 14,
          }}
        >
          {facts.map((f) => (
            <div
              key={f.label}
              style={{
                background: "#fff",
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: 16,
                padding: "22px 20px",
              }}
            >
              <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 700, color: INK, lineHeight: 1.05 }}>
                {f.value}
              </div>
              <div style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: MUTED, marginTop: 4 }}>
                {f.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Recent impact timeline ──────────────────────── */}
      <section style={{ maxWidth: 820, margin: "0 auto", padding: "12px 22px 8px" }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, margin: "0 0 18px" }}>
          Recent impact
        </h2>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {partner.timeline.map((t, i) => (
            <div
              key={t.month}
              style={{
                display: "flex",
                gap: 16,
                padding: "16px 0",
                borderTop: i === 0 ? "none" : `1px solid ${CREAM_DEEP}`,
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 120,
                  fontFamily: SANS,
                  fontSize: 13,
                  fontWeight: 800,
                  color: GREEN,
                  paddingTop: 1,
                }}
              >
                {t.month}
              </div>
              <p style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.6, color: INK, margin: 0 }}>{t.entry}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Owner quote ─────────────────────────────────── */}
      {partner.ownerQuote && (
        <section style={{ maxWidth: 820, margin: "0 auto", padding: "20px 22px" }}>
          <blockquote
            style={{
              background: GREEN_SOFT,
              borderRadius: 18,
              padding: "26px 28px",
              margin: 0,
            }}
          >
            <p style={{ fontFamily: SERIF, fontSize: 19, fontStyle: "italic", lineHeight: 1.6, color: INK, margin: "0 0 10px" }}>
              &ldquo;{partner.ownerQuote}&rdquo;
            </p>
            <footer style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: GREEN }}>
              — {partner.name}
            </footer>
          </blockquote>
        </section>
      )}

      {/* ── Links ───────────────────────────────────────── */}
      <section style={{ maxWidth: 820, margin: "0 auto", padding: "20px 22px 8px" }}>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href="/community-partners"
            style={{ fontFamily: SANS, fontSize: 14, fontWeight: 800, color: GREEN, textDecoration: "none" }}
          >
            ← All Community Partners
          </Link>
          <Link
            href="/#how-it-works"
            style={{ fontFamily: SANS, fontSize: 14, fontWeight: 800, color: GREEN, textDecoration: "none" }}
          >
            How Kradel works →
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer style={{ padding: "34px 22px 44px", textAlign: "center" }}>
        <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: INK, marginBottom: 6 }}>Kradel</div>
        <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, margin: 0 }}>
          Maternal &amp; baby care, delivered with dignity.
        </p>
      </footer>
    </main>
  );
}
