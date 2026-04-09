import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ postId: string }> };

/** DELETE — admin or circle leader only */
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
