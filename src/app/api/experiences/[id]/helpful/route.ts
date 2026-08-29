import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReadExperiences } from "@/lib/access";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// "This helped" — one signal per mother per experience, toggleable.
//
// Gated on canReadExperiences rather than canWriteExperiences: marking
// something helpful is an act of reading, and the mother it helps is exactly
// the person whose signal is worth having.
//
// helpedCount is denormalised specifically so it can be an indexable sort key
// for every browse query. That makes drift between the counter and the actual
// ExperienceHelpful rows invisible but corrupting — the ranking would quietly
// lie and nothing would surface it. So the row and the counter move together in
// one transaction, always.
//
// CONCURRENCY IS THE DATABASE'S JOB. There is no read-then-write here: checking
// "has she marked this?" and then acting on the answer loses the race when two
// taps arrive together, producing a double increment or a duplicate row. Instead
// the insert is attempted unconditionally and @@unique([experienceId, userId])
// decides: success means this is a new mark, P2002 means she had already marked
// it and this tap is an un-mark. The constraint is the concurrency control.
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

  const gate = canReadExperiences(me);
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.message, code: gate.code }, { status: 403 });
  }

  // Generous, but a rapid toggle should not be able to hammer the row.
  const rl = rateLimit(`experience-helpful:${auth.userId}`, 60, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const { id } = await params;

  // PUBLISHED only, matching the reader. An unpublished experience 404s rather
  // than 403s, so a guessed id reveals nothing about what exists in review.
  const experience = await prisma.experience.findFirst({
    where:  { id, status: "PUBLISHED" },
    select: { id: true, authorId: true },
  });
  if (!experience) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // She cannot mark her own experience helpful. Enforced HERE, not only by
  // hiding the button: helpedCount is the ranking input for every browse query,
  // so self-marking would let anyone lift their own post to the top of the
  // library with a direct POST. A client-side guard on a ranking signal is
  // decoration.
  //
  // authorId is read for this check and for nothing else — it is not returned.
  if (experience.authorId === auth.userId) {
    return NextResponse.json(
      { error: "You can't mark your own experience helpful.", code: "OWN_EXPERIENCE" },
      { status: 400 }
    );
  }

  let marked: boolean;

  try {
    // Mark. If the unique constraint rejects it, she had already marked it.
    await prisma.$transaction([
      prisma.experienceHelpful.create({
        data: { experienceId: id, userId: auth.userId },
      }),
      prisma.experience.update({
        where: { id },
        data:  { helpedCount: { increment: 1 } },
      }),
    ]);
    marked = true;
  } catch (err) {
    const duplicate =
      err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
    if (!duplicate) {
      console.error("[experiences/helpful] mark failed:", err);
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    }

    // Un-mark. deleteMany rather than delete so a concurrent un-mark that got
    // there first is a no-op instead of an exception — and the decrement is
    // conditional on that delete having actually removed a row, so the counter
    // cannot drop twice for one mark.
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.experienceHelpful.deleteMany({
        where: { experienceId: id, userId: auth.userId },
      });
      if (count > 0) {
        // Guarded: helpedCount can never go below zero, even if the counter and
        // the rows have drifted for some reason we have not thought of.
        await tx.experience.updateMany({
          where: { id, helpedCount: { gt: 0 } },
          data:  { helpedCount: { decrement: 1 } },
        });
      }
    });
    marked = false;
  }

  const after = await prisma.experience.findUnique({
    where:  { id },
    select: { helpedCount: true },
  });

  return NextResponse.json({ marked, helpedCount: after?.helpedCount ?? 0 });
}
