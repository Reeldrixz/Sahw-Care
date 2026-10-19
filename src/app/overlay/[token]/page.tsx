"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { OverlayFrame } from "@/lib/overlayFrame";
import { celebrationText, type PublicCelebration } from "@/lib/publicCelebration";

// The broadcast overlay. Added to the host's streaming software as a browser
// source at 1920×300 and composited over the host's video.
//
// ONE ENDPOINT, POLLED. It reads POST /api/overlay/[token]/frame every few
// seconds and nothing else: no Prisma, no other route, no websocket. On this
// surface a leak is broadcast to the whole audience, so everything it shows
// comes from lib/overlayFrame's public shape — first names, item names and
// amounts, progress, and celebrations in lib/publicCelebration's shape. No
// ids, no surname, no city, no dollar total.
//
// CELEBRATIONS COME FROM THE SERVER'S QUEUE, NOT FROM STATE. The overlay asks
// for the next one (claim) only when it isn't showing one; the server hands
// each celebration out once, oldest first, so a reload or a dropped
// connection replays nothing. The persistent strip is rebuilt from state on
// every poll, so a fresh overlay shows the current picture straight away.

const PAL = {
  ink:    "#0b1210",
  panel:  "rgba(11,18,16,0.88)",
  line:   "rgba(255,255,255,0.12)",
  text:   "#f2f8f5",
  muted:  "#9fb8ae",
  accent: "#3fbf92",
  warm:   "#e3b341",
};

const POLL_MS = 3000;
// How long a celebration stays up; the next one is claimed after this.
const SHOW_MS: Record<PublicCelebration["type"], number> = {
  ITEM_FUNDED: 6000, ITEM_FUNDED_BY_ONE: 6000, REGISTER_COMPLETE: 9000, BUNDLE_UNLOCKED: 9000,
};

const money = (c: number) => `$${(c / 100).toFixed(0)}`;

export default function OverlayPage() {
  const { token } = useParams<{ token: string }>();

  const [frame, setFrame] = useState<OverlayFrame | null>(null);
  const [ended, setEnded] = useState(false);
  const [showing, setShowing] = useState<PublicCelebration | null>(null);
  const showingRef = useRef(false);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const r = await fetch(`/api/overlay/${token}/frame`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Ask for the next celebration only when nothing is on screen.
          body: JSON.stringify({ claim: !showingRef.current }),
          cache: "no-store",
        });
        // Token revoked or event ended: show nothing and stop.
        if (r.status === 404) { setEnded(true); stopped = true; return; }
        if (r.ok) {
          const f: OverlayFrame = await r.json();
          setFrame(f);
          if (f.celebration) {
            showingRef.current = true;
            setShowing(f.celebration);
            setTimeout(() => { showingRef.current = false; setShowing(null); }, SHOW_MS[f.celebration.type]);
          }
        }
      } catch {
        // Dropped connection: keep polling; the next frame rebuilds the state.
      }
      if (!stopped) timer = setTimeout(poll, POLL_MS);
    };

    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [token]);

  if (ended || !frame) return null;

  const reg = frame.register;
  const needed = reg?.items.filter((i) => i.state === "NEEDED") ?? [];
  const done   = reg?.items.filter((i) => i.state !== "NEEDED") ?? [];
  const full   = showing && (showing.type === "REGISTER_COMPLETE" || showing.type === "BUNDLE_UNLOCKED");
  const text   = showing ? celebrationText(showing) : null;

  return (
    <div style={{
      width: 1920, height: 300, position: "relative",
      // Transparent ground: the streaming software composites this over video.
      background: "transparent", overflow: "hidden",
      fontFamily: "Nunito, system-ui, sans-serif", color: PAL.text,
    }}>
      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes popIn   { from { opacity:0; transform:scale(0.92) }      to { opacity:1; transform:scale(1) } }
        .row { animation: slideUp .45s cubic-bezier(.2,.8,.2,1) both; }
        .flash { animation: popIn .3s ease both; }
      `}</style>

      {/* The persistent strip: who is being helped, her items, the progress. */}
      {reg && !full && (
        <div style={{
          position: "absolute", left: 40, right: 40, bottom: 28,
          background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 18,
          padding: "18px 24px", display: "flex", gap: 28, alignItems: "center",
          backdropFilter: "blur(8px)",
        }}>
          {/* First name only, or none if it fails the name rule. */}
          <div style={{ minWidth: 240 }}>
            <div style={{ fontSize: 13, letterSpacing: 1.4, textTransform: "uppercase", color: PAL.muted, fontWeight: 800 }}>
              Helping now
            </div>
            {reg.firstName && <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.1, marginTop: 2 }}>{reg.firstName}</div>}
            <div style={{ fontSize: 15, color: PAL.muted, marginTop: 4 }}>
              {reg.counts.funded} of {reg.counts.total} items funded
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", gap: 12, overflow: "hidden" }}>
            {needed.slice(0, 3).map((i, n) => (
              <div key={`n${n}-${i.name}`} className="row" style={{
                flex: 1, background: "rgba(255,255,255,0.05)", border: `1px solid ${PAL.line}`,
                borderRadius: 12, padding: "12px 14px", minWidth: 0,
              }}>
                <div style={{ fontSize: 17, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 15 }}>
                  <span style={{ color: PAL.muted }}>{money(i.fundedCents)} / {money(i.priceCents)}</span>
                  <span style={{ color: PAL.warm, fontWeight: 800 }}>{money(i.remainingCents)} to go</span>
                </div>
              </div>
            ))}
            {done.slice(0, 2).map((i, n) => (
              <div key={`d${n}-${i.name}`} className="row" style={{
                width: 230, background: "rgba(63,191,146,0.12)", border: `1px solid ${PAL.accent}`,
                borderRadius: 12, padding: "12px 14px",
              }}>
                <div style={{ fontSize: 17, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.name}</div>
                <div style={{ marginTop: 8, fontSize: 15, fontWeight: 800, color: PAL.accent }}>
                  {i.state === "ORDERED" ? "Order placed ✓" : "Funded ✓"}
                </div>
              </div>
            ))}
          </div>

          {/* Progress: this register, then the event's goal in registers. */}
          <div style={{ textAlign: "right", minWidth: 260 }}>
            <div style={{ fontSize: 12, letterSpacing: 1.3, textTransform: "uppercase", color: PAL.muted, fontWeight: 800 }}>
              Register progress
            </div>
            <div style={{ fontSize: 40, fontWeight: 800, color: PAL.accent, lineHeight: 1.1 }}>{reg.percent}%</div>
            <div style={{ height: 6, background: PAL.line, borderRadius: 4, overflow: "hidden", margin: "6px 0 6px auto", width: 220 }}>
              <div style={{ width: `${reg.percent}%`, height: "100%", background: PAL.accent }} />
            </div>
            {frame.event.goal.target > 0 && (
              <div style={{ fontSize: 14, color: PAL.muted }}>
                {frame.event.goal.completed} of {frame.event.goal.target} Registers fulfilled
              </div>
            )}
          </div>
        </div>
      )}

      {/* An item funded: a notice above the strip. */}
      {showing && !full && text && (
        <div className="flash" style={{
          position: "absolute", left: 40, top: 18,
          background: PAL.accent, color: PAL.ink, borderRadius: 14,
          padding: "12px 22px", fontSize: 22, fontWeight: 800,
        }}>
          {text.headline}
        </div>
      )}

      {/* A register fully funded. Never "delivered": delivery is private
          between Kradel and a mother. */}
      {showing?.type === "REGISTER_COMPLETE" && text && (
        <div className="flash" style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "linear-gradient(90deg, rgba(11,18,16,0.92), rgba(26,122,94,0.92), rgba(11,18,16,0.92))",
        }}>
          <div style={{ fontSize: 22, letterSpacing: 3, textTransform: "uppercase", color: PAL.accent, fontWeight: 800 }}>
            {text.line}
          </div>
          <div style={{ fontSize: 56, fontWeight: 800, marginTop: 6 }}>{text.headline}</div>
        </div>
      )}

      {/* The sponsor beat: its own moment, naming no mother. The sponsor line
          shows only while the sponsor is confirmed (it is null otherwise). */}
      {showing?.type === "BUNDLE_UNLOCKED" && text && (
        <div className="flash" style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "linear-gradient(90deg, rgba(11,18,16,0.92), rgba(120,90,20,0.9), rgba(11,18,16,0.92))",
        }}>
          <div style={{ fontSize: 22, letterSpacing: 3, textTransform: "uppercase", color: PAL.warm, fontWeight: 800 }}>
            {text.headline}
          </div>
          {text.line && <div style={{ fontSize: 48, fontWeight: 800, marginTop: 6 }}>{text.line}</div>}
        </div>
      )}
    </div>
  );
}
