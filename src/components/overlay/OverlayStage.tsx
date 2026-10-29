import type { OverlayFrame, OverlayItem } from "@/lib/overlayFrame";
import { celebrationText, recapText, type PublicCelebration } from "@/lib/publicCelebration";

// What the broadcast overlay draws, as a pure function of the latest frame and
// the celebration on screen. The page (/overlay/[token]) does the polling; this
// only renders, so it can be rendered on its own to check the layout.
//
// LAYOUT. Drawn on a 1920×1080 stage — the stream's own frame — anchored to
// the bottom, and scaled down as a whole when the window is narrower than
// 1920 (scale < 1), so it never overflows sideways. Everything sits in the
// bottom band; the rest is transparent and shows the host's video.
//
// EVERY ITEM IS SHOWN. The item cards are a grid that wraps into up to three
// rows and gets more compact as the count grows; long item names wrap to two
// lines and are then cut with an ellipsis. Nothing is dropped, so the cards
// always agree with "N of M items funded".

export const STAGE_W = 1920;
export const STAGE_H = 1080;

export const PAL = {
  ink:    "#0b1210",
  panel:  "rgba(11,18,16,0.88)",
  line:   "rgba(255,255,255,0.12)",
  text:   "#f2f8f5",
  muted:  "#9fb8ae",
  accent: "#3fbf92",
  warm:   "#e3b341",
};

const money = (c: number) => `$${(c / 100).toFixed(0)}`;

// Rows and size for n cards: one row up to 4, two up to 12, then three.
function gridFor(n: number) {
  const rows = n <= 4 ? 1 : n <= 12 ? 2 : 3;
  return { rows, cols: Math.max(1, Math.ceil(n / rows)), compact: rows > 1 };
}

const twoLines = {
  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
  overflow: "hidden", overflowWrap: "anywhere" as const, lineHeight: 1.2,
};

function ItemCard({ item, compact }: { item: OverlayItem; compact: boolean }) {
  const done = item.state !== "NEEDED";
  return (
    <div className="row" style={{
      minWidth: 0, borderRadius: 12, padding: compact ? "8px 10px" : "12px 14px",
      background: done ? "rgba(63,191,146,0.12)" : "rgba(255,255,255,0.05)",
      border: `1px solid ${done ? PAL.accent : PAL.line}`,
      display: "flex", flexDirection: "column", justifyContent: "space-between", gap: compact ? 4 : 8,
    }}>
      <div style={{ ...twoLines, fontSize: compact ? 15 : 17, fontWeight: 700 }}>{item.name}</div>
      {done ? (
        <div style={{ fontSize: compact ? 13 : 15, fontWeight: 800, color: PAL.accent }}>
          {item.state === "DELIVERED" ? "Delivered ✓" : item.state === "ORDERED" ? "Order placed ✓" : "Funded ✓"}
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", columnGap: 8, fontSize: compact ? 13 : 15 }}>
          <span style={{ color: PAL.muted }}>{money(item.fundedCents)} / {money(item.priceCents)}</span>
          <span style={{ color: PAL.warm, fontWeight: 800 }}>{money(item.remainingCents)} to go</span>
        </div>
      )}
    </div>
  );
}

export default function OverlayStage({ frame, showing, scale = 1 }: {
  frame: OverlayFrame;
  showing: PublicCelebration | null;
  scale?: number;
}) {
  const reg  = frame.register;
  const full = showing && (showing.type === "REGISTER_COMPLETE" || showing.type === "BUNDLE_UNLOCKED");
  const text = showing ? celebrationText(showing) : null;
  // Needed items first, then funded and ordered ones, keeping each group's order.
  const items = reg ? [...reg.items.filter((i) => i.state === "NEEDED"), ...reg.items.filter((i) => i.state !== "NEEDED")] : [];
  const grid = gridFor(items.length);

  return (
    <div style={{
      position: "absolute", left: 0, bottom: 0, width: STAGE_W, height: STAGE_H,
      transform: `scale(${scale})`, transformOrigin: "bottom left",
      background: "transparent", overflow: "hidden",
      fontFamily: "Nunito, system-ui, sans-serif", color: PAL.text,
    }}>
      <style>{`
        @keyframes slideUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes popIn   { from { opacity:0; transform:scale(0.92) }      to { opacity:1; transform:scale(1) } }
        .row { animation: slideUp .45s cubic-bezier(.2,.8,.2,1) both; }
        .flash { animation: popIn .3s ease both; }
      `}</style>

      {/* The bottom band: the item notice sits on top of the strip. */}
      <div style={{ position: "absolute", left: 40, right: 40, bottom: 28, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14 }}>
        {/* An item funded: a notice above the strip. */}
        {showing && !full && text && (
          <div className="flash" style={{
            background: PAL.accent, color: PAL.ink, borderRadius: 14,
            padding: "12px 22px", fontSize: 22, fontWeight: 800, maxWidth: "100%",
          }}>
            {text.headline}
          </div>
        )}

        {/* The recap: registers completed earlier in this event, one line,
            small and muted — secondary to the active register below it. */}
        {frame.recap.entries.length > 0 && !full && (
          <div data-recap style={{
            maxWidth: "100%", boxSizing: "border-box", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            background: "rgba(11,18,16,0.6)", borderRadius: 10, padding: "6px 14px",
            fontSize: 14, color: PAL.muted,
          }}>
            <span style={{ fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", fontSize: 11, marginRight: 10 }}>Earlier this event</span>
            {frame.recap.entries.map(recapText).join("  ·  ")}
            {frame.recap.more > 0 && `  ·  +${frame.recap.more} more`}
          </div>
        )}

        {/* The persistent strip: who is being helped, her items, the progress. */}
        {reg && !full && (
          <div data-strip style={{
            alignSelf: "stretch", boxSizing: "border-box",
            background: PAL.panel, border: `1px solid ${PAL.line}`, borderRadius: 18,
            padding: grid.compact ? "14px 20px" : "18px 24px",
            display: "flex", gap: 24, alignItems: "center",
            backdropFilter: "blur(8px)",
          }}>
            {/* First name only, or none if it fails the name rule; then her
                register's title, only as lib/publicCelebration liveRegisterTitle
                returns it (checked, at most 32 characters), on up to two lines. */}
            <div style={{ width: 220, flexShrink: 0 }}>
              <div style={{ fontSize: 13, letterSpacing: 1.4, textTransform: "uppercase", color: PAL.muted, fontWeight: 800 }}>
                Helping now
              </div>
              {/* Names run up to 20 characters: longer ones get a smaller size rather than a break mid-word. */}
              {reg.firstName && (
                <div style={{ fontSize: reg.firstName.length > 11 ? 24 : 34, fontWeight: 800, lineHeight: 1.1, marginTop: 2, overflowWrap: "break-word" }}>
                  {reg.firstName}
                </div>
              )}
              {reg.title && (
                <div style={{ ...twoLines, fontSize: 15, fontWeight: 700, color: PAL.text, marginTop: 3 }}>
                  {reg.title}
                </div>
              )}
              <div style={{ fontSize: 15, color: PAL.muted, marginTop: 4 }}>
                {reg.counts.funded} of {reg.counts.total} items funded
              </div>
            </div>

            <div data-items style={{
              flex: 1, minWidth: 0, display: "grid", gap: grid.compact ? 8 : 12,
              gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
            }}>
              {items.map((i, n) => <ItemCard key={`${n}-${i.name}`} item={i} compact={grid.compact} />)}
            </div>

            {/* Progress: this register, then the event's goal in registers. */}
            <div style={{ width: 240, flexShrink: 0, textAlign: "right" }}>
              <div style={{ fontSize: 12, letterSpacing: 1.3, textTransform: "uppercase", color: PAL.muted, fontWeight: 800 }}>
                Register progress
              </div>
              <div style={{ fontSize: 40, fontWeight: 800, color: PAL.accent, lineHeight: 1.1 }}>{reg.percent}%</div>
              <div style={{ height: 6, background: PAL.line, borderRadius: 4, overflow: "hidden", margin: "6px 0 6px auto", width: 220 }}>
                <div style={{ width: `${reg.percent}%`, height: "100%", background: PAL.accent }} />
              </div>
              {frame.event.goal.target > 0 && (
                <div style={{ fontSize: 14, color: PAL.muted }}>
                  {frame.event.goal.completed} of {frame.event.goal.target} Registers fully funded
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* A register fully funded: the bottom band, 300px, as before. Never
          "delivered": delivery is private between Kradel and a mother. */}
      {showing?.type === "REGISTER_COMPLETE" && text && (
        <div className="flash" style={{
          position: "absolute", left: 0, right: 0, bottom: 0, height: 300,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
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
          position: "absolute", left: 0, right: 0, bottom: 0, height: 300,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
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
