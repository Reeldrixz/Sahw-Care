import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ postId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await params;
  const { reason } = await req.json();

  if (!reason?.trim()) return NextResponse.json({ error: "Reason is required" }, { status: 400 });

  const post = await prisma.circlePost.findUnique({ where: { id: postId }, select: { id: true, userId: true } });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  if (post.userId === auth.userId) {
    return NextResponse.json({ error: "You cannot report your own post" }, { status: 400 });
  }

  // Create report (unique per user+post)
  await prisma.postReport.upsert({
    where: { postId_reportedBy: { postId, reportedBy: auth.userId } },
    create: { postId, reportedBy: auth.userId, reason: reason.trim() },
    update: { reason: reason.trim() },
  });

  // Hide post immediately pending admin review
  await prisma.circlePost.update({ where: { id: postId }, data: { isHidden: true } });

  // Three-strikes check — count distinct reports across all this user's posts
  const reportCount = await prisma.postReport.count({
    where: { post: { userId: post.userId } },
  });
  if (reportCount >= 3) {
    await prisma.user.update({
      where: { id: post.userId },
      data: { status: "FLAGGED" },
    }).catch(() => {});
  }

  return NextResponse.json({ reported: true });
}
