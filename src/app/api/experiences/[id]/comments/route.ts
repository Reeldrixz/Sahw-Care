import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReadExperiences, canWriteExperiences } from "@/lib/access";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { COMMENT_MIN, COMMENT_MAX } from "@/lib/experienceSafety";

export const dynamic = "force-dynamic";

// Comments on a published experience.
//
// GET  — published comments, readable by anyone who can read Experiences.
// POST — write one. Lands PENDING and goes through BOTH gates, same as a post:
//        a human reads it in the E4 queue, and if they approve, the AI final
//        gate checks it before it publishes.
//
// IDENTITY: the byline on a comment is "a mother", exactly as on a post. This
// route never selects author or authorId for the published list — the field does
// not enter the query, so the response has nowhere to carry an identity.
//
// Her OWN pending comment is the single exception, and it is scoped by
// authorId in the WHERE rather than filtered afterwards: she sees that hers is
// waiting, and learns nothing about anyone else's.

const PUBLIC_COMMENT_FIELDS = {
  id: true,
  body: true,
  publishedAt: true,
} as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: { isMother: true, accountHold: true },
  });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = canReadExperiences(me);
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.message, code: gate.code }, { status: 403 });
  }

  const { id } = await params;

  // The parent must itself be published — comments on an unpublished experience
  // are not reachable, so a guessed id reveals nothing.
  const parent = await prisma.experience.findFirst({
    where:  { id, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!parent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [published, mine] = await Promise.all([
    prisma.experienceComment.findMany({
      where:   { experienceId: id, status: "PUBLISHED" },
      // Oldest first: a comment thread reads as a conversation in order, and
      // nothing here is ranked. Comments add to a post; they do not compete.
      orderBy: { publishedAt: "asc" },
      take:    100,
      select:  PUBLIC_COMMENT_FIELDS,
    }),
    // Her own not-yet-published comments on this experience, so a comment she
    // wrote does not appear to have vanished. authorId is in the WHERE, so this
    // can only ever return hers.
    prisma.experienceComment.findMany({
      where:   { experienceId: id, authorId: auth.userId, status: { in: ["PENDING", "AI_FLAGGED"] } },
      orderBy: { createdAt: "asc" },
      select:  { id: true, body: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({
    comments: published,
    // Deliberately a separate list rather than merged with a flag: merging
    // would put an unpublished comment in the same array a future edit might
    // render for everyone.
    myPending: mine.map((c) => ({ id: c.id, body: c.body, createdAt: c.createdAt })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: { isMother: true, accountHold: true },
  });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Writing, so the write gate — not the read gate.
  const gate = canWriteExperiences(me);
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.message, code: gate.code }, { status: 403 });
  }

  const rl = rateLimit(`experience-comment:${auth.userId}`, 10, 24 * 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "You've added a few comments today already. Come back a little later." },
      { status: 429 }
    );
  }
  const ipRl = rateLimit(`experience-comment-ip:${getClientIp(req)}`, 40, 24 * 60 * 60 * 1000);
  if (!ipRl.ok) {
    return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 });
  }

  const { id } = await params;

  const parent = await prisma.experience.findFirst({
    where:  { id, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!parent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw  = await req.json().catch(() => ({}));
  const body = typeof raw?.body === "string" ? raw.body.trim() : "";

  if (body.length < COMMENT_MIN) {
    return NextResponse.json(
      { error: `A comment needs a little more — at least ${COMMENT_MIN} characters.` },
      { status: 400 }
    );
  }
  if (body.length > COMMENT_MAX) {
    return NextResponse.json(
      { error: `That's a bit long for a comment — please keep it under ${COMMENT_MAX} characters. If it's a whole experience of its own, write it as one.` },
      { status: 400 }
    );
  }

  const created = await prisma.experienceComment.create({
    data: {
      experienceId: id,
      authorId:     auth.userId,
      body,
      status:       "PENDING", // never PUBLISHED from here; only the queue publishes
    },
    select: { id: true },
  });

  return NextResponse.json({ id: created.id, status: "PENDING" }, { status: 201 });
}
