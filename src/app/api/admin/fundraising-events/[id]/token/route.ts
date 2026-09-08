import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateEventToken } from "@/lib/fundraisingEvent";

export const dynamic = "force-dynamic";

// Issue or revoke a host access token on a fundraising event. Admin only.
//
// POST   — issue a fresh token (also rotates: issuing again replaces the old
//          one, and the previous value stops working immediately because it no
//          longer exists in the table)
// DELETE — revoke: null the token so the credential ceases to exist
//
// THE TOKEN IS RETURNED EXACTLY ONCE, on issue. It is stored in the clear
// because it must be resolvable by lookup, but the admin UI should treat the
// response as the only chance to copy it — re-reading an event elsewhere will
// not surface it, and losing it means rotating rather than recovering.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const event = await prisma.fundraisingEvent.findUnique({
    where:  { id },
    select: { id: true, status: true, accessToken: true },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // An ended event's link would be refused by resolveEventByToken anyway.
  // Refusing here too means we never mint a credential that cannot work —
  // better than handing someone a link and letting them discover it is dead.
  if (event.status === "ENDED") {
    return NextResponse.json(
      { error: "This event has ended. Issuing a link would create one that cannot be used." },
      { status: 400 }
    );
  }

  // Optional expiry. A stream ends; the link should not outlive it. Accepted as
  // an ISO date or a number of hours, because "24 hours from now" is what an
  // admin actually wants to express before a broadcast.
  let tokenExpiresAt: Date | null = null;
  if (typeof body?.expiresInHours === "number" && body.expiresInHours > 0) {
    tokenExpiresAt = new Date(Date.now() + body.expiresInHours * 60 * 60 * 1000);
  } else if (typeof body?.expiresAt === "string") {
    const d = new Date(body.expiresAt);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid expiresAt" }, { status: 400 });
    }
    tokenExpiresAt = d;
  }

  const accessToken = generateEventToken();

  await prisma.fundraisingEvent.update({
    where: { id },
    data: {
      accessToken,
      tokenIssuedAt:  new Date(),
      tokenExpiresAt,
      // Clear any previous revocation: this event now has a live link again.
      tokenRevokedAt: null,
    },
  });

  return NextResponse.json({
    accessToken,
    tokenExpiresAt,
    rotated: !!event.accessToken,
    note: "Copy this now — it is shown once. Re-issuing rotates and invalidates the previous link.",
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Revocation NULLS the token rather than marking it dead in place. A token
  // still stored is a token that can still leak — from a backup, a log, a
  // screenshot of an admin screen. Nulling means the credential ceases to
  // exist. tokenRevokedAt keeps "revoked" distinguishable from "never issued".
  const { count } = await prisma.fundraisingEvent.updateMany({
    where: { id },
    data:  { accessToken: null, tokenRevokedAt: new Date() },
  });
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, revoked: true });
}
