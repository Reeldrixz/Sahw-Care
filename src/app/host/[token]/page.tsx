"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

// The host dashboard. Read on a second monitor, mid-broadcast, glanced at while
// talking — a different instrument from the mother-facing app, so it
// deliberately departs from that aesthetic. Dark rather than cream (a bright
// panel at night is unpleasant and can bleed into a capture), larger type,
// higher contrast, and the numbers a host needs to read aloud made dominant.
// The Kradel green is kept as the accent, brightened for legibility on dark.
//
// DATA ACCESS: this page calls GET /api/host/[token] and nothing else. No other
// endpoint, no Prisma, no second source. That is what preserves the guarantee
// verified against live data — first name only, items, progress; no surname, no
// contact, no address. It holds precisely as long as this remains the only
// thing the page reads.
//
// THE POLL IS THE POINT. The pool is read live server-side, but "live" is only
// true of the screen if the screen re-reads. Without polling, a mother who
// revokes consent mid-stream stays visible until someone refreshes. Every 25s.
//
// FEATURING IS NO LONGER LOCAL. It was, deliberately, until the broadcast
// overlay needed to know what was on screen — so selecting a register now writes
// FundraisingEvent.currentRegisterId through the token-authed featured endpoint,
// and the overlay reads it. The write is optimistic and reconciled: the server
// re-checks the register is still in the live featurable pool, so a mother who
// revoked consent since this list loaded cannot be put on air.

const POLL_MS = 25_000;

const BG      = "#0b1210";
const PANEL   = "#131c19";
const PANEL_2 = "#1a2521";
const LINE    = "#26332e";
const TEXT    = "#eef5f2";
const MUTED   = "#8ca69b";
const ACCENT  = "#3fbf92"; // Kradel green, brightened for dark
const WARN    = "#e3b341";

interface Item {
  id: string; name: string; category: string; quantity: string;
  note: string | null; status: string;
  standardPriceCents: number; totalFundedCents: number;
  fundingStatus: string; contributorCount: number; imageUrl: string | null;
}
interface Register {
  id: string; title: string; city: string; dueDate: string; status: string;
  intro: string | null; firstName: string; verificationLevel: number; items: Item[];
}
interface Payload {
  event: { title: string; hostName: string; goalCents: number; status: string; startedAt: string | null };
  registers: Register[];
  fetchedAt: string;
}

const money = (c: number) => `$${(c / 100).toFixed(0)}`;

function registerTotals(r: Register) {
  const target = r.items.reduce((s, i) => s + i.standardPriceCents, 0);
  const funded = r.items.reduce((s, i) => s + i.totalFundedCents, 0);
  const remaining = r.items.filter((i) => i.fundingStatus !== "FULLY_FUNDED").length;
  return { target, funded, remaining, pct: target ? Math.min(100, Math.round((funded / target) * 100)) : 0 };
}

export default function HostDashboardPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData]       = useState<Payload | null>(null);
  const [dead, setDead]       = useState(false);
  const [loading, setLoading] = useState(true);
  const [featured, setFeatured] = useState<string | null>(null);

  // Featuring is no longer local-only: the broadcast overlay reads
  // currentRegisterId to know what is on screen. Written optimistically so the
  // dashboard stays responsive, then reconciled — if the server refuses (she
  // revoked consent since this list loaded) the selection is rolled back rather
  // than left showing a register the overlay will not display.
  const feature = useCallback(async (registerId: string | null) => {
    setFeatured(registerId);
    const r = await fetch(`/api/host/${token}/featured`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registerId }),
      cache: "no-store",
    });
    if (!r.ok) setFeatured(null);
  }, [token]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/host/${token}`, { cache: "no-store" });
    if (r.status === 404) { setDead(true); setData(null); setLoading(false); return; }
    if (r.ok) { setData(await r.json()); setDead(false); }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
    timer.current = setInterval(load, POLL_MS);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [load]);

  // One calm message for every refusal. The API deliberately cannot tell us
  // whether the token is wrong, revoked, expired, or the event has ended, and
  // this page must not invent a distinction it does not have.
  if (dead) {
    return (
      <Shell>
        <div style={{ maxWidth: 520, margin: "18vh auto 0", textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: TEXT, marginBottom: 12 }}>
            This link isn&apos;t active
          </div>
          <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.7, margin: 0 }}>
            It may have expired, been replaced, or the event may have finished.
            Ask whoever set up the event for a current link.
          </p>
        </div>
      </Shell>
    );
  }

  if (loading || !data) {
    return <Shell><div style={{ color: MUTED, fontSize: 16, marginTop: "18vh", textAlign: "center" }}>Loading…</div></Shell>;
  }

  const { event, registers } = data;
  const poolTarget = registers.reduce((s, r) => s + registerTotals(r).target, 0);
  const poolFunded = registers.reduce((s, r) => s + registerTotals(r).funded, 0);
  const featuredReg = registers.find((r) => r.id === featured) ?? null;

  return (
    <Shell>
      {/* Event header — the numbers a host reads aloud, made dominant */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16, paddingBottom: 18, borderBottom: `1px solid ${LINE}` }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <StatusDot status={event.status} />
            <span style={{ fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", color: MUTED, fontWeight: 700 }}>
              {event.status === "LIVE" ? "Live" : event.status}
            </span>
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, color: TEXT, margin: 0, lineHeight: 1.15 }}>{event.title}</h1>
          <div style={{ fontSize: 15, color: MUTED, marginTop: 6 }}>Hosted by {event.hostName}</div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: MUTED, fontWeight: 700 }}>Event goal</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: ACCENT, lineHeight: 1.1 }}>
            {event.goalCents > 0 ? money(event.goalCents) : "—"}
          </div>
        </div>
      </div>

      {/* Pool summary. Labelled for exactly what it is: the all-time funding
          state of the registers currently featurable — NOT money raised during
          this event. The event-attributed total now exists and is shown on the
          broadcast overlay as "raised through this event"; this dashboard figure
          is deliberately still the all-time one, and says so, because a number
          that looks like "raised tonight" but isn't would be read aloud as if it
          were. Surfacing the attributed total here too is a small follow-up. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 26, padding: "16px 0", borderBottom: `1px solid ${LINE}` }}>
        <Stat label="Registers featurable" value={String(registers.length)} />
        <Stat label="Items still needed" value={String(registers.reduce((s, r) => s + registerTotals(r).remaining, 0))} />
        <Stat label="Funded of total (all-time)" value={`${money(poolFunded)} / ${money(poolTarget)}`} sub="not event-attributed" />
      </div>

      {featuredReg && <FeaturedPanel reg={featuredReg} onClose={() => feature(null)} />}

      {registers.length === 0 ? (
        <div style={{ marginTop: 60, textAlign: "center", color: MUTED, fontSize: 16, lineHeight: 1.7 }}>
          No registers are available to feature right now.<br />
          Mothers choose whether their Register can appear in fundraising events, and this updates on its own.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14, marginTop: 20 }}>
          {registers.map((r) => (
            <RegisterCard key={r.id} reg={r} active={r.id === featured} onSelect={() => feature(r.id === featured ? null : r.id)} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 28, paddingTop: 14, borderTop: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <span style={{ fontSize: 13, color: MUTED }}>
          Updated {new Date(data.fetchedAt).toLocaleTimeString()} · refreshes every {POLL_MS / 1000}s
        </span>
        <span style={{ fontSize: 13, color: MUTED }}>
          Featuring drives the broadcast overlay — what you select here is what goes on screen.
        </span>
      </div>
    </Shell>
  );
}

function RegisterCard({ reg, active, onSelect }: { reg: Register; active: boolean; onSelect: () => void }) {
  const t = registerTotals(reg);
  return (
    <div
      onClick={onSelect}
      style={{
        background: active ? PANEL_2 : PANEL,
        border: `1.5px solid ${active ? ACCENT : LINE}`,
        borderRadius: 14, padding: 16, cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: TEXT }}>{reg.firstName}</div>
        <div style={{ fontSize: 13, color: MUTED }}>{reg.city}</div>
      </div>
      <div style={{ fontSize: 14, color: MUTED, marginTop: 4, lineHeight: 1.5 }}>{reg.title}</div>

      <div style={{ marginTop: 14 }}>
        <div style={{ height: 8, background: LINE, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ width: `${t.pct}%`, height: "100%", background: ACCENT }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{money(t.funded)} of {money(t.target)}</span>
          <span style={{ fontSize: 15, color: t.remaining ? WARN : ACCENT, fontWeight: 700 }}>
            {t.remaining ? `${t.remaining} still needed` : "All funded"}
          </span>
        </div>
      </div>
    </div>
  );
}

function FeaturedPanel({ reg, onClose }: { reg: Register; onClose: () => void }) {
  const t = registerTotals(reg);
  return (
    <div style={{ marginTop: 20, background: PANEL_2, border: `2px solid ${ACCENT}`, borderRadius: 18, padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: 1.3, textTransform: "uppercase", color: ACCENT, fontWeight: 800, marginBottom: 6 }}>
            On screen
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, color: TEXT, lineHeight: 1.1 }}>{reg.firstName}</div>
          <div style={{ fontSize: 17, color: MUTED, marginTop: 6 }}>{reg.city} · {reg.title}</div>
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${LINE}`, color: MUTED, borderRadius: 10, padding: "8px 14px", fontSize: 14, cursor: "pointer" }}>
          Clear
        </button>
      </div>

      {reg.intro && (
        <p style={{ fontSize: 17, color: TEXT, lineHeight: 1.7, marginTop: 16, maxWidth: 760 }}>{reg.intro}</p>
      )}

      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
        {reg.items.map((i) => {
          const done = i.fundingStatus === "FULLY_FUNDED";
          return (
            <div key={i.id} style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 16, color: TEXT, fontWeight: 600, lineHeight: 1.4 }}>{i.name}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ fontSize: 15, color: MUTED }}>{money(i.standardPriceCents)}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: done ? ACCENT : WARN }}>
                  {done ? "Funded" : `${money(i.totalFundedCents)} in`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 16, fontSize: 20, fontWeight: 800, color: TEXT }}>
        {money(t.funded)} of {money(t.target)} · {t.pct}%
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, letterSpacing: 1.2, textTransform: "uppercase", color: MUTED, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: TEXT, marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const c = status === "LIVE" ? ACCENT : status === "ENDED" ? MUTED : WARN;
  return <span style={{ width: 10, height: 10, borderRadius: "50%", background: c, display: "inline-block" }} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: BG, minHeight: "100vh", padding: "26px 30px 60px", fontFamily: "Nunito, system-ui, sans-serif", color: TEXT }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
