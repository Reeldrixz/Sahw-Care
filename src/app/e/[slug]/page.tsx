import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { fetchFeaturableRegisters } from "@/lib/registers";

type Params = { params: Promise<{ slug: string }> };

// The event landing page — the on-ramp from a broadcast to a payment.
//
// This exists because the host dashboard had no links out at all: a host could
// browse registers but had nothing to send a viewer to. This is the one URL a
// host can say on air — kradel.care/e/<slug> — short enough to read aloud and
// stable while the register they are featuring changes.
//
// IT IS ADDRESSED BY SLUG, NEVER BY TOKEN. The kevt_ access token is the host's
// dashboard credential: a viewer-facing URL carrying it would hand every viewer
// host access, and a host reading it out would broadcast it. The slug grants
// nothing — it resolves a public event and does not authorise anything.
//
// Registers come from fetchFeaturableRegisters, so this page can only ever show
// registers whose mothers opted in, read live. A mother who revokes consent
// mid-stream disappears from this page on the next load, which is the whole
// reason the pool is a query rather than a stored list.

async function getEvent(slug: string) {
  return prisma.fundraisingEvent.findUnique({
    where:  { slug: slug.toLowerCase() },
    select: { id: true, title: true, hostName: true, goalCents: true, status: true },
  });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return { title: "Event · Kradel" };
  return {
    title: `${event.title} · Kradel`,
    description: `Support mothers during ${event.title}. Every item is a real need, chosen by the mother herself.`,
    openGraph: {
      title: `${event.title} · Kradel`,
      description: `Hosted by ${event.hostName}. Fund a real item for a mother who needs it.`,
      type: "website",
    },
  };
}

const money = (c: number) => `$${(c / 100).toFixed(0)}`;

export default async function EventLandingPage({ params }: Params) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  // DRAFT is not public: an event being set up should not be findable by guessing
  // a slug. ENDED renders a closed state rather than 404 — a link read out on air
  // will keep being visited afterwards, and a dead end is a worse answer than an
  // explanation.
  if (event.status === "DRAFT") notFound();

  const registers = event.status === "LIVE" ? await fetchFeaturableRegisters() : [];

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 60 }}>
      <div style={{ background: "#e8f5f1", padding: "20px 16px 24px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ fontFamily: "Lora, serif", fontSize: 20, fontWeight: 700, color: "#1a3a2e" }}>Kradəl</div>
          <h1 style={{ fontFamily: "Lora, serif", fontSize: 26, fontWeight: 700, color: "#1a3a2e", margin: "14px 0 6px", lineHeight: 1.25 }}>
            {event.title}
          </h1>
          <div style={{ fontSize: 14, color: "#2f5d4d" }}>
            Hosted by {event.hostName}
            {event.goalCents > 0 && <> · goal {money(event.goalCents)}</>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: 16 }}>
        {event.status === "ENDED" ? (
          <div style={{ ...card, textAlign: "center", padding: 32 }}>
            <div style={{ fontFamily: "Lora, serif", fontSize: 19, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
              This event has finished
            </div>
            <p style={{ fontSize: 13.5, color: "var(--mid)", lineHeight: 1.7, margin: "0 auto 18px", maxWidth: 440 }}>
              Thank you to everyone who gave. Mothers on Kradel still need help every day — you can
              find registers to support any time.
            </p>
            <a href="/" style={btnPrimary}>See how Kradel works</a>
          </div>
        ) : registers.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: 32 }}>
            <p style={{ fontSize: 13.5, color: "var(--mid)", lineHeight: 1.7, margin: 0 }}>
              No registers are available to show right now. Mothers choose whether their register can
              appear in fundraising events, and this page updates on its own.
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13.5, color: "var(--mid)", lineHeight: 1.7, margin: "0 0 16px" }}>
              Each of these is a real mother&apos;s list of things she needs for her baby — chosen by
              her, not by us. Pick an item and fund it directly. You don&apos;t need an account.
            </p>

            {registers.map((r) => {
              const target = r.items.reduce((s, i) => s + i.standardPriceCents, 0);
              const funded = r.items.reduce((s, i) => s + i.totalFundedCents, 0);
              const pct    = target > 0 ? Math.min(100, Math.round((funded / target) * 100)) : 0;
              const needed = r.items.filter((i) => i.fundingStatus !== "FULLY_FUNDED").length;

              return (
                // ?e=<slug> is the attribution carrier. Only the slug travels —
                // the host token never appears in a viewer-facing URL.
                <a
                  key={r.id}
                  href={`/r/${r.id}?e=${encodeURIComponent(slug)}`}
                  style={{ ...card, marginBottom: 10, display: "block", textDecoration: "none" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                    <span style={{ fontFamily: "Lora, serif", fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>
                      {r.firstName}
                    </span>
                    <span style={{ fontSize: 12.5, color: "var(--mid)" }}>{r.city}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--mid)", marginTop: 3, lineHeight: 1.5 }}>{r.title}</div>

                  <div style={{ height: 7, background: "var(--border)", borderRadius: 5, overflow: "hidden", marginTop: 12 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "#1a7a5e" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                      {money(funded)} of {money(target)}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: needed ? "#b45309" : "#1a7a5e" }}>
                      {needed ? `${needed} still needed` : "All funded"}
                    </span>
                  </div>
                </a>
              );
            })}
          </>
        )}

        <p style={{ fontSize: 11.5, color: "var(--light)", lineHeight: 1.65, textAlign: "center", margin: "20px auto 0", maxWidth: 460 }}>
          Mothers join Kradel through a community partner who knows them. Every item is reviewed, and
          contributions are used only for the item they were given for.
        </p>
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: "white", border: "1px solid var(--border)", borderRadius: 16, padding: 16 };
const btnPrimary: React.CSSProperties = { display: "inline-block", background: "#1a7a5e", color: "white", borderRadius: 12, padding: "12px 24px", fontFamily: "Nunito, sans-serif", fontSize: 13.5, fontWeight: 800, textDecoration: "none" };
