import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveEventByToken } from "@/lib/fundraisingEvent";
import { isRegisterPickable } from "@/lib/registers";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Set which register the host currently has on screen, so the broadcast overlay
// can show it. Authorised by the host's own bearer token — the same credential
// that opens their dashboard.
//
// THE REGISTER MUST BE PICKABLE. A host could otherwise put any register id in
// this field and the overlay would surface a mother who never consented to
// appearing in a fundraising event. isRegisterPickable (lib/registers) is the
// same rule as the host's list — current-wording consent, ACTIVE, under 30%
// funded — checked at the moment of featuring rather than assumed from
// whatever the dashboard happened to be displaying. The register already on
// screen is the one exception: re-sending it is a no-op.
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

  // Already on screen: nothing to change. A register that has since crossed
  // 30% (or whose mother withdrew) stays up until the host moves on, so
  // re-sending it must not be refused.
  if (registerId === event.currentRegisterId) {
    return NextResponse.json({ ok: true, currentRegisterId: registerId });
  }

  // The pick check, live, rather than trusted from the client
  // (lib/registers isRegisterPickable): current-wording consent
  // (lib/featureConsent), ACTIVE, and under 30% funded (lib/eventProgress).
  // This is the only check while a register is featured — once on screen it
  // stays until the host moves on. Once moved on, a register at 30% or more
  // can't be picked again.
  if (!(await isRegisterPickable(registerId))) {
    return NextResponse.json(
      { error: "That register can't be featured now — she may have turned featuring off, or it's already 30% funded or more." },
      { status: 409 },
    );
  }

  await prisma.fundraisingEvent.update({
    where: { id: event.id },
    data:  { currentRegisterId: registerId },
  });

  return NextResponse.json({ ok: true, currentRegisterId: registerId });
}
