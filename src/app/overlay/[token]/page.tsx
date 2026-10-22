"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { OverlayFrame } from "@/lib/overlayFrame";
import type { PublicCelebration } from "@/lib/publicCelebration";
import OverlayStage, { STAGE_W } from "@/components/overlay/OverlayStage";

// The broadcast overlay. Added to the host's streaming software as a
// full-frame browser source (1920×1080) and composited over the host's video;
// everything is drawn in the bottom band (components/overlay/OverlayStage).
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

const POLL_MS = 3000;
// How long a celebration stays up; the next one is claimed after this.
const SHOW_MS: Record<PublicCelebration["type"], number> = {
  ITEM_FUNDED: 6000, ITEM_FUNDED_BY_ONE: 6000, REGISTER_COMPLETE: 9000, BUNDLE_UNLOCKED: 9000,
};

export default function OverlayPage() {
  const { token } = useParams<{ token: string }>();

  const [frame, setFrame] = useState<OverlayFrame | null>(null);
  const [ended, setEnded] = useState(false);
  const [showing, setShowing] = useState<PublicCelebration | null>(null);
  const showingRef = useRef(false);
  // The stage is drawn at 1920 wide; a narrower window scales it down whole.
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(1, window.innerWidth / STAGE_W));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

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

  // A browser source composited over video: no page background, no
  // scrollbars. The site header, footer and other chrome skip /overlay
  // themselves (lib/chromeless).
  const page = <style>{`html, body { background: transparent !important; margin: 0; max-width: none !important; overflow: hidden; }`}</style>;
  if (ended || !frame) return page;

  return (
    <>
      {page}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "transparent" }}>
        <OverlayStage frame={frame} showing={showing} scale={scale} />
      </div>
    </>
  );
}
