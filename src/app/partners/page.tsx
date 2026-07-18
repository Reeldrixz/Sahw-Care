import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community Partners · Kradəl",
  description:
    "Local businesses fund curated care bundles for mothers across Canada. Mothers stay private; recognition goes to the businesses that make it possible.",
};

// ── Palette (matches the public landing page) ─────────────────────────────
const CREAM = "#faf6ee";
const INK = "#1f2a24";
const GREEN = "#1a7a5e";
const GREEN_SOFT = "#e8f5f1";
const MUTED = "#5a6b62";
const ROSE = "#9d174d";
const ROSE_SOFT = "#fce7f3";
const CARD_BORDER = "#ece4d3";

const SERIF = "Lora, Georgia, serif";
const SANS = "Nunito, sans-serif";

const PARTNER_EMAIL = "partners@kradel.care";
const CONTACT_HREF = `mailto:${PARTNER_EMAIL}?subject=${encodeURIComponent(
  "Becoming a Kradəl Community Partner",
)}`;

// ── Sponsorship tiers ─────────────────────────────────────────────────────
interface Tier {
  name: string;
  price: string;
  cadence: string;
  scope: string;
  accent: string;
  accentSoft: string;
  perks?: string[];
  featured?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Bronze",
    price: "$100–250",
    cadence: "one-off",
    scope: "1 bundle · 1 slot",
    accent: "#b45309",
    accentSoft: "#fef3c7",
  },
  {
    name: "Silver",
    price: "$500–1,250",
    cadence: "one-off",
    scope: "1 bundle · 5 slots",
    accent: "#6b7280",
    accentSoft: "#f3f4f6",
  },
  {
    name: "Gold",
    price: "$2,000–2,600",
    cadence: "one-off",
    scope: "Up to 3 bundles · 15 slots",
    accent: "#a16207",
    accentSoft: "#fef9c3",
  },
  {
    name: "Care Partner",
    price: "from $300",
    cadence: "per month",
    scope: "3 bundles · 3 slots / month, recurring",
    accent: ROSE,
    accentSoft: ROSE_SOFT,
    featured: true,
    perks: [
      "Priority naming on bundles",
      "A partner profile on Kradəl",
      "Storytelling priority",
      "Annual recognition",
      "Slot rollover month to month",
    ],
  },
];

// ── Our partners (hand-edited — add entries here as businesses join) ───────
interface Partner {
  name: string;
  url?: string;
  blurb?: string;
}
const PARTNERS: Partner[] = [];

function safeHttpUrl(url?: string): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
}

export default function PartnersPage() {
  return (
    <main style={{ background: CREAM, color: INK, minHeight: "100vh", fontFamily: SANS }}>
      {/* ── Top bar ─────────────────────────────────────── */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", maxWidth: 1040, margin: "0 auto" }}>
        <Link href="/" style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, textDecoration: "none" }}>Kradəl</Link>
        <Link href="/" style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: GREEN, textDecoration: "none" }}>← Home</Link>
      </header>

      {/* ── Hero / intro ────────────────────────────────── */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "24px 22px 8px", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: GREEN_SOFT, color: GREEN, fontFamily: SANS, fontSize: 13, fontWeight: 800, padding: "6px 14px", borderRadius: 20, marginBottom: 18 }}>
          Community Partners
        </div>
        <h1 style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 700, lineHeight: 1.2, margin: "0 0 16px" }}>
          Local businesses stand behind Kradəl&apos;s mothers
        </h1>
        <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.7, color: MUTED, margin: "0 0 8px" }}>
          Businesses fund curated care bundles — real essentials for pregnancy, birth, and the newborn months.
          Mothers receive them completely free, and their applications always stay private. Recognition goes to
          the businesses that make it possible: your name, your story, your community impact.
        </p>
      </section>

      {/* ── Tiers ───────────────────────────────────────── */}
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 22px 8px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16 }}>
          {TIERS.map((t) => (
            <div key={t.name} style={{
              background: "#fff",
              border: `1.5px solid ${t.featured ? t.accent : CARD_BORDER}`,
              borderRadius: 18, padding: "22px 20px",
              display: "flex", flexDirection: "column", gap: 10,
              boxShadow: t.featured ? `0 8px 28px ${t.accentSoft}` : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, color: INK }}>{t.name}</span>
                {t.featured && (
                  <span style={{ background: t.accentSoft, color: t.accent, fontFamily: SANS, fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20 }}>Recurring</span>
                )}
              </div>
              <div>
                <span style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: t.accent }}>{t.price}</span>
                <span style={{ fontFamily: SANS, fontSize: 13, color: MUTED, fontWeight: 700 }}> {t.cadence}</span>
              </div>
              <div style={{ fontFamily: SANS, fontSize: 13, color: MUTED, fontWeight: 700 }}>{t.scope}</div>

              {t.perks && (
                <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
                  {t.perks.map((p) => (
                    <li key={p} style={{ fontFamily: SANS, fontSize: 13, color: INK, display: "flex", gap: 8, lineHeight: 1.4 }}>
                      <span style={{ color: t.accent, fontWeight: 900 }}>✓</span>{p}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Transparency ────────────────────────────────── */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "20px 22px" }}>
        <div style={{ background: GREEN_SOFT, borderRadius: 16, padding: "18px 20px", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span aria-hidden style={{ fontSize: 18 }}>🧾</span>
          <p style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.65, color: INK, margin: 0 }}>
            <strong>Full transparency.</strong> Every bundle is funded at the true retail cost of its items plus a
            7% platform operations fee — itemized, line by line, on your receipt.
          </p>
        </div>
      </section>

      {/* ── Our partners ────────────────────────────────── */}
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "16px 22px 8px" }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, marginBottom: 16, textAlign: "center" }}>Our partners</h2>
        {PARTNERS.length === 0 ? (
          <div style={{ background: "#fff", border: `1.5px dashed ${CARD_BORDER}`, borderRadius: 18, padding: "36px 24px", textAlign: "center" }}>
            <p style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: GREEN, margin: "0 0 8px" }}>
              Founding partner spots are open
            </p>
            <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, margin: 0, lineHeight: 1.6 }}>
              Be the first business behind Kradəl&apos;s mothers.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            {PARTNERS.map((p) => {
              const href = safeHttpUrl(p.url);
              return (
                <div key={p.name} style={{ background: "#fff", border: `1px solid ${CARD_BORDER}`, borderRadius: 16, padding: "20px" }}>
                  <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: INK, marginBottom: 6 }}>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: GREEN, textDecoration: "none" }}>{p.name}</a>
                    ) : p.name}
                  </div>
                  {p.blurb && <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.6 }}>{p.blurb}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Become a partner ────────────────────────────── */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "24px 22px 12px", textAlign: "center" }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 700, color: INK, margin: "0 0 10px" }}>Become a partner</h2>
        <p style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.65, color: MUTED, margin: "0 0 20px" }}>
          Tell us a little about your business and how you&apos;d like to help. We&apos;ll take it from there.
        </p>
        <a href={CONTACT_HREF} style={{ display: "inline-block", fontFamily: SANS, fontSize: 15, fontWeight: 800, color: "#fff", background: GREEN, padding: "14px 30px", borderRadius: 26, textDecoration: "none" }}>
          Become a partner
        </a>
        <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, marginTop: 12 }}>
          or email <a href={CONTACT_HREF} style={{ color: GREEN, fontWeight: 700 }}>{PARTNER_EMAIL}</a>
        </p>
      </section>

      <footer style={{ padding: "24px 22px 40px", textAlign: "center" }}>
        <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: INK, marginBottom: 6 }}>Kradəl</div>
        <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, margin: 0 }}>Maternal &amp; baby care, delivered with dignity.</p>
      </footer>
    </main>
  );
}
