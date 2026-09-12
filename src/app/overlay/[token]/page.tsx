"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

// The broadcast overlay. Added to OBS as a browser source at 1920×300 and
// composited over the host's video.
//
// ZERO PRISMA, ZERO OTHER ENDPOINTS. It reads api/overlay/[token]/stream and
// nothing else. On the dashboard that rule was hygiene; here it is the actual
// exposure boundary — a leak on this surface is broadcast to the whole audience,
// not shown to one admin. The stream sources registers only through
// fetchFeaturableRegisters -> fetchPublicRegister and sends a deliberately
// narrower subset than the public shape: first name, item names, prices,
// progress. No surname. No city.
//
// ANIMATION IS DRIVEN BY TRANSITIONS, NOT STATES. The stream self-closes every
// 55s and EventSource reconnects, so deriving "this row is FUNDED, therefore
// celebrate" from state would replay every celebration about once a minute for
// the length of the broadcast. The first frame after any connect is a hydrate
// frame and seeds the seen-state map silently; only delta frames animate.
//
// The persistent footprint is deliberately small. The creator is the
// entertainment — tiers 1 and 2 appear and clear, and only the register strip
// stays.

const PAL = {
  ink:    "#0b1210",
  panel:  "rgba(11,18,16,0.88)",
  line:   "rgba(255,255,255,0.12)",
  text:   "#f2f8f5",
  muted:  "#9fb8ae",
  accent: "#3fbf92",
  warm:   "#e3b341",
};

type ItemState = "NEEDED" | "FUNDED" | "ORDERED";
interface OverlayItem { id: string; name: string; priceCents: number; fundedCents: number; state: ItemState }
interface OverlayRegister { id: string; firstName: string; title: string; items: OverlayItem[]; allFunded: boolean }
interface Frame {
  type: "hydrate" | "delta" | "ping" | "ended";
  changed?: boolean;
  event?: { title: string; hostName: string; goalCents: number; status: string };
  raisedThroughEventCents?: number;
  contributionCount?: number;
  register?: OverlayRegister | null;
}

const money = (c: number) => `$${(c / 100).toFixed(0)}`;

export default function OverlayPage() {
  const { token } = useParams<{ token: string }>();

  const [meta, setMeta]     = useState<Frame["event"] | null>(null);
  const [raised, setRaised] = useState(0);
  const [reg, setReg]       = useState<OverlayRegister | null>(null);
  const [ended, setEnded]   = useState(false);

  // Transient tiers 1–2.
  const [flash, setFlash]       = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  // The seen-state map. Animation fires only when a row's state differs from what
  // was last seen, so a hydrate frame can seed it without animating anything.
  const seen = useRef<Map<string, ItemState>>(new Map());
  const seenAllFunded = useRef<boolean>(false);

  useEffect(() => {
    const es = new EventSource(`/api/overlay/${token}/stream`);

    es.onmessage = (ev) => {
      const f: Frame = JSON.parse(ev.data);
      if (f.type === "ping") return;
      if (f.type === "ended") { setEnded(true); es.close(); return; }

      const isHydrate = f.type === "hydrate";
      if (f.event) setMeta(f.event);
      if (typeof f.raisedThroughEventCents === "number") setRaised(f.raisedThroughEventCents);

      const next = f.register ?? null;

      // Detect transitions BEFORE committing the new frame to the seen map.
      if (!isHydrate && next) {
        for (const item of next.items) {
          const was = seen.current.get(item.id);
          if (was && was !== item.state) {
            if (item.state === "FUNDED")  setFlash(`FUNDED ✓  ${item.name}`);
            if (item.state === "ORDERED") setFlash(`ORDERED  ${item.name} for ${next.firstName}`);
          }
        }
        if (next.allFunded && !seenAllFunded.current) {
          setCelebrate(true);
          setTimeout(() => setCelebrate(false), 9000);
        }
      }

      // Seed or update the map. On hydrate this happens with no animation at all,
      // which is what stops a reconnect from replaying a celebration.
      if (next) {
        seen.current = new Map(next.items.map((i) => [i.id, i.state]));
        seenAllFunded.current = next.allFunded;
      } else {
        seen.current = new Map();
        seenAllFunded.current = false;
      }
      setReg(next);
    };

    // EventSource reconnects on its own; nothing to do but let it.
    es.onerror = () => { /* browser retries */ };
    return () => es.close();
  }, [token]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 6000);
    return () => clearTimeout(t);
  }, [flash]);

  if (ended) return null;

  const needed = reg?.items.filter((i) => i.state === "NEEDED") ?? [];
  const done   = reg?.items.filter((i) => i.state !== "NEEDED") ?? [];

  return (
    <div style={{
      width: 1920, height: 300, position: "relative",
      // Transparent ground: OBS composites this over video.
      background: "transparent", overflow: "hidden",
      fontFamily: "Nunito, system-ui, sans-serif", color: PAL.text,
    }}>
      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes popIn   { from { opacity:0; transform:scale(0.92) }      to { opacity:1; transform:scale(1) } }
        .row { animation: slideUp .45s cubic-bezier(.2,.8,.2,1) both; }
        .flash { animation: popIn .3s ease both; }
      `}</style>

      {/* Tier 3 — the persistent strip. The only element that stays. */}
      {reg && !celebrate && (
        <div style={{
          position: "absolute", left: 40, right: 40, bottom: 28,
          background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 18,
          padding: "18px 24px", display: "flex", gap: 28, alignItems: "center",
          backdropFilter: "blur(8px)",
        }}>
          {/* First name only. No city — see the note at the top of this file. */}
          <div style={{ minWidth: 240 }}>
            <div style={{ fontSize: 13, letterSpacing: 1.4, textTransform: "uppercase", color: PAL.muted, fontWeight: 800 }}>
              Helping now
            </div>
            <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.1, marginTop: 2 }}>{reg.firstName}</div>
          </div>

          <div style={{ flex: 1, display: "flex", gap: 12, overflow: "hidden" }}>
            {needed.slice(0, 3).map((i) => (
              <div key={i.id} className="row" style={{
                flex: 1, background: "rgba(255,255,255,0.05)", border: `1px solid ${PAL.line}`,
                borderRadius: 12, padding: "12px 14px", minWidth: 0,
              }}>
                <div style={{ fontSize: 17, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 15 }}>
                  <span style={{ color: PAL.muted }}>{money(i.fundedCents)} / {money(i.priceCents)}</span>
                  <span style={{ color: PAL.warm, fontWeight: 800 }}>needed</span>
                </div>
              </div>
            ))}
            {done.slice(0, 2).map((i) => (
              <div key={i.id} className="row" style={{
                width: 230, background: "rgba(63,191,146,0.12)", border: `1px solid ${PAL.accent}`,
                borderRadius: 12, padding: "12px 14px",
              }}>
                <div style={{ fontSize: 17, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.name}</div>
                <div style={{ marginTop: 8, fontSize: 15, fontWeight: 800, color: PAL.accent }}>
                  {i.state === "ORDERED" ? "ORDERED" : "FUNDED ✓"}
                </div>
              </div>
            ))}
          </div>

          {/* Tier 1 — the attributed total. A FLOOR, labelled as such: untagged
              contributions during the broadcast are genuinely not counted. */}
          <div style={{ textAlign: "right", minWidth: 230 }}>
            <div style={{ fontSize: 12, letterSpacing: 1.3, textTransform: "uppercase", color: PAL.muted, fontWeight: 800 }}>
              Raised through this event
            </div>
            <div style={{ fontSize: 40, fontWeight: 800, color: PAL.accent, lineHeight: 1.1 }}>{money(raised)}</div>
            {meta && meta.goalCents > 0 && (
              <div style={{ fontSize: 14, color: PAL.muted }}>of {money(meta.goalCents)} goal</div>
            )}
          </div>
        </div>
      )}

      {/* Tier 2 — transient fulfilment / funded notice */}
      {flash && !celebrate && (
        <div className="flash" style={{
          position: "absolute", left: 40, top: 18,
          background: PAL.accent, color: PAL.ink, borderRadius: 14,
          padding: "12px 22px", fontSize: 22, fontWeight: 800,
        }}>
          {flash}
        </div>
      )}

      {/* Celebration — FULLY FUNDED. Never "delivered": delivery is private
          between Kradel and a mother, and a live claim that something arrived
          could be wrong while a courier still has it. */}
      {celebrate && reg && (
        <div className="flash" style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "linear-gradient(90deg, rgba(11,18,16,0.92), rgba(26,122,94,0.92), rgba(11,18,16,0.92))",
        }}>
          <div style={{ fontSize: 22, letterSpacing: 3, textTransform: "uppercase", color: PAL.accent, fontWeight: 800 }}>
            Fully funded
          </div>
          <div style={{ fontSize: 56, fontWeight: 800, marginTop: 6 }}>
            Everything {reg.firstName} needed
          </div>
        </div>
      )}
    </div>
  );
}
