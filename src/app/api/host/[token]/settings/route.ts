import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveEventByToken } from "@/lib/fundraisingEvent";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { raiseGoal } from "@/lib/eventRecap";

export const dynamic = "force-dynamic";

// Host settings that apply during a stream. Authorised by the host's bearer
// token, with the same uniform 404 as the other host routes.
//
// hideDonorNames: when on, no donor name appears on the overlay. It is read
// when each celebration is SHOWN (lib/overlayFrame), so switching it on
// mid-stream removes names from everything still queued, and switching it
// off lets names show again for whatever is still to come.
//
// goalRegisters: the event goal in Registers fully funded. The host may raise
// it during the event, never lower it, and never below the Registers already
// fully funded in this event (lib/eventRecap raiseGoal, checked atomically).
//
// Either field or both; anything else is ignored.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const rl = rateLimit(`host-settings:${getClientIp(req)}`, 60, 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const { token } = await params;
  const event = await resolveEventByToken(token);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const hasNames = body?.hideDonorNames !== undefined;
  const hasGoal  = body?.goalRegisters  !== undefined;
  if (!hasNames && !hasGoal) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }
  if (hasNames && typeof body.hideDonorNames !== "boolean") {
    return NextResponse.json({ error: "hideDonorNames must be true or false" }, { status: 400 });
  }

  // The goal first: if it is refused, nothing else changes either.
  if (hasGoal) {
    const r = await raiseGoal(event.id, body.goalRegisters);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  }
  if (hasNames) {
    await prisma.fundraisingEvent.update({ where: { id: event.id }, data: { hideDonorNames: body.hideDonorNames } });
  }

  const now = await prisma.fundraisingEvent.findUnique({
    where:  { id: event.id },
    select: { hideDonorNames: true, goalRegisters: true },
  });
  return NextResponse.json({ ok: true, hideDonorNames: now?.hideDonorNames, goalRegisters: now?.goalRegisters });
}
