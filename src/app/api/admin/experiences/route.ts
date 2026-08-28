import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STAGE_META, type StageKey } from "@/lib/stage";

export const dynamic = "force-dynamic";

// Admin review queue for Experiences — posts and comments alike.
//
// requireAdmin ONLY. This is the single place an Experiences author's identity
// (name + email) is exposed, and solely so a human can moderate and, where
// someone is in crisis, reach out to her. It must never reach any other surface:
// the byline on a published experience is "a mother", full stop, and nothing on
// a post ever indicates whether she gave or received. Every response below is
// built from an explicit field list for that reason — a bare include would leak
// the author record wholesale the moment a column is added to User.
//
// Ordering is oldest-first within a status. Nothing is privileged for being
// new; a post that has waited longest is reviewed first, which is also the only
// ordering that cannot quietly strand someone at the bottom of the queue.

const VALID_STATUSES = ["PENDING", "PUBLISHED", "REJECTED", "DRAFT", "HELD_FOR_SUPPORT", "AI_FLAGGED", "ALL"] as const;
type QueueStatus = (typeof VALID_STATUSES)[number];

const AUTHOR_FIELDS = { id: true, name: true, email: true } as const;

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status") ?? "PENDING";
  const status: QueueStatus = (VALID_STATUSES as readonly string[]).includes(statusParam)
    ? (statusParam as QueueStatus)
    : "PENDING";
  const kind  = searchParams.get("kind") === "comments" ? "comments" : "posts";
  const limit = Math.min(Number(searchParams.get("limit") ?? "50") || 50, 100);

  const where = status === "ALL" ? {} : { status: status as never };

  if (kind === "posts") {
    const rows = await prisma.experience.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: limit,
      select: {
        id: true,
        situation: true,
        whatITried: true,
        takeaway: true,
        topic: true,
        stageKey: true,
        status: true,
        reviewNote: true,
        rejectionReasonForAuthor: true,
        helpedCount: true,
        createdAt: true,
        reviewedAt: true,
        publishedAt: true,
        // AI final-gate state. Internal to the queue — none of it is ever shown
        // to the author.
        aiVerdict: true,
        aiNote: true,
        aiFlags: true,
        aiCheckedAt: true,
        aiConfirmedByAdminId: true,
        aiConfirmedAt: true,
        author: { select: AUTHOR_FIELDS },
      },
    });

    return NextResponse.json({
      kind: "posts",
      items: rows.map((r) => ({
        ...r,
        stageLabel: r.stageKey ? STAGE_META[r.stageKey as StageKey]?.label ?? r.stageKey : null,
      })),
      counts: await queueCounts(),
    });
  }

  const rows = await prisma.experienceComment.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      body: true,
      status: true,
      reviewNote: true,
      rejectionReasonForAuthor: true,
      createdAt: true,
      reviewedAt: true,
      publishedAt: true,
      author: { select: AUTHOR_FIELDS },
      // The parent post, for context. A comment is often only judgeable
      // against what it is replying to — "just do what I said above" is
      // harmless or dangerous entirely depending on the post.
      experience: { select: { id: true, situation: true, status: true } },
    },
  });

  return NextResponse.json({ kind: "comments", items: rows, counts: await queueCounts() });
}

// Pending counts for both tabs, so the reviewer can see at a glance whether
// comments are quietly piling up behind the posts.
async function queueCounts() {
  const [posts, comments, aiFlagged] = await Promise.all([
    prisma.experience.count({ where: { status: "PENDING" } }),
    prisma.experienceComment.count({ where: { status: "PENDING" } }),
    // Posts the AI stopped after a human approved. These are waiting on a
    // second look and must not sit unnoticed behind the pending count.
    prisma.experience.count({ where: { status: "AI_FLAGGED" } }),
  ]);
  return { pendingPosts: posts, pendingComments: comments, aiFlagged };
}
