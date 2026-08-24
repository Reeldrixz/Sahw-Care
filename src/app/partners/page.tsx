import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Become a Community Partner · Kradel",
  description:
    "Join the Kradel Community Partner Network. Local businesses fund verified maternal care in their communities. Every partner is recognized equally; you choose how long to commit and how much to fund.",
};

// ── Palette (matches the public landing page) ─────────────────────────────
const CREAM = "#faf6ee";
const INK = "#1f2a24";
const GREEN = "#1a7a5e";
const GREEN_SOFT = "#e8f5f1";
const MUTED = "#5a6b62";
const CARD_BORDER = "#ece4d3";

const SERIF = "Lora, Georgia, serif";
const SANS = "Nunito, sans-serif";

const PARTNER_EMAIL = "partner@kradel.care";
const CONTACT_HREF = `mailto:${PARTNER_EMAIL}?subject=${encodeURIComponent(
  "Becoming a Kradel Community Partner",
)}`;

// Commitment plans differ ONLY by duration. Benefits are identical across all
// four (see the shared "Every Community Partner receives" section) so nothing
// here is a benefits ladder.
interface Plan {
  name: string;
  desc: string;
  badge?: string;
  caption?: string;
}
const PLANS: Plan[] = [
  { name: "4-Month Partner", desc: "Commit to 4 consecutive months." },
  { name: "6-Month Partner", desc: "Commit to 6 consecutive months." },
  {
    name: "12-Month Partner",
    desc: "A full year of support for families in your community.",
    badge: "Best fit",
    caption: "The natural fit for annual community giving budgets.",
  },
  { name: "Continuous Partner", desc: "Continue month to month, pause or stop anytime. No lock-in." },
];

export default function PartnersPage() {
  return (
    <main style={{ background: CREAM, color: INK, minHeight: "100vh", fontFamily: SANS }}>
      {/* ── Top bar ─────────────────────────────────────── */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", maxWidth: 1040, margin: "0 auto" }}>
        <Link href="/" style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, textDecoration: "none" }}>Kradəl</Link>
        <Link href="/" style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: GREEN, textDecoration: "none" }}>← Home</Link>
      </header>

      {/* ── Hero / membership framing ────────────────────── */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "24px 22px 8px", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: GREEN_SOFT, color: GREEN, fontFamily: SANS, fontSize: 13, fontWeight: 800, padding: "6px 14px", borderRadius: 20, marginBottom: 18 }}>
          Community Partner Network
        </div>
        <h1 style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 700, lineHeight: 1.2, margin: "0 0 12px" }}>
          Become a Kradel Community Partner
        </h1>
        <p style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: GREEN, margin: "0 0 16px" }}>
          Build trust. Support families. Measure your impact.
        </p>
        <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.7, color: MUTED, margin: 0 }}>
          Community Partners join a network of local businesses funding verified maternal care in their own
          communities. Every partner receives the same recognition and impact tools. You choose how long to commit
          and how much to fund, and your support goes to real families near you.
        </p>
      </section>

      {/* ── Every Community Partner receives (flat, identical for all) ── */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "28px 22px 8px" }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, textAlign: "center", margin: "0 0 8px" }}>
          Every Community Partner receives
        </h2>
        <p style={{ fontFamily: SANS, fontSize: 14.5, lineHeight: 1.6, color: MUTED, textAlign: "center", margin: "0 auto 22px", maxWidth: 620 }}>
          Every Community Partner is recognized equally. You choose how many families to help, and for how long.
        </p>
        <div style={{ background: "#fff", border: `1px solid ${CARD_BORDER}`, borderRadius: 18, padding: "22px 24px" }}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              "Verified Community Partner profile",
              "Partner badge for your website, socials, and storefront",
              null, // directory item rendered specially below
              "Quarterly and annual impact reports",
              "Storytelling and recognition, focused on your business and the bundles you fund",
              "Community recognition across Kradel",
            ].map((benefit, i) => (
              <li key={i} style={{ fontFamily: SANS, fontSize: 15, color: INK, display: "flex", gap: 10, lineHeight: 1.5 }}>
                <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, flexShrink: 0, marginTop: 8 }} />
                {benefit ?? (
                  <span>
                    Listing in the{" "}
                    <Link href="/community-partners" style={{ color: GREEN, fontWeight: 700, textDecoration: "none" }}>
                      Community Partners directory
                    </Link>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Choose your commitment (differs by duration only) ── */}
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 22px 8px" }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK, textAlign: "center", margin: "0 0 8px" }}>
          Choose your commitment
        </h2>
        <p style={{ fontFamily: SANS, fontSize: 14.5, lineHeight: 1.65, color: MUTED, textAlign: "center", margin: "0 auto 22px", maxWidth: 680 }}>
          Every plan includes everything above. Plans differ only by how long you commit, not by what you receive.
          About $150 a month supports roughly one family&apos;s bundle. You can fund more each month to support more
          families; $150 is the floor, not a cap.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {PLANS.map((p) => (
            <div key={p.name} style={{
              background: "#fff",
              border: `1.5px solid ${p.badge ? GREEN : CARD_BORDER}`,
              borderRadius: 18, padding: "22px 20px",
              display: "flex", flexDirection: "column", gap: 8,
              boxShadow: p.badge ? `0 8px 28px ${GREEN_SOFT}` : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, color: INK }}>{p.name}</span>
                {p.badge && (
                  <span style={{ background: GREEN_SOFT, color: GREEN, fontFamily: SANS, fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20 }}>{p.badge}</span>
                )}
              </div>
              <div>
                <span style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 700, color: GREEN }}>from $150</span>
                <span style={{ fontFamily: SANS, fontSize: 13, color: MUTED, fontWeight: 700 }}> / month</span>
              </div>
              <p style={{ fontFamily: SANS, fontSize: 13.5, color: MUTED, lineHeight: 1.55, margin: 0 }}>{p.desc}</p>
              {p.caption && (
                <p style={{ fontFamily: SANS, fontSize: 12, color: GREEN, fontWeight: 700, lineHeight: 1.5, margin: "2px 0 0" }}>{p.caption}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Transparency ────────────────────────────────── */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "24px 22px" }}>
        <div style={{ background: GREEN_SOFT, borderRadius: 16, padding: "18px 20px" }}>
          <p style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.65, color: INK, margin: 0 }}>
            <strong>Full transparency.</strong> Bundle items are funded at cost, plus a transparent 7% platform
            operations fee. Everything is itemized, line by line, on your receipt.
          </p>
        </div>
      </section>

      {/* ── Become a partner ────────────────────────────── */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "8px 22px 12px", textAlign: "center" }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 700, color: INK, margin: "0 0 10px" }}>Become a partner</h2>
        <p style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.65, color: MUTED, margin: "0 0 20px" }}>
          Tell us a little about your business and how you would like to help, and we will take it from there.
        </p>
        <a href={CONTACT_HREF} style={{ display: "inline-block", fontFamily: SANS, fontSize: 15, fontWeight: 800, color: "#fff", background: GREEN, padding: "14px 30px", borderRadius: 26, textDecoration: "none" }}>
          Become a partner
        </a>
        <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, marginTop: 12 }}>
          or email <a href={CONTACT_HREF} style={{ color: GREEN, fontWeight: 700 }}>{PARTNER_EMAIL}</a>
        </p>
        <p style={{ fontFamily: SANS, fontSize: 12.5, color: MUTED, marginTop: 14, lineHeight: 1.6 }}>
          Partnerships are arranged personally during our beta. Recurring online enrolment is coming soon.
        </p>
      </section>

      <footer style={{ padding: "24px 22px 40px", textAlign: "center" }}>
        <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: INK, marginBottom: 6 }}>Kradel</div>
        <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, margin: 0 }}>Maternal &amp; baby care, delivered with dignity.</p>
      </footer>
    </main>
  );
}
