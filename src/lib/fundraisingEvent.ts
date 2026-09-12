import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

// Host access to a fundraising event.
//
// A host has no Kradel account. The only thing standing between the public and
// an event dashboard is the bearer token in their link, so everything about how
// that token is generated, checked and refused lives here — in one file, with
// one lookup function, rather than spread across the routes that need it.

// 16 random bytes, hex. ~128 bits, deliberately stronger than the ~39-bit
// ReferralCode: that is handed to one mother and consumed once, whereas an
// event link may be pasted into a chat, stay live for hours, and grant a broad
// read. The kevt_ prefix makes it recognisable in logs and support requests.
//
// This format is documented in the schema comment on FundraisingEvent.accessToken.
// If it changes, change it there too — that comment is the only thing keeping
// the two descriptions honest.
export function generateEventToken(): string {
  return `kevt_${randomBytes(16).toString("hex")}`;
}

/**
 * Resolve an event SLUG to an id for attributing a contribution, or null.
 *
 * Used by both fund routes. Three rules, each deliberate:
 *
 * 1. IT NEVER FAILS A PAYMENT. An unknown slug, a malformed one, or an event
 *    that is not LIVE all return null, and the caller records null and takes the
 *    money. Attribution is bookkeeping; losing a contribution because the
 *    bookkeeping did not resolve would be the same mistake as putting a donor
 *    counter inside the money-recording transaction.
 *
 * 2. IT ONLY ATTRIBUTES WHILE LIVE. A stale link used weeks later must not land
 *    in an ended event's total, and a DRAFT event has not started. This is also
 *    the backstop for persisting the tag in sessionStorage — a tag that outlives
 *    the broadcast attributes nothing.
 *
 * 3. IT TAKES THE SLUG, NEVER THE TOKEN. The slug grants nothing and is safe in
 *    a viewer-facing URL. The kevt_ token is the host's dashboard credential and
 *    must never reach a viewer.
 */
export async function resolveEventIdForAttribution(slug: unknown): Promise<string | null> {
  if (typeof slug !== "string") return null;
  const s = slug.trim().toLowerCase();
  if (!s || s.length > 80) return null;

  const event = await prisma.fundraisingEvent.findUnique({
    where:  { slug: s },
    select: { id: true, status: true },
  });
  if (!event || event.status !== "LIVE") return null;
  return event.id;
}

export interface HostEvent {
  id: string;
  title: string;
  hostName: string;
  goalCents: number;
  status: "DRAFT" | "LIVE" | "ENDED";
  startedAt: Date | null;
}

/**
 * Resolve an event from a host token, or null.
 *
 * FAILS UNIFORMLY AND FAIL-CLOSED. Every rejection path returns exactly null:
 *
 *   - no token, or a token of the wrong shape
 *   - no event carries that token
 *   - the token was revoked (the column is nulled, so it simply is not found)
 *   - tokenExpiresAt has passed
 *   - the event status is ENDED
 *
 * The caller cannot distinguish these, so probing this endpoint tells an
 * attacker nothing beyond "not valid" — the same instinct as
 * lookupRedeemableCode, where missing, used, revoked, expired and inactive all
 * collapse to one answer.
 *
 * THIS FUNCTION IS WHERE THREE COLUMNS BECOME REAL. tokenExpiresAt, tokenRevokedAt
 * and status: "ENDED" are inert data until something enforces them. Every host
 * route must go through here rather than querying accessToken directly, or those
 * columns quietly become decorative.
 */
export async function resolveEventByToken(token: string | undefined | null): Promise<HostEvent | null> {
  if (!token || typeof token !== "string") return null;
  // Cheap shape check before touching the database. Not a security control —
  // the lookup below is — but it keeps malformed input off the query.
  if (!/^kevt_[0-9a-f]{32}$/.test(token)) return null;

  const event = await prisma.fundraisingEvent.findUnique({
    where: { accessToken: token },
    select: {
      id: true, title: true, hostName: true, goalCents: true,
      status: true, startedAt: true,
      tokenExpiresAt: true, tokenRevokedAt: true,
    },
  });

  if (!event) return null;

  // Defensive: revocation nulls accessToken, so a revoked token should already
  // have failed the lookup. Checked anyway, because a future code path that
  // revokes by stamping the date without clearing the token would otherwise
  // leave the link working, and that failure would be silent.
  if (event.tokenRevokedAt) return null;

  if (event.tokenExpiresAt && event.tokenExpiresAt.getTime() <= Date.now()) return null;

  // An ended event's link stops working. The results snapshot is a separate
  // surface; the live dashboard is not it.
  if (event.status === "ENDED") return null;

  return {
    id: event.id,
    title: event.title,
    hostName: event.hostName,
    goalCents: event.goalCents,
    status: event.status,
    startedAt: event.startedAt,
  };
}
