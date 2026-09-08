import { NextRequest, NextResponse } from "next/server";
import { resolveEventByToken } from "@/lib/fundraisingEvent";
import { fetchFeaturableRegisters } from "@/lib/registers";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// The host dashboard read. No Kradel account — the bearer token in the URL is
// the entire authorisation.
//
// WHAT A HOST CAN SEE, STRUCTURALLY. The register pool comes from
// fetchFeaturableRegisters(), which re-fetches each row through
// fetchPublicRegister — the same function powering the public /r/[id] share
// page. So a host sees exactly what anyone holding a register's link already
// sees: first name only, items, prices, funding progress. No surname, no
// contact details, no address; shipmentAddress is not selected anywhere in that
// path.
//
// That is a property of reusing the function, not of remembering to strip
// fields here. If this route ever grows its own select for performance, the
// guarantee evaporates — add aggregates ALONGSIDE the call, never instead of it.
//
// THE POOL IS READ LIVE on every request. Nothing is cached and nothing is
// pinned to the event. If a mother revokes consent mid-stream she is gone from
// the next call, which is the entire reason the featurable pool is a query
// rather than a stored list.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // A 128-bit token is not brute-forceable, but rate limiting costs nothing and
  // means a scanner cannot hammer the lookup either.
  const rl = rateLimit(`host-read:${getClientIp(req)}`, 120, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const { token } = await params;

  // One lookup, one failure mode. Missing, malformed, revoked, expired and
  // ENDED all arrive here as null, and all leave as the same 404 — a probe
  // learns nothing about which of those was true, or whether the event exists.
  const event = await resolveEventByToken(token);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const registers = await fetchFeaturableRegisters();

  return NextResponse.json({
    event: {
      title:     event.title,
      hostName:  event.hostName,
      goalCents: event.goalCents,
      status:    event.status,
      startedAt: event.startedAt,
    },
    registers,
    // Returned so a dashboard can show "as of", and so it is obvious in the
    // payload that this is a live read rather than something cached.
    fetchedAt: new Date().toISOString(),
  });
}
