import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReadExperiences } from "@/lib/access";
import { STAGE_META, type StageKey } from "@/lib/stage";
import { ExperienceTopic } from "@prisma/client";

export const dynamic = "force-dynamic";

// Browse and search published Experiences.
//
// RETRIEVAL, NOT A FEED. A mother arrives looking for "how did someone handle
// this", not to scroll. So: browse by fixed topic, filter by stage, or search —
// and the ordering never rewards recency. Ranking is helpedCount DESC with
// createdAt ASC as the tiebreak, so the oldest of equally-helpful experiences
// wins. Nothing is privileged for being new and knowledge does not decay.
//
// IDENTITY: the byline on a published experience is "a mother", always. This
// route NEVER selects author or authorId — not "select then strip", the field
// does not enter the query, so the response object has nowhere to put an
// identity and a later edit cannot leak one by widening a spread. There is no
// denormalised author name on Experience, so there is genuinely nothing else to
// expose.
//
// Also excluded, deliberately: reviewNote, rejectionReasonForAuthor, aiNote,
// aiFlags, aiVerdict. The moderation trail and the AI's reasoning are
// admin-only and must never appear on a page a mother reads.

const PAGE_SIZE = 20;
const SHELF_SIZE = 6;
const MAX_SEARCH = 100;

// The single source of the public shape. Anything not listed here cannot reach
// a reader, whatever is added to the model later.
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

const VALID_TOPICS = new Set(Object.values(ExperienceTopic) as string[]);
const VALID_STAGES = new Set(Object.keys(STAGE_META));

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: { isMother: true, accountHold: true, currentStage: true },
  });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = canReadExperiences(me);
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.message, code: gate.code }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const topic  = searchParams.get("topic") ?? "";
  const stage  = searchParams.get("stage") ?? "";
  const q      = (searchParams.get("q") ?? "").trim().slice(0, MAX_SEARCH);
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);

  // status is pinned in every query. DRAFT, PENDING, AI_FLAGGED, REJECTED and
  // HELD_FOR_SUPPORT are unreachable from here by construction, not by filter.
  const where: Record<string, unknown> = { status: "PUBLISHED" };
  if (VALID_TOPICS.has(topic)) where.topic = topic;
  if (VALID_STAGES.has(stage)) where.stageKey = stage;

  if (q) {
    // ILIKE across the three fields. No stemming and no relevance scoring —
    // "bottle refusing" will not match "refused the bottle" — and it uses no
    // index, so it full-scans. Acceptable at this size and consistent with every
    // other search in the codebase; Postgres full-text (tsvector + GIN) is the
    // additive upgrade when the library outgrows it.
    where.OR = [
      { situation:  { contains: q, mode: "insensitive" } },
      { whatITried: { contains: q, mode: "insensitive" } },
      { takeaway:   { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total, topicCounts] = await Promise.all([
    prisma.experience.findMany({
      where,
      // The anti-feed ordering, matching @@index([status, topic, helpedCount]).
      orderBy: [{ helpedCount: "desc" }, { createdAt: "asc" }],
      skip: offset,
      take: PAGE_SIZE,
      select: PUBLIC_FIELDS,
    }),
    prisma.experience.count({ where }),
    // Counts per topic for the browse entry, unaffected by the current filter
    // so the other topics still show what is behind them.
    prisma.experience.groupBy({
      by: ["topic"],
      where: { status: "PUBLISHED" },
      _count: true,
    }),
  ]);

  // The bounded "recently added" shelf. Deliberately small, deliberately
  // labelled, and only shown on the unfiltered entry view — it exists so a
  // small library does not look dead, and must never become the default
  // reading order.
  const shelf =
    !q && !topic && !stage && offset === 0
      ? await prisma.experience.findMany({
          where: { status: "PUBLISHED" },
          orderBy: { publishedAt: "desc" },
          take: SHELF_SIZE,
          select: PUBLIC_FIELDS,
        })
      : [];

  const label = (s: string | null) =>
    s ? STAGE_META[s as StageKey]?.label ?? s : null;

  return NextResponse.json({
    items: items.map((e) => ({ ...e, stageLabel: label(e.stageKey) })),
    shelf: shelf.map((e) => ({ ...e, stageLabel: label(e.stageKey) })),
    total,
    hasMore: offset + items.length < total,
    nextOffset: offset + items.length,
    topicCounts: Object.fromEntries(topicCounts.map((t) => [t.topic, t._count])),
    myStage: me.currentStage,
  });
}
