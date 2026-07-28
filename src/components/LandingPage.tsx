import Link from "next/link";
import { getPublicImpactStats } from "@/lib/publicStats";

const CREAM = "#faf6ee";
const CREAM_DEEP = "#f3ecdd";
const INK = "#1f2a24";
const GREEN = "#1a7a5e";
const GREEN_SOFT = "#e8f5f1";
const MUTED = "#5a6b62";

const SERIF = "Lora, Georgia, serif";
const SANS = "Nunito, sans-serif";

const STEPS = [
  {
    n: "1",
    title: "A partner refers a mother",
    body: "A frontline community partner vouches for a mother in need and completes a private verification.",
  },
  {
    n: "2",
    title: "She lists what she needs",
    body: "She privately builds a register of specific items for her baby: real essentials, chosen by her.",
  },
  {
    n: "3",
    title: "Someone funds an item",
    body: "Someone funds an item, and it is purchased and delivered straight to her door.",
  },
];

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        flex: "1 1 140px",
        minWidth: 140,
        background: "#ffffff",
        border: "1px solid #ece4d3",
        borderRadius: 16,
        padding: "22px 18px",
        textAlign: "center",
      }}
    >
      <div style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 700, color: GREEN, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: MUTED, marginTop: 8 }}>
        {label}
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const stats = await getPublicImpactStats();

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
        <span style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, color: INK }}>Kradəl</span>
        <nav style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Link href="/auth" style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700, color: INK, textDecoration: "none" }}>
            Sign in
          </Link>
          <Link
            href="/auth?mode=signup"
            style={{
              fontFamily: SANS,
              fontSize: 14,
              fontWeight: 800,
              color: "#fff",
              background: GREEN,
              padding: "9px 18px",
              borderRadius: 22,
              textDecoration: "none",
            }}
          >
            Get involved
          </Link>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────── */}
      <section style={{ maxWidth: 760, margin: "0 auto", padding: "48px 22px 36px", textAlign: "center" }}>
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
            marginBottom: 22,
          }}
        >
          A world looking out for mothers and babies
        </span>
        <h1
          style={{
            fontFamily: SERIF,
            fontSize: 40,
            fontWeight: 700,
            lineHeight: 1.18,
            margin: "0 0 18px",
            color: INK,
          }}
        >
          Dignity-first care for mothers and their babies
        </h1>
        <p
          style={{
            fontFamily: SANS,
            fontSize: 17,
            lineHeight: 1.6,
            color: MUTED,
            maxWidth: 560,
            margin: "0 auto 28px",
          }}
        >
          Kradəl lets anyone, from a single donor to a local business, fund the specific items a mother
          needs for her baby. Each item is purchased and delivered directly to her, with her privacy
          protected at every step.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            href="/auth?mode=signup"
            style={{
              fontFamily: SANS,
              fontSize: 15,
              fontWeight: 800,
              color: "#fff",
              background: GREEN,
              padding: "14px 28px",
              borderRadius: 26,
              textDecoration: "none",
            }}
          >
            Fund an item
          </Link>
          <a
            href="#how-it-works"
            style={{
              fontFamily: SANS,
              fontSize: 15,
              fontWeight: 800,
              color: GREEN,
              background: "#fff",
              border: `1.5px solid ${GREEN}`,
              padding: "14px 28px",
              borderRadius: 26,
              textDecoration: "none",
            }}
          >
            How it works
          </a>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────── */}
      <section
        id="how-it-works"
        style={{ background: CREAM_DEEP, padding: "52px 22px" }}
      >
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: SERIF,
              fontSize: 28,
              fontWeight: 700,
              textAlign: "center",
              margin: "0 0 36px",
              color: INK,
            }}
          >
            How it works
          </h2>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
            {STEPS.map((step) => (
              <div
                key={step.n}
                style={{
                  flex: "1 1 260px",
                  maxWidth: 320,
                  background: "#fff",
                  border: "1px solid #ece4d3",
                  borderRadius: 18,
                  padding: "26px 24px",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: GREEN_SOFT,
                    color: GREEN,
                    fontFamily: SERIF,
                    fontSize: 18,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  {step.n}
                </div>
                <h3 style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, margin: "0 0 8px", color: INK }}>
                  {step.title}
                </h3>
                <p style={{ fontFamily: SANS, fontSize: 14.5, lineHeight: 1.6, color: MUTED, margin: 0 }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Impact ──────────────────────────────────────── */}
      <section style={{ padding: "52px 22px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, margin: "0 0 12px", color: INK }}>
            Real items, real homes
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.6, color: MUTED, maxWidth: 560, margin: "0 auto 32px" }}>
            Every contribution becomes a specific item delivered to a specific family. Never a handout,
            always a hand from someone who chose to care.
          </p>

          {stats.hasData ? (
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", maxWidth: 620, margin: "0 auto" }}>
              <StatTile value={stats.itemsFunded.toLocaleString()} label="items funded" />
              <StatTile value={stats.mothersSupported.toLocaleString()} label="mothers supported" />
              <StatTile value={stats.deliveries.toLocaleString()} label="deliveries on the way" />
            </div>
          ) : (
            <div
              style={{
                maxWidth: 520,
                margin: "0 auto",
                background: GREEN_SOFT,
                borderRadius: 16,
                padding: "26px 24px",
                fontFamily: SANS,
                fontSize: 15,
                lineHeight: 1.6,
                color: GREEN,
                fontWeight: 600,
              }}
            >
              We are just getting started. Be one of the first people anywhere to fund an
              item for a mother who needs it.
            </div>
          )}
        </div>
      </section>

      {/* ── Care bundles ────────────────────────────────── */}
      <section style={{ padding: "52px 22px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, margin: "0 0 12px", color: INK }}>
            Care bundles, backed by local businesses
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.6, color: MUTED, maxWidth: 560, margin: "0 auto 28px" }}>
            Kradəl also assembles curated care bundles for pregnancy, birth, and the newborn months. Each
            bundle is delivered free to referred mothers, funded by community business partners who stand
            behind them.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/bundles"
              style={{ fontFamily: SANS, fontSize: 15, fontWeight: 800, color: "#fff", background: GREEN, padding: "14px 28px", borderRadius: 26, textDecoration: "none" }}
            >
              Explore bundles
            </Link>
            <Link
              href="/community-partners"
              style={{ fontFamily: SANS, fontSize: 15, fontWeight: 800, color: GREEN, background: "#fff", border: `1.5px solid ${GREEN}`, padding: "14px 28px", borderRadius: 26, textDecoration: "none" }}
            >
              Become a partner
            </Link>
          </div>
        </div>
      </section>

      {/* ── Get involved CTA ────────────────────────────── */}
      <section style={{ background: CREAM_DEEP, padding: "52px 22px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, margin: "0 0 14px", color: INK }}>
            A small gift, delivered with dignity
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.6, color: MUTED, margin: "0 0 26px" }}>
            Join people around the world funding the exact things a mother has asked for. Or, if you support
            families directly, learn how to connect someone to Kradəl.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/auth?mode=signup"
              style={{
                fontFamily: SANS,
                fontSize: 15,
                fontWeight: 800,
                color: "#fff",
                background: GREEN,
                padding: "14px 28px",
                borderRadius: 26,
                textDecoration: "none",
              }}
            >
              Get involved
            </Link>
            <Link
              href="/find-help"
              style={{
                fontFamily: SANS,
                fontSize: 15,
                fontWeight: 800,
                color: GREEN,
                background: "#fff",
                border: `1.5px solid ${GREEN}`,
                padding: "14px 28px",
                borderRadius: 26,
                textDecoration: "none",
              }}
            >
              Need support?
            </Link>
          </div>
          <p style={{ fontFamily: SANS, fontSize: 14, color: MUTED, margin: "18px 0 0" }}>
            Are you a business?{" "}
            <Link href="/community-partners" style={{ color: GREEN, fontWeight: 800, textDecoration: "none" }}>
              Partner with us →
            </Link>
          </p>
        </div>
      </section>

      {/* ── Footer line ─────────────────────────────────── */}
      <footer style={{ padding: "30px 22px 40px", textAlign: "center" }}>
        <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: INK, marginBottom: 6 }}>Kradəl</div>
        <p style={{ fontFamily: SANS, fontSize: 13, color: MUTED, margin: "0 0 12px" }}>
          Maternal &amp; baby care, delivered with dignity.
        </p>
        <div style={{ display: "flex", gap: 18, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/find-help" style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: GREEN, textDecoration: "none" }}>Need support?</Link>
          <Link href="/community-partners" style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: GREEN, textDecoration: "none" }}>Local business? Become a Community Partner</Link>
        </div>
      </footer>
    </main>
  );
}
