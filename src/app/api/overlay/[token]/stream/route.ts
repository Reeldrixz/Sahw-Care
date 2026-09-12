import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveEventByToken } from "@/lib/fundraisingEvent";
import { fetchFeaturableRegisters } from "@/lib/registers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

// The broadcast overlay's data stream.
//
// Built on the pattern already proven in this deployment by
// api/circles/[id]/stream: Node runtime, ReadableStream of text/event-stream,
// server-side poll pushing deltas, heartbeat, and a deliberate self-close so the
// client's EventSource reconnects rather than fighting the platform's function
// duration cap.
//
// WHY SSE AND NOT WEBSOCKETS: the overlay is read-only, so bidirectional buys
// nothing, and EventSource reconnects for free where a socket needs manual
// lifecycle code. Neon cannot push either way — LISTEN/NOTIFY needs a direct
// non-pooled connection — so change detection is a poll regardless of transport.
// SSE only moves the poll from the client to here, which at ONE consumer (a
// browser source on the host's machine) is the entire benefit: ~24 connections
// over a two-hour stream instead of ~3,600 client invocations.
//
// THE MARKER MAKES THE POLL CHEAP. Every 2s this reads one indexed integer —
// FundraisingEvent.contributionCounter — and only recomputes the aggregate and
// the register pool when it has moved. An idle broadcast costs almost nothing.
//
// WHAT THIS SENDS IS A SUBSET OF THE PUBLIC SHAPE, DELIBERATELY NARROWER. The
// overlay is ON the broadcast: whatever it renders is seen by the whole audience,
// not by one host. The consent copy is the display spec — "your first name,
// Register items, and information you've chosen to share" — so first name, item
// names, prices and progress, and nothing else. City is in the public shape and
// is withheld here: first name plus city plus visible need is aggregate-
// identifying at broadcast scale, which is a different exposure from a link
// recipient reading the same page. The highest-exposure surface shows less than
// it is allowed to.
//
// Registers come only from fetchFeaturableRegisters -> fetchPublicRegister. This
// route builds no select of its own, so it cannot widen what is visible.

const POLL_MS      = 2_000;
const HEARTBEAT_MS = 20_000;
const CLOSE_MS     = 55_000; // self-close; EventSource reconnects

interface OverlayItem {
  id: string;
  name: string;
  priceCents: number;
  fundedCents: number;
  // FUNDED covers FULLY_FUNDED and IN_FULFILLMENT. ORDERED is set only from a
  // real FulfillmentQueue purchase record. DISPATCHED and DELIVERED are never
  // represented: delivery is a private moment between Kradel and a mother, and a
  // broadcast claim that something arrived could be wrong while a courier still
  // has it.
  state: "NEEDED" | "FUNDED" | "ORDERED";
}

interface OverlayRegister {
  id: string;
  firstName: string; // no surname, no city — see the note above
  title: string;
  items: OverlayItem[];
  allFunded: boolean;
}

async function buildFrame(eventId: string, currentRegisterId: string | null) {
  // Attributed total only: sum of CONFIRMED contributions carrying this event id.
  // Refunds drop out with no decrement logic because REFUNDED is simply not
  // CONFIRMED. This is a FLOOR — an untagged contribution during the broadcast is
  // not counted, which is why the label is "raised through this event" and never
  // "raised tonight".
  const agg = await prisma.registerItemFunding.aggregate({
    where:  { fundraisingEventId: eventId, status: "CONFIRMED" },
    _sum:   { amountCents: true },
    _count: true,
  });

  const pool = await fetchFeaturableRegisters();

  // The featured register is re-resolved against the LIVE pool every frame, so a
  // mother who revokes consent mid-broadcast drops off the overlay on the next
  // frame rather than persisting because an id was stored.
  const featured = currentRegisterId
    ? pool.find((r) => r.id === currentRegisterId) ?? null
    : null;

  const purchasedIds = featured
    ? new Set(
        (await prisma.fulfillmentQueue.findMany({
          where:  { registerItemId: { in: featured.items.map((i) => i.id) }, status: { in: ["PURCHASED", "DISPATCHED", "DELIVERED"] } },
          select: { registerItemId: true },
        })).map((q) => q.registerItemId),
      )
    : new Set<string>();

  const register: OverlayRegister | null = featured
    ? {
        id:        featured.id,
        firstName: featured.firstName,
        title:     featured.title,
        items: featured.items.map((i) => ({
          id:          i.id,
          name:        i.name,
          priceCents:  i.standardPriceCents,
          fundedCents: i.totalFundedCents,
          // ORDERED wins over FUNDED: once Kradel has actually bought it, that is
          // the truer and stronger claim. Note it is driven by a purchase record,
          // not by funding completion — "it's funded" and "we bought it" are
          // different statements and only one of them is about Kradel acting.
          state: purchasedIds.has(i.id)
            ? "ORDERED"
            : (i.fundingStatus === "FULLY_FUNDED" || i.fundingStatus === "IN_FULFILLMENT" || i.fundingStatus === "FULFILLED")
              ? "FUNDED"
              : "NEEDED",
        })),
        allFunded: featured.items.length > 0 && featured.items.every(
          (i) => i.fundingStatus !== "UNFUNDED" && i.fundingStatus !== "PARTIAL",
        ),
      }
    : null;

  return {
    raisedThroughEventCents: agg._sum.amountCents ?? 0,
    contributionCount:       agg._count,
    register,
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;

  // Uniform failure, same as every host route: missing, malformed, revoked,
  // expired and ENDED all become the same 404.
  const event = await resolveEventByToken(token);
  if (!event) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (data: unknown) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); }
        catch { closed = true; }
      };

      let lastCounter = -1;

      // HYDRATE vs DELTA is the whole defence against re-celebrating. This stream
      // self-closes every 55s and EventSource reconnects, so a client that derived
      // "this row is FUNDED, therefore animate" from STATE would replay every
      // celebration roughly once a minute for the length of the broadcast. The
      // first frame after any connect is marked hydrate and must be seeded
      // silently; only delta frames animate.
      const first = await prisma.fundraisingEvent.findUnique({
        where:  { id: event.id },
        select: { contributionCounter: true, currentRegisterId: true },
      });
      lastCounter = first?.contributionCounter ?? 0;
      send({
        type: "hydrate",
        event: { title: event.title, hostName: event.hostName, goalCents: event.goalCents, status: event.status },
        ...(await buildFrame(event.id, first?.currentRegisterId ?? null)),
      });

      const poll = setInterval(async () => {
        if (closed) { clearInterval(poll); return; }
        try {
          // One indexed row. The aggregate and the pool are only touched when
          // something actually changed — except currentRegisterId, which must be
          // watched too so featuring a different register updates the strip even
          // with no new money.
          const marker = await prisma.fundraisingEvent.findUnique({
            where:  { id: event.id },
            select: { contributionCounter: true, currentRegisterId: true, status: true },
          });
          if (!marker) return;

          // An event ended mid-stream: tell the client and stop. The overlay
          // should not keep showing a live total for a finished event.
          if (marker.status === "ENDED") {
            send({ type: "ended" });
            closed = true;
            clearInterval(poll);
            try { controller.close(); } catch {}
            return;
          }

          const changed = marker.contributionCounter !== lastCounter;
          lastCounter = marker.contributionCounter;

          // currentRegisterId is cheap to include every frame; the register strip
          // needs to follow the host promptly when they feature something new.
          send({ type: "delta", changed, ...(await buildFrame(event.id, marker.currentRegisterId)) });
        } catch {
          // DB hiccup — never crash the stream.
        }
      }, POLL_MS);

      const heartbeat = setInterval(() => send({ type: "ping" }), HEARTBEAT_MS);

      const timeout = setTimeout(() => {
        closed = true;
        clearInterval(poll); clearInterval(heartbeat);
        try { controller.close(); } catch {}
      }, CLOSE_MS);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(poll); clearInterval(heartbeat); clearTimeout(timeout);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-transform",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
