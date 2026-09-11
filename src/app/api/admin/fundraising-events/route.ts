import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Create a fundraising event. Admin only.
//
// Minimal on purpose: title, goalCents, hostName. Everything else has a sensible
// default — status is DRAFT, and no access token exists until one is explicitly
// issued through .../[id]/token. Creating an event does NOT mint a credential,
// because those are two different decisions and collapsing them means every
// created event carries a live link whether or not anyone meant it to.

const MAX_TITLE = 120;
const MAX_HOST  = 80;

/** URL-safe slug from a title. Not a credential — it authorises nothing. */
function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  return base || "event";
}

// List every event with enough state to operate it.
//
// THE TOKEN VALUE IS DELIBERATELY NOT RETURNED. Issuing says "copy this now —
// it is shown once", and that promise would be worthless if a routine list call
// handed the credential back on every admin page load. What an operator
// actually needs is whether a live link EXISTS, when it expires, and whether it
// was revoked — none of which requires seeing the secret. A lost token is
// rotated, not recovered.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.fundraisingEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, title: true, slug: true, hostName: true, goalCents: true,
      status: true, startedAt: true, endedAt: true, createdAt: true,
      // Presence only — never the value itself.
      accessToken: true,
      tokenIssuedAt: true, tokenExpiresAt: true, tokenRevokedAt: true,
    },
  });

  const now = Date.now();
  return NextResponse.json({
    events: rows.map(({ accessToken, ...e }) => ({
      ...e,
      hasToken: !!accessToken,
      // Computed here so the UI does not have to re-derive expiry rules that
      // resolveEventByToken already owns.
      tokenExpired: !!e.tokenExpiresAt && e.tokenExpiresAt.getTime() <= now,
    })),
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  const title    = typeof body?.title    === "string" ? body.title.trim()    : "";
  const hostName = typeof body?.hostName === "string" ? body.hostName.trim() : "";
  const goalRaw  = body?.goalCents;

  if (title.length < 3 || title.length > MAX_TITLE) {
    return NextResponse.json({ error: `Title must be 3–${MAX_TITLE} characters.` }, { status: 400 });
  }
  if (hostName.length < 2 || hostName.length > MAX_HOST) {
    return NextResponse.json({ error: `Host name must be 2–${MAX_HOST} characters.` }, { status: 400 });
  }
  // Explicit Number check rather than a truthy one, so a goal of 0 — a valid
  // "no target set" — is accepted instead of silently becoming the default.
  const goalCents =
    goalRaw === undefined || goalRaw === null
      ? 0
      : Number.isInteger(goalRaw) && goalRaw >= 0
        ? goalRaw
        : NaN;
  if (Number.isNaN(goalCents)) {
    return NextResponse.json({ error: "goalCents must be a non-negative whole number of cents." }, { status: 400 });
  }

  // Slug uniqueness is enforced by the database. Retry with a short random
  // suffix on collision rather than pre-checking, which would race.
  let slug = slugify(title);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const event = await prisma.fundraisingEvent.create({
        data: { title, hostName, goalCents, slug, status: "DRAFT" },
        select: { id: true, title: true, slug: true, hostName: true, goalCents: true, status: true, createdAt: true },
      });
      return NextResponse.json(
        {
          event,
          note: "Created as DRAFT with no access token. Issue one via POST /api/admin/fundraising-events/<id>/token.",
        },
        { status: 201 }
      );
    } catch {
      slug = `${slugify(title)}-${randomBytes(2).toString("hex")}`;
    }
  }

  return NextResponse.json({ error: "Could not allocate a unique slug." }, { status: 500 });
}
