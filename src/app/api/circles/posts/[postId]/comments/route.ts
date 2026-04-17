import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STAGE_META, StageKey, countryCodeToFlag } from "@/lib/stage";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ postId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await params;

  const comments = await prisma.postComment.findMany({
    where:   { postId },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, avatar: true, location: true, countryCode: true, circleContext: true, circleDisplayName: true } },
    },
  });

  const formatted = comments.map((c) => {
    const loc  = c.user.location ?? "";
    const city = loc.includes(",") ? loc.split(",")[0].trim() : null;
    return {
      id:            c.id,
      content:       c.content,
      identityLabel: c.identityLabel ?? null,
      createdAt:     c.createdAt,
      author:        { id: c.user.id, name: c.user.name, avatar: c.user.avatar, city, countryFlag: c.user.countryCode ? countryCodeToFlag(c.user.countryCode) : null, circleContext: c.user.circleContext ?? null, circleDisplayName: c.user.circleDisplayName ?? null },
    };
  });

  return NextResponse.json({ comments: formatted });
}

export async function POST(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await params;
  const { content } = await req.json();

  if (!content?.trim()) return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
  if (content.trim().length > 300) return NextResponse.json({ error: "Comment must be 300 characters or less" }, { status: 400 });

  // ── Fetch commenter's circle context ─────────────────────────────────────
  const commenter = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: { journeyType: true, currentCircleId: true, graduatedCircleIds: true, currentStage: true },
  });

  if (commenter?.journeyType === "donor") {
    return NextResponse.json({ error: "Only mothers can comment in circles." }, { status: 403 });
  }

  // ── Fetch post + its circle ───────────────────────────────────────────────
  const post = await prisma.circlePost.findUnique({
    where:  { id: postId },
    select: { id: true, isHidden: true, circleId: true },
  });
  if (!post || post.isHidden) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  // ── Compute identity label ────────────────────────────────────────────────
  let identityLabel: string | null = null;
  const isInPrimaryCircle = commenter?.currentCircleId === post.circleId;

  if (!isInPrimaryCircle && commenter) {
    const isGraduated = commenter.graduatedCircleIds?.includes(post.circleId) ?? false;
    if (isGraduated) {
      identityLabel = "Previously in this stage";
    } else if (commenter.currentStage) {
      const meta = STAGE_META[commenter.currentStage as StageKey];
      if (meta) identityLabel = `Mom in ${meta.label}`;
    }
  }

  // ── Create comment ────────────────────────────────────────────────────────
  const comment = await prisma.postComment.create({
    data: { postId, userId: auth.userId, content: content.trim(), identityLabel },
    include: { user: { select: { id: true, name: true, avatar: true, location: true, countryCode: true, circleContext: true, circleDisplayName: true } } },
  });

  // Fire notifications (fire and forget)
  (async () => {
    try {
      const commenterUser = await prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } });
      const commenterName = commenterUser?.name?.split(" ")[0] ?? "Someone";

      // Get the post's author
      const postFull = await prisma.circlePost.findUnique({
        where: { id: postId },
        select: { userId: true, circleId: true },
      });
      if (!postFull) return;

      // REPLY: notify post author (if not the commenter)
      if (postFull.userId !== auth.userId) {
        const postAuthor = await prisma.user.findUnique({
          where: { id: postFull.userId },
          select: { notifyReplies: true },
        });
        if (postAuthor?.notifyReplies) {
          await prisma.notification.create({
            data: {
              userId: postFull.userId,
              type: "REPLY",
              message: `${commenterName} replied to your post`,
              circleId: postFull.circleId,
              postId,
              triggeredByUserId: auth.userId,
              link: `/circles`,
            },
          });
        }
      }

      // THREAD_REPLY: notify other commenters in this thread
      const threadCommenters = await prisma.postComment.findMany({
        where: { postId, userId: { not: auth.userId } },
        select: { userId: true },
        distinct: ["userId"],
      });
      const threadIds = threadCommenters
        .map(c => c.userId)
        .filter(id => id !== postFull.userId); // post author already handled above

      if (threadIds.length > 0) {
        const threadUsers = await prisma.user.findMany({
          where: { id: { in: threadIds }, notifyThreadReplies: true },
          select: { id: true },
        });
        const threadNotifs = threadUsers.map(u => ({
          userId: u.id,
          type: "THREAD_REPLY" as const,
          message: `${commenterName} also replied in a thread you're in`,
          circleId: postFull.circleId,
          postId,
          triggeredByUserId: auth.userId,
          link: `/circles`,
        }));
        if (threadNotifs.length > 0) {
          await prisma.notification.createMany({ data: threadNotifs, skipDuplicates: true });
        }
      }
    } catch {}
  })();

  const loc  = comment.user.location ?? "";
  const city = loc.includes(",") ? loc.split(",")[0].trim() : null;

  return NextResponse.json({
    comment: {
      id:            comment.id,
      content:       comment.content,
      identityLabel: comment.identityLabel ?? null,
      createdAt:     comment.createdAt,
      author:        { id: comment.user.id, name: comment.user.name, avatar: comment.user.avatar, city, countryFlag: comment.user.countryCode ? countryCodeToFlag(comment.user.countryCode) : null, circleContext: comment.user.circleContext ?? null, circleDisplayName: comment.user.circleDisplayName ?? null },
    },
  });
}
