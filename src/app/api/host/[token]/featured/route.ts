import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveEventByToken } from "@/lib/fundraisingEvent";
import { fetchFeaturableRegisters } from "@/lib/registers";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Set which register the host currently has on screen, so the broadcast overlay
// can show it. Authorised by the host's own bearer token — the same credential
// that opens their dashboard.
//
// THE REGISTER MUST BE IN THE LIVE FEATURABLE POOL. A host could otherwise put
// any register id in this field and the overlay would surface a mother who never
// consented to appearing in a fundraising event. Validating against
// fetchFeaturableRegisters — the same function everything else in this feature
// reads — means consent is re-checked at the moment of featuring rather than
// assumed from whatever the dashboard happened to be displaying.
//
// Passing null clears it, which is what the dashboard's "Clear" does.

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const rl = rateLimit(`host-featured:${getClientIp(req)}`, 120, 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const { token } = await params;

  // Same uniform failure as every other host route: missing, malformed, revoked,
  // expired and ENDED all arrive as null and leave as the same 404.
  const event = await resolveEventByToken(token);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const registerId = body?.registerId;

  if (registerId === null || registerId === undefined) {
    await prisma.fundraisingEvent.update({
      where: { id: event.id },
      data:  { currentRegisterId: null },
    });
    return NextResponse.json({ ok: true, currentRegisterId: null });
  }

  if (typeof registerId !== "string") {
    return NextResponse.json({ error: "registerId must be a string or null" }, { status: 400 });
  }

  // Consent re-checked here, live, against the pool rather than trusted from the
  // client. A register that has had consent withdrawn since the dashboard loaded
  // cannot be put on screen.
  const pool = await fetchFeaturableRegisters();
  if (!pool.some((r) => r.id === registerId)) {
    return NextResponse.json(
      { error: "That register isn't available to feature — she may have turned featuring off." },
      { status: 409 },
    );
  }

  await prisma.fundraisingEvent.update({
    where: { id: event.id },
    data:  { currentRegisterId: registerId },
  });

  return NextResponse.json({ ok: true, currentRegisterId: registerId });
}
