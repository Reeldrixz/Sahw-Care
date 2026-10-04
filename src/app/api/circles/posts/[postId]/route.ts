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

  // A mother deleting her own post while it has open (unresolved) reports:
  // hide it instead, and keep its queue entry and reports. A hard delete
  // cascades to both, so deleting a reported post before review would erase
  // the record of the report. The post disappears for her exactly as a delete
  // would — every circle read path excludes hidden posts — and the response is
  // the same, so the review stays in the admin queue without telling her.
  // A post with no open reports is deleted normally.
  if (isOwner && !isAdmin) {
    const openReports = await prisma.postReport.count({ where: { postId, resolvedAt: null } });
    if (openReports > 0) {
      await prisma.$transaction([
        prisma.circlePost.update({ where: { id: postId }, data: { isHidden: true } }),
        // Normally already queued by the report. upsert so a report from before
        // reports created queue entries still reaches review; an existing
        // entry keeps its status and reason.
        prisma.flaggedPost.upsert({
          where:  { postId },
          create: { postId, reason: "Deleted by its author while reported" },
          update: {},
        }),
      ]);
      return NextResponse.json({ deleted: true });
    }
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
