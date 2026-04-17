import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { awardTrust } from "@/lib/trust";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ postId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await params;
  const post = await prisma.circlePost.findUnique({
    where: { id: postId },
    select: { id: true, userId: true, isHidden: true, likeCount: true },
  });
  if (!post || post.isHidden) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const existing = await prisma.postLike.findUnique({
    where: { postId_userId: { postId, userId: auth.userId } },
  });

  if (existing) {
    // Unlike
    await prisma.$transaction([
      prisma.postLike.delete({ where: { postId_userId: { postId, userId: auth.userId } } }),
      prisma.circlePost.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } } }),
    ]);
    return NextResponse.json({ liked: false, likeCount: Math.max(0, post.likeCount - 1) });
  }

  // Like
  await prisma.$transaction([
    prisma.postLike.create({ data: { postId, userId: auth.userId } }),
    prisma.circlePost.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } }),
  ]);

  // Award trust to post author (not to liker, not if liking own post)
  if (post.userId !== auth.userId) {
    awardTrust(post.userId, "CIRCLE_REACTION_RECEIVED", {
      referenceId: postId, referenceType: "CirclePost",
      reason: "received a like on a circle post",
    }).catch(() => {});
  }

  return NextResponse.json({ liked: true, likeCount: post.likeCount + 1 });
}
