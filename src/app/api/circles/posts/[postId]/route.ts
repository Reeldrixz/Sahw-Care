import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ postId: string }> };

/** DELETE — admin, circle leader, or the post's author */
export async function DELETE(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await params;
  const post = await prisma.circlePost.findUnique({ where: { id: postId } });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { role: true } });
  const isAdmin = user?.role === "ADMIN";

  const membership = await prisma.circleMember.findFirst({
    where: { userId: auth.userId, circleId: post.circleId },
  });
  const isLeader = membership?.isLeader ?? false;
  const isOwner = post.userId === auth.userId;

  if (!isAdmin && !isLeader && !isOwner) {
    return NextResponse.json({ error: "Not authorised to delete this post" }, { status: 403 });
  }

  // A post with open (unresolved) reports is never hard-deleted, by anyone. A
  // hard delete cascades to its queue entry and reports, so deleting a
  // reported post before review would erase the record of the report. It is
  // hidden instead — every circle read path excludes hidden posts, so it
  // disappears exactly as a delete would — and the response is the same.
  // A post with no open reports is deleted normally.
  const openReports = await prisma.postReport.count({ where: { postId, resolvedAt: null } });
  if (openReports > 0) {
    const now = new Date();

    if (isAdmin) {
      // An admin deleting it is a moderation removal: final, recorded as
      // REMOVED with the admin, exactly as Remove in the admin queue does.
      await prisma.$transaction([
        prisma.circlePost.update({ where: { id: postId }, data: { isHidden: true } }),
        prisma.flaggedPost.upsert({
          where:  { postId },
          create: {
            postId, reason: "Deleted by an admin while reported",
            status: "REMOVED", reviewedAt: now, reviewedByAdminId: auth.userId,
          },
          update: { status: "REMOVED", reviewedAt: now, reviewedByAdminId: auth.userId },
        }),
      ]);
      return NextResponse.json({ deleted: true });
    }

    // Her own post, or a circle leader's delete: hidden, and the review stays
    // with an admin. The queue entry is normally created by the report; upsert
    // so a report from before that still reaches review. An existing entry
    // keeps its status and reason; who hid it, and when, is recorded.
    const hiddenReason = isOwner ? "Deleted by its author while reported" : "Deleted by a circle leader while reported";
    await prisma.$transaction([
      prisma.circlePost.update({ where: { id: postId }, data: { isHidden: true } }),
      prisma.flaggedPost.upsert({
        where:  { postId },
        create: { postId, reason: hiddenReason, hiddenByUserId: auth.userId, hiddenAt: now },
        update: { hiddenByUserId: auth.userId, hiddenAt: now },
      }),
    ]);
    return NextResponse.json({ deleted: true });
  }

  await prisma.circlePost.delete({ where: { id: postId } });
  return NextResponse.json({ deleted: true });
}

/** PATCH — pin/unpin (admin or circle leader only) */
export async function PATCH(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await params;
  const post = await prisma.circlePost.findUnique({ where: { id: postId } });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { role: true } });
  const isAdmin = user?.role === "ADMIN";

  const membership = await prisma.circleMember.findFirst({
    where: { userId: auth.userId, circleId: post.circleId },
  });
  if (!isAdmin && !membership?.isLeader) {
    return NextResponse.json({ error: "Only circle leaders can pin posts" }, { status: 403 });
  }

  const { isPinned } = await req.json();
  const updated = await prisma.circlePost.update({
    where: { id: postId },
    data: { isPinned: !!isPinned },
  });
  return NextResponse.json({ isPinned: updated.isPinned });
}
