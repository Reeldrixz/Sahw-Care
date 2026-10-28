"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { StreamerRegister } from "@/lib/fulfillmentOrder";
import { STREAMER_TRACKING_NOTE } from "@/lib/trackingLink";

// The streamer's evidence page: for each register fully funded in this event,
// the orders placed for it. Read off-air, on the host's own screen.
//
// DATA ACCESS: GET /api/host/[token]/orders and nothing else. That route
// returns first name, items, status, tracking link, estimated delivery and
// total, and nothing more; this page can't show what it never receives.
//
// The tracking link is only ever a plain link opened in a new tab. Never an
// iframe or a preview, and nothing here fetches it.

const POLL_MS = 60_000;

const BG      = "#0b1210";
const PANEL   = "#131c19";
const PANEL_2 = "#1a2521";
const LINE    = "#26332e";
const TEXT    = "#eef5f2";
const MUTED   = "#8ca69b";
const ACCENT  = "#3fbf92";
const WARN    = "#e3b341";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
// The date as stored (a calendar date), not shifted into the viewer's timezone.
const day = (ymd: string) =>
  new Date(`${ymd}T12:00:00Z`).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export default function HostOrdersPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<StreamerRegister[] | null>(null);
  const [dead, setDead] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/host/${encodeURIComponent(token)}/orders`, { cache: "no-store" });
    if (r.status === 404) { setDead(true); setData(null); return; }
    if (!r.ok) return; // keep what's shown; the next poll retries
    const d = await r.json();
    setData(d.registers);
  }, [token]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  if (dead) {
    return (
      <Shell>
        <div style={{ maxWidth: 520, margin: "18vh auto 0", textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 12 }}>This link isn&apos;t active</div>
          <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.7, margin: 0 }}>
            It may have expired, been replaced, or the event may have finished.
            Ask whoever set up the event for a current link.
          </p>
        </div>
      </Shell>
    );
  }
  if (!data) return <Shell><div style={{ color: MUTED, fontSize: 16, marginTop: "18vh", textAlign: "center" }}>Loading…</div></Shell>;

  return (
    <Shell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Orders</h1>
        <a href={`/host/${encodeURIComponent(token)}`} style={{ color: ACCENT, fontSize: 14, fontWeight: 700 }}>← Back to dashboard</a>
      </div>

      <div role="note" style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, border: `1px solid ${WARN}`, background: "rgba(227,179,65,0.08)", color: WARN, fontSize: 14.5, lineHeight: 1.55, fontWeight: 700 }}>
        {STREAMER_TRACKING_NOTE}
      </div>

      {data.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 15, marginTop: 28 }}>No registers fully funded in this event yet.</p>
      ) : data.map((r, n) => (
        <section key={n} style={{ marginTop: 20, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{r.firstName ?? "A mother"}</div>

          {r.orders.map((o, k) => (
            <div key={k} style={{ marginTop: 12, background: PANEL_2, border: `1px solid ${LINE}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>
                {o.status === "DELIVERED" ? "Delivered ✓" : "Order placed ✓"}
              </div>
              <div style={{ fontSize: 14, marginTop: 6 }}>{o.items.join(" · ")}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginTop: 10, fontSize: 14, color: MUTED }}>
                <span>Estimated delivery: <b style={{ color: TEXT }}>{day(o.estimatedDelivery)}</b></span>
                <span>
                  Order total (recorded by Kradel) <b style={{ color: TEXT }}>{money(o.totalCents)}</b>
                  {o.taxCents !== null && <>, tax <b style={{ color: TEXT }}>{money(o.taxCents)}</b> included</>}
                </span>
              </div>
              <a href={o.trackingUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-block", marginTop: 12, color: ACCENT, fontWeight: 700, fontSize: 14.5 }}>
                Track this order ↗
              </a>
            </div>
          ))}

          {/* Funded, with no order record to show: either not ordered yet or
              bought without a tracking link. Only "Funded ✓" is true of both. */}
          {r.fundedNoRecord.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 14, color: MUTED }}>
              Funded ✓: {r.fundedNoRecord.join(" · ")}
            </div>
          )}
        </section>
      ))}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: BG, minHeight: "100vh", padding: "26px 16px 60px", fontFamily: "Nunito, system-ui, sans-serif", color: TEXT }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
