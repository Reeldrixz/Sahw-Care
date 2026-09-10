import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Move a fundraising event through its lifecycle. Admin only.
//
// This is a TRANSITION endpoint, not a status setter. The difference matters:
// an endpoint that accepts a status and writes it is one typo away from
// reopening an event whose results were already reported. Only the pairs below
// are possible, and anything else is refused by name.
//
//   DRAFT -> LIVE     the event starts; startedAt is stamped
//   DRAFT -> ENDED    cancelled before it ever ran; startedAt stays null
//   LIVE  -> ENDED    the event finishes
//
// ENDED IS TERMINAL. Results freeze there, and reopening would let numbers move
// after they had been reported to an audience. An event that needs to run again
// is a new event, not a resurrected one.
//
// LIVE -> DRAFT is refused for the same reason in miniature: an event that has
// been live has been seen, and pretending otherwise makes the record a worse
// description of what happened than no record at all.

type Status = "DRAFT" | "LIVE" | "ENDED";

// The whole rule set, as data. Reading this tells you the entire lifecycle,
// which is not true of the same logic spread through if-statements.
const ALLOWED: Record<Status, Status[]> = {
  DRAFT: ["LIVE", "ENDED"],
  LIVE:  ["ENDED"],
  ENDED: [], // terminal
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const target = body?.status as Status | undefined;

  if (target !== "DRAFT" && target !== "LIVE" && target !== "ENDED") {
    return NextResponse.json(
      { error: "status must be one of: DRAFT, LIVE, ENDED" },
      { status: 400 }
    );
  }

  const event = await prisma.fundraisingEvent.findUnique({
    where:  { id },
    select: { id: true, status: true, startedAt: true, accessToken: true },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const current = event.status as Status;

  // Idempotent: asking for the state it is already in is a no-op success, not
  // an error. A retried request after a dropped response should not look like a
  // failure to the caller.
  if (current === target) {
    return NextResponse.json({ ok: true, status: current, unchanged: true });
  }

  if (!ALLOWED[current].includes(target)) {
    return NextResponse.json(
      {
        error:
          current === "ENDED"
            ? "This event has ended. That is final — results freeze at the end of an event, and an event that needs to run again is a new one."
            : `Cannot move an event from ${current} to ${target}.`,
        from: current,
        to:   target,
        allowed: ALLOWED[current],
      },
      { status: 409 }
    );
  }

  const now = new Date();

  const data: Record<string, unknown> = { status: target };

  // startedAt is stamped ONCE. Guarded rather than assigned, so no later
  // transition can rewrite when the event actually began — that timestamp is
  // the anchor for anything reported about the event afterwards.
  if (target === "LIVE" && !event.startedAt) {
    data.startedAt = now;
  }

  if (target === "ENDED") {
    data.endedAt = now;

    // Ending REVOKES the host link, by nulling it. resolveEventByToken already
    // refuses an ENDED event, so the link is functionally dead either way — but
    // a token that is still stored is a token that can still leak, from a
    // backup, a log, or a screenshot of an admin screen. Nulling it means the
    // credential stops existing at the moment it stops being useful, and
    // "ended" can never drift apart from "no live credential".
    //
    // Same mechanism as the manual revoke: null the value, stamp the date so
    // "revoked" stays distinguishable from "never issued".
    if (event.accessToken) {
      data.accessToken    = null;
      data.tokenRevokedAt = now;
    }
  }

  // Conditional on the status we read, so two concurrent transitions cannot
  // both apply. The loser sees the same 409 as an illegal transition, because
  // from its point of view that is exactly what happened.
  const { count } = await prisma.fundraisingEvent.updateMany({
    where: { id, status: current },
    data,
  });

  if (count === 0) {
    return NextResponse.json(
      { error: "The event changed while this request was in flight. Re-read it and try again." },
      { status: 409 }
    );
  }

  const updated = await prisma.fundraisingEvent.findUnique({
    where:  { id },
    select: { id: true, title: true, status: true, startedAt: true, endedAt: true, accessToken: true },
  });

  return NextResponse.json({
    ok: true,
    status: target,
    startedAt: updated?.startedAt ?? null,
    endedAt:   updated?.endedAt ?? null,
    // Surfaced so an admin sees that ending killed the link, rather than
    // discovering later that a link they shared has stopped working.
    tokenRevoked: target === "ENDED" && !!event.accessToken,
    hasLiveToken: !!updated?.accessToken,
  });
}
