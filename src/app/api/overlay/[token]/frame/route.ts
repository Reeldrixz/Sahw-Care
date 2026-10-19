import { NextRequest, NextResponse } from "next/server";
import { resolveEventByToken } from "@/lib/fundraisingEvent";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { buildOverlayFrame } from "@/lib/overlayFrame";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

// The broadcast overlay's data: polled every few seconds by /overlay/[token]
// (a browser source in the host's streaming software). No websockets, no
// server-sent stream — a plain poll, which a dropped connection simply
// resumes.
//
// POST, not GET, because a poll with { claim: true } changes state: it claims
// the next celebration (lib/overlayFrame). A GET could be prefetched, cached
// or retried by something other than the overlay.
//
// Authorised by the event's bearer token in the URL, like the host routes:
// missing, malformed, revoked, expired and ENDED all get the same 404.
// Everything returned is in lib/overlayFrame's public shape — no ids, no full
// names, no dollar total.
export async function POST(req: NextRequest, { params }: Params) {
  // One overlay polls about every 3s; this leaves ample room and still stops
  // a scanner hammering the token lookup.
  const rl = rateLimit(`overlay-frame:${getClientIp(req)}`, 120, 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const { token } = await params;
  const event = await resolveEventByToken(token);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const frame = await buildOverlayFrame(event.id, { claim: body?.claim === true });
  if (!frame) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(frame, { headers: { "Cache-Control": "no-store" } });
}
