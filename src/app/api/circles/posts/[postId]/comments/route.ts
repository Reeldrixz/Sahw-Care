import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ postId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await params;

  const comments = await prisma.postComment.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, avatar: true, location: true } },
    },
  });

  const formatted = comments.map((c) => {
    const loc = c.user.location ?? "";
    const city = loc.includes(",") ? loc.split(",")[0].trim() : null;
    return {
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      author: { id: c.user.id, name: c.user.name, avatar: c.user.avatar, city },
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

  const post = await prisma.circlePost.findUnique({ where: { id: postId }, select: { id: true, isHidden: true } });
  if (!post || post.isHidden) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const comment = await prisma.postComment.create({
    data: { postId, userId: auth.userId, content: content.trim() },
    include: { user: { select: { id: true, name: true, avatar: true, location: true } } },
  });

  const loc = comment.user.location ?? "";
  const city = loc.includes(",") ? loc.split(",")[0].trim() : null;

  return NextResponse.json({
    comment: {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      author: { id: comment.user.id, name: comment.user.name, avatar: comment.user.avatar, city },
    },
  });
}
