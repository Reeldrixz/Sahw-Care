import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReadExperiences } from "@/lib/access";
import { STAGE_META, type StageKey } from "@/lib/stage";

export const dynamic = "force-dynamic";

// One published experience.
//
// Same identity discipline as the browse route: author and authorId never enter
// the query, so the response has nowhere to carry them. The byline is "a
// mother" and nothing on the page indicates whether she gave or received.
//
// authorId IS read here, but only inside a second, separate query whose result
// is reduced to a boolean before it leaves the function — see isMine below. The
// id itself is never returned.
//
// status: "PUBLISHED" is part of the WHERE, so an unpublished experience 404s
// rather than 403s. A mother whose post is still in review should not be able to
// learn its URL is live, and a reader guessing ids learns nothing about what
// exists but is unpublished.

const PUBLIC_FIELDS = {
  id: true,
  situation: true,
  whatITried: true,
  takeaway: true,
  topic: true,
  stageKey: true,
  helpedCount: true,
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

  const experience = await prisma.experience.findFirst({
    where:  { id, status: "PUBLISHED" },
    select: PUBLIC_FIELDS,
  });
  if (!experience) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // "Is this mine?" — computed server-side and collapsed to a boolean before it
  // is returned. It tells the requester only about herself: a true means she
  // wrote it, a false says nothing whatsoever about who did. The authorId is
  // fetched and discarded in the same breath.
  const owner = await prisma.experience.findUnique({
    where:  { id },
    select: { authorId: true },
  });
  const isMine = owner?.authorId === auth.userId;

  return NextResponse.json({
    experience: {
      ...experience,
      stageLabel: experience.stageKey
        ? STAGE_META[experience.stageKey as StageKey]?.label ?? experience.stageKey
        : null,
      isMine,
    },
  });
}
