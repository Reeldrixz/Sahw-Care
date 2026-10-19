import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveEventByToken } from "@/lib/fundraisingEvent";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Host settings that apply during a stream. Authorised by the host's bearer
// token, with the same uniform 404 as the other host routes.
//
// hideDonorNames: when on, no donor name appears on the overlay. It is read
// when each celebration is SHOWN (lib/overlayFrame), so switching it on
// mid-stream removes names from everything still queued, and switching it
// off lets names show again for whatever is still to come.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const rl = rateLimit(`host-settings:${getClientIp(req)}`, 60, 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const { token } = await params;
  const event = await resolveEventByToken(token);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (typeof body?.hideDonorNames !== "boolean") {
    return NextResponse.json({ error: "hideDonorNames must be true or false" }, { status: 400 });
  }

  const updated = await prisma.fundraisingEvent.update({
    where:  { id: event.id },
    data:   { hideDonorNames: body.hideDonorNames },
    select: { hideDonorNames: true },
  });
  return NextResponse.json({ ok: true, hideDonorNames: updated.hideDonorNames });
}
