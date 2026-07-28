import Link from "next/link";
import type { Metadata } from "next";
import {
  visibleCommunityPartners,
  sortCommunityPartners,
  daysSince,
  type CommunityPartner,
} from "@/data/communityPartners";

// ── Palette (matches the public landing / find-help pages) ────────────────
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
const PARTNER_EMAIL = "partner@kradel.care";
const BECOME_HREF = `mailto:${PARTNER_EMAIL}?subject=${encodeURIComponent(
  "Becoming a founding Community Partner",
)}`;

export const metadata: Metadata = {
  title: "Community Partners · Kradəl",
  description:
    "Local businesses creating measurable impact through Kradəl by funding the specific register items mothers need.",
  alternates: { canonical: `${APP_URL}/community-partners` },
  openGraph: {
    title: "Community Partners · Kradəl",
    description: "Local businesses creating measurable impact through Kradəl.",
    url: `${APP_URL}/community-partners`,
    siteName: "Kradəl",
    type: "website",
  },
};

const dollars = (n: number) => `$${n.toLocaleString("en-US")}`;

function aliveSignal(p: CommunityPartner): string {
  const days = daysSince(p.lastActiveDate);
  if (days <= 0) return "Last supported a family today";
  if (days === 1) return "Last supported a family yesterday";
  return `Last supported a family ${days} days ago`;
}

function PartnerCard({ p }: { p: CommunityPartner }) {
  const headlineFacts: { label: string; value: string }[] = [
    { label: "Families supported", value: String(p.facts.familiesSupported) },
    { label: "Register items funded", value: String(p.facts.itemsFunded) },
    { label: "Contributed", value: dollars(p.facts.dollarsContributed) },
  ];

  return (
    <Link
      href={`/community-partners/${p.slug}`}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 18,
        padding: "24px 22px",
        flex: "1 1 320px",
        maxWidth: 420,
        textDecoration: "none",
        color: INK,
      }}
    >
      {!p.live && (
        <span
          style={{
            alignSelf: "flex-start",
            fontFamily: SANS,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#8a6d3b",
            background: "#fcf3d9",
            padding: "3px 9px",
            borderRadius: 20,
            marginBottom: 12,
          }}
        >
          Preview · not live
        </span>
      )}
      <h3 style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700, margin: "0 0 4px", color: INK }}>
        {p.name}
      </h3>
      <p style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 700, color: GREEN, margin: "0 0 2px" }}>
        {p.category}
      </p>
      <p style={{ fontFamily: SANS, fontSize: 13.5, color: MUTED, margin: "0 0 18px" }}>{p.area}</p>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
        {headlineFacts.map((f) => (
          <div key={f.label}>
            <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, lineHeight: 1.1 }}>
              {f.value}
            </div>
            <div style={{ fontFamily: SANS, fontSize: 11.5, color: MUTED, fontWeight: 600 }}>{f.label}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "auto", borderTop: `1px solid ${CREAM_DEEP}`, paddingTop: 14 }}>
        <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, margin: "0 0 4px" }}>
          Partner since {p.joinedDate}
        </p>
        <p style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 700, color: GREEN, margin: 0 }}>
          {aliveSignal(p)}
        </p>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        maxWidth: 640,
        margin: "0 auto",
        background: "#fff",
        border: `1.5px dashed ${CARD_BORDER}`,
        borderRadius: 20,
        padding: "44px 32px",
        textAlign: "center",
      }}
    >
      <h2 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 700, color: INK, margin: "0 0 14px" }}>
        Become a founding Community Partner
      </h2>
      <p style={{ fontFamily: SANS, fontSize: 15.5, lineHeight: 1.7, color: MUTED, margin: "0 0 10px" }}>
        The Community Partner Program is how local businesses fund the specific register items
        mothers need — real essentials for pregnancy, birth, and the newborn months. Every
        contribution maps to actual items, delivered directly to a family.
      </p>
      <p style={{ fontFamily: SANS, fontSize: 15.5, lineHeight: 1.7, color: MUTED, margin: "0 0 24px" }}>
        No business has joined publicly yet. The first to sign on becomes a founding partner, with a
        stable profile page showing their verified, month-by-month impact.
      </p>
      <a
        href={BECOME_HREF}
        style={{
          display: "inline-block",
          fontFamily: SANS,
          fontSize: 15,
          fontWeight: 800,
          color: "#fff",
          background: GREEN,
          padding: "14px 30px",
          borderRadius: 26,
          textDecoration: "none",
        }}
      >
        Become a founding partner
      </a>
      <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, marginTop: 14 }}>
        or email{" "}
        <a href={BECOME_HREF} style={{ color: GREEN, fontWeight: 700, textDecoration: "none" }}>
          {PARTNER_EMAIL}
        </a>
      </p>
    </div>
  );
}

export default function CommunityPartnersPage() {
  const partners = sortCommunityPartners(visibleCommunityPartners(), "recent");

  return (
    <main style={{ background: CREAM, color: INK, minHeight: "100vh", fontFamily: SANS }}>
      {/* ── Top bar ─────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 22px",
          maxWidth: 1040,
          margin: "0 auto",
        }}
      >
        <Link href="/" style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, textDecoration: "none" }}>
          Kradəl
        </Link>
        <Link href="/" style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: GREEN, textDecoration: "none" }}>
          ← Home
        </Link>
      </header>

      {/* ── Hero ────────────────────────────────────────── */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "40px 22px 28px", textAlign: "center" }}>
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
          Community Partners
        </span>
        <h1 style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 700, lineHeight: 1.2, margin: "0 0 16px", color: INK }}>
          Businesses creating measurable impact through Kradəl
        </h1>
        <p style={{ fontFamily: SANS, fontSize: 16.5, lineHeight: 1.65, color: MUTED, margin: "0 auto", maxWidth: 580 }}>
          Community Partners are local businesses that fund the specific register items mothers ask
          for. Each partner below has a verified record of the families they&apos;ve supported and the
          items they&apos;ve funded.
        </p>
      </section>

      {/* ── Directory ───────────────────────────────────── */}
      <section style={{ padding: "8px 22px 52px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          {partners.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center" }}>
              {partners.map((p) => (
                <PartnerCard key={p.slug} p={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── How it works link ───────────────────────────── */}
      <section style={{ background: CREAM_DEEP, padding: "36px 22px" }}>
        <div style={{ maxWidth: 620, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.7, color: MUTED, margin: "0 0 14px" }}>
            Every contribution is funded at the true retail cost of real items and delivered directly
            to a family. Recognition goes to the businesses that make it possible.
          </p>
          <Link
            href="/#how-it-works"
            style={{ fontFamily: SANS, fontSize: 14, fontWeight: 800, color: GREEN, textDecoration: "none" }}
          >
            See how Kradəl works →
          </Link>
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
