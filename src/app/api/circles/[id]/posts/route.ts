import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkCircleContent } from "@/lib/circleFilter";
import { uploadImage } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: circleId } = await params;
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category"); // null = all
  const cursor = searchParams.get("cursor") ?? undefined;

  // Verify membership
  const membership = await prisma.circleMember.findFirst({
    where: { userId: auth.userId, circleId },
  });
  if (!membership) return NextResponse.json({ error: "Not a member of this circle" }, { status: 403 });

  const posts = await prisma.circlePost.findMany({
    where: {
      circleId,
      isHidden: false,
      ...(category && category !== "ALL" ? { category: category as never } : {}),
    },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: 20,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatar: true,
          location: true,
          trustScore: true,
          circleMembers: {
            where: { circleId },
            select: { isLeader: true },
          },
        },
      },
      reactions: { select: { type: true, userId: true } },
      _count: { select: { comments: true } },
    },
  });

  const formatted = posts.map((p) => {
    const reactionCounts = { HEART: 0, HUG: 0, CLAP: 0 };
    let myReaction: string | null = null;
    for (const r of p.reactions) {
      reactionCounts[r.type]++;
      if (r.userId === auth.userId) myReaction = r.type;
    }
    const loc = p.user.location ?? "";
    const city = loc.includes(",") ? loc.split(",")[0].trim() : null;
    return {
      id: p.id,
      content: p.content,
      category: p.category,
      photoUrl: p.photoUrl,
      isPinned: p.isPinned,
      createdAt: p.createdAt,
      author: {
        id: p.user.id,
        name: p.user.name,
        avatar: p.user.avatar,
        city,
        trustScore: p.user.trustScore,
        isLeader: p.user.circleMembers[0]?.isLeader ?? false,
      },
      reactions: { ...reactionCounts, myReaction },
      commentCount: p._count.comments,
    };
  });

  return NextResponse.json({ posts: formatted, nextCursor: formatted[formatted.length - 1]?.id ?? null });
}

export async function POST(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: circleId } = await params;

  const membership = await prisma.circleMember.findFirst({
    where: { userId: auth.userId, circleId },
  });
  if (!membership) return NextResponse.json({ error: "Not a member of this circle" }, { status: 403 });

  const contentType = req.headers.get("content-type") ?? "";
  let content = "";
  let category = "";
  let photoUrl: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const fd = await req.formData();
    content = (fd.get("content") as string) ?? "";
    category = (fd.get("category") as string) ?? "";
    const file = fd.get("photo") as File | null;
    if (file && file.size > 0) {
      const buf = Buffer.from(await file.arrayBuffer());
      photoUrl = await uploadImage(buf, `circles/${circleId}`);
    }
  } else {
    const body = await req.json();
    content = body.content ?? "";
    category = body.category ?? "";
  }

  content = content.trim();
  if (!content) return NextResponse.json({ error: "Post content is required" }, { status: 400 });
  if (content.length > 500) return NextResponse.json({ error: "Post must be 500 characters or less" }, { status: 400 });

  const VALID_CATS = ["TIP", "STORY", "GRATITUDE", "QUESTION"];
  if (!VALID_CATS.includes(category)) return NextResponse.json({ error: "Invalid category" }, { status: 400 });

  // Keyword filter
  const flagged = checkCircleContent(content);

  const post = await prisma.circlePost.create({
    data: {
      circleId,
      userId: auth.userId,
      content,
      category: category as never,
      photoUrl,
      isHidden: !!flagged, // hide flagged posts pending review
    },
  });

  if (flagged) {
    await prisma.flaggedPost.create({
      data: { postId: post.id, reason: `Keyword match: "${flagged}"` },
    }).catch(() => {});
    return NextResponse.json({ post: null, flagged: true, message: "Your post is under review before it appears in the circle." });
  }

  return NextResponse.json({ post: { id: post.id, content: post.content, category: post.category, photoUrl: post.photoUrl, isPinned: false, createdAt: post.createdAt }, flagged: false });
}
