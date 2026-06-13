import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STAGE_META, StageKey, countryCodeToFlag } from "@/lib/stage";
import { awardTrust } from "@/lib/trust";
import { logAbuseEvent } from "@/lib/abuse";
import { sendCircleReplyEmail } from "@/lib/email";

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

  const formatComment = (c: (typeof comments)[number]) => {
    const loc  = c.user.location ?? "";
    const city = loc.includes(",") ? loc.split(",")[0].trim() : null;
    return {
      id:            c.id,
      content:       c.content,
      identityLabel: c.identityLabel ?? null,
      parentId:      c.parentId ?? null,
      createdAt:     c.createdAt,
      author:        { id: c.user.id, name: c.user.name, avatar: c.user.avatar, city, countryFlag: c.user.countryCode ? countryCodeToFlag(c.user.countryCode) : null, circleContext: c.user.circleContext ?? null, circleDisplayName: c.user.circleDisplayName ?? null },
    };
  };

  // Build a one-level thread: top-level comments each carry their replies
  // (chronological). Replies are flattened to one level at write time, so any
  // comment with a parentId is a direct reply to a top-level comment.
  const repliesByParent = new Map<string, ReturnType<typeof formatComment>[]>();
  for (const c of comments) {
    if (c.parentId) {
      const arr = repliesByParent.get(c.parentId) ?? [];
      arr.push(formatComment(c));
      repliesByParent.set(c.parentId, arr);
    }
  }

  const formatted = comments
    .filter((c) => !c.parentId)
    .map((c) => ({ ...formatComment(c), replies: repliesByParent.get(c.id) ?? [] }));

  return NextResponse.json({ comments: formatted });
}

export async function POST(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await params;
  const { content, parentId } = await req.json();

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

  // ── Resolve reply target (one level of nesting) ───────────────────────────
  // When replying to a comment, we notify the author of the comment that was
  // replied to, but always store the new comment one level deep — under the
  // top-level comment — so the thread never nests further than comment → reply.
  let storageParentId: string | null = null;
  let replyTargetUserId: string | null = null;
  if (parentId) {
    const parent = await prisma.postComment.findUnique({
      where:  { id: parentId },
      select: { id: true, postId: true, parentId: true, userId: true },
    });
    if (!parent || parent.postId !== postId) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    storageParentId   = parent.parentId ?? parent.id; // flatten to the top-level comment
    replyTargetUserId = parent.userId;                // author of the comment being replied to
  }

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
    data: { postId, userId: auth.userId, content: content.trim(), identityLabel, parentId: storageParentId },
    include: { user: { select: { id: true, name: true, avatar: true, location: true, countryCode: true, circleContext: true, circleDisplayName: true } } },
  });

  // Award trust + log abuse event (fire-and-forget)
  (async () => {
    try {
      const u = await prisma.user.findUnique({ where: { id: auth.userId }, select: { trustScore: true } });
      await awardTrust(auth.userId, "CIRCLE_REPLY", {
        referenceId: comment.id, referenceType: "PostComment",
        reason: "replied to a circle post",
      });
      logAbuseEvent(auth.userId, "COMMENT_CREATED", u?.trustScore ?? 0, { commentId: comment.id, postId }, req).catch(() => {});
    } catch {}
  })();

  // Fire notifications (fire and forget)
  (async () => {
    try {
      const commenterUser = await prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } });
      const commenterName = commenterUser?.name?.split(" ")[0] ?? "Someone";
      const snippet = comment.content.length > 120 ? `${comment.content.slice(0, 117)}…` : comment.content;

      if (replyTargetUserId) {
        // ── Reply to a specific comment → notify that comment's author ────────
        if (replyTargetUserId !== auth.userId) {
          const target = await prisma.user.findUnique({
            where:  { id: replyTargetUserId },
            select: { name: true, email: true, notifyReplies: true },
          });
          if (target?.notifyReplies) {
            await prisma.notification.create({
              data: {
                userId:            replyTargetUserId,
                type:              "CIRCLE_THREAD_REPLY",
                message:           `${commenterName} replied to your comment`,
                circleId:          post.circleId,
                postId,
                triggeredByUserId: auth.userId,
                link:              `/circles`,
              },
            });
            // Existing Resend email path
            if (target.email) {
              try {
                await sendCircleReplyEmail({
                  firstName:   target.name.split(" ")[0],
                  email:       target.email,
                  replierName: commenterName,
                  snippet,
                });
              } catch { /* email is best-effort — never blocks the reply */ }
            }
          }
        }
      } else {
        // ── Top-level comment on the post → notify post author (in-app) ───────
        const postAuthor = await prisma.circlePost.findUnique({
          where:  { id: postId },
          select: { userId: true },
        });
        if (postAuthor && postAuthor.userId !== auth.userId) {
          const author = await prisma.user.findUnique({
            where:  { id: postAuthor.userId },
            select: { notifyReplies: true },
          });
          if (author?.notifyReplies) {
            await prisma.notification.create({
              data: {
                userId:            postAuthor.userId,
                type:              "REPLY",
                message:           `${commenterName} replied to your post`,
                circleId:          post.circleId,
                postId,
                triggeredByUserId: auth.userId,
                link:              `/circles`,
              },
            });
          }
        }
      }
    } catch { /* notifications are best-effort */ }
  })();

  const loc  = comment.user.location ?? "";
  const city = loc.includes(",") ? loc.split(",")[0].trim() : null;

  return NextResponse.json({
    comment: {
      id:            comment.id,
      content:       comment.content,
      identityLabel: comment.identityLabel ?? null,
      parentId:      comment.parentId ?? null,
      createdAt:     comment.createdAt,
      author:        { id: comment.user.id, name: comment.user.name, avatar: comment.user.avatar, city, countryFlag: comment.user.countryCode ? countryCodeToFlag(comment.user.countryCode) : null, circleContext: comment.user.circleContext ?? null, circleDisplayName: comment.user.circleDisplayName ?? null },
    },
  });
}
