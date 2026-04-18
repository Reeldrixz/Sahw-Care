import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkCircleContent } from "@/lib/circleFilter";
import { uploadImage } from "@/lib/cloudinary";
import { countryCodeToFlag } from "@/lib/stage";
import { awardTrust, checkAndFreezeIfAbuse, validateCirclePost, validateIntroPost } from "@/lib/trust";
import { logAbuseEvent } from "@/lib/abuse";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: circleId } = await params;
  const { searchParams } = new URL(req.url);
  const category  = searchParams.get("category");
  const channelId = searchParams.get("channelId");
  const cursor    = searchParams.get("cursor") ?? undefined;

  // ── Access gate: donors cannot view circles ──────────────────────────────
  const user = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: { journeyType: true, onboardingComplete: true },
  });
  if (user?.journeyType === "donor") {
    return NextResponse.json({ error: "Circles are only available for mothers." }, { status: 403 });
  }

  // ── Auto-join as READ_COMMENT if not yet a member ────────────────────────
  const existing = await prisma.circleMember.findFirst({
    where: { userId: auth.userId, circleId },
  });
  if (!existing) {
    await prisma.circleMember.create({
      data: { userId: auth.userId, circleId, accessType: "READ_COMMENT" },
    }).catch(() => {}); // ignore if race condition creates duplicate
  }

  const posts = await prisma.circlePost.findMany({
    where: {
      circleId,
      isHidden: false,
      ...(category  && category  !== "ALL" ? { category: category as never } : {}),
      ...(channelId && channelId !== "ALL" ? { channelId } : {}),
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
          countryCode: true,
          circleContext: true,
          circleDisplayName: true,
          subTags: true,
          circleMembers: {
            where: { circleId },
            select: { isLeader: true },
          },
        },
      },
      channel:   { select: { id: true, name: true, emoji: true } },
      reactions: { select: { type: true, userId: true } },
      postLikes: { where: { userId: auth.userId }, select: { id: true } },
      _count:    { select: { comments: true } },
    },
  });

  const formatted = posts.map((p) => {
    const reactionCounts = { HEART: 0, HUG: 0, CLAP: 0 };
    let myReaction: string | null = null;
    for (const r of p.reactions) {
      reactionCounts[r.type]++;
      if (r.userId === auth.userId) myReaction = r.type;
    }
    const loc  = p.user.location ?? "";
    const city = loc.includes(",") ? loc.split(",")[0].trim() : null;
    return {
      id:           p.id,
      content:      p.content,
      category:     p.category,
      photoUrl:     p.photoUrl,
      isPinned:     p.isPinned,
      createdAt:    p.createdAt,
      channelId:    p.channel?.id    ?? null,
      channelName:  p.channel?.name  ?? null,
      channelEmoji: p.channel?.emoji ?? null,
      author: {
        id:               p.user.id,
        name:             p.user.name,
        avatar:           p.user.avatar,
        city,
        countryFlag:      p.user.countryCode ? countryCodeToFlag(p.user.countryCode) : null,
        circleContext:    p.user.circleContext ?? null,
        circleDisplayName: p.user.circleDisplayName ?? null,
        subTags:          p.user.subTags ?? [],
        trustScore:       p.user.trustScore,
        isLeader:         p.user.circleMembers[0]?.isLeader ?? false,
      },
      reactions:    { ...reactionCounts, myReaction },
      commentCount: p._count.comments,
      liked:        p.postLikes.length > 0,
      likeCount:    p.likeCount,
    };
  });

  return NextResponse.json({
    posts:      formatted,
    nextCursor: formatted[formatted.length - 1]?.id ?? null,
  });
}

export async function POST(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: circleId } = await params;

  // ── Access enforcement ───────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: { journeyType: true, currentCircleId: true, hasPostedIntro: true },
  });

  if (user?.journeyType === "donor") {
    return NextResponse.json({ error: "Donors cannot post in circles." }, { status: 403 });
  }

  if (!user?.currentCircleId || user.currentCircleId !== circleId) {
    return NextResponse.json(
      { error: "You can only create posts in your current stage circle." },
      { status: 403 },
    );
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  const contentType = req.headers.get("content-type") ?? "";
  let content = "";
  let category = "";
  let channelId: string | null = null;
  let photoUrl:  string | null = null;
  let isIntroPost = false;

  if (contentType.includes("multipart/form-data")) {
    const fd = await req.formData();
    content   = (fd.get("content")   as string) ?? "";
    category  = (fd.get("category")  as string) ?? "";
    channelId = (fd.get("channelId") as string) || null;
    const file = fd.get("photo") as File | null;
    if (file && file.size > 0) {
      const buf = Buffer.from(await file.arrayBuffer());
      photoUrl = await uploadImage(buf, `circles/${circleId}`);
    }
  } else {
    const body = await req.json();
    content      = body.content      ?? "";
    category     = body.category     ?? "";
    channelId    = body.channelId    ?? null;
    isIntroPost  = !!body.isIntroPost;
  }

  content = content.trim();
  if (!content) return NextResponse.json({ error: "Post content is required" }, { status: 400 });
  if (content.length > 500) return NextResponse.json({ error: "Post must be 500 characters or less" }, { status: 400 });

  const VALID_CATS = ["TIP", "STORY", "GRATITUDE", "QUESTION"];
  if (!VALID_CATS.includes(category)) return NextResponse.json({ error: "Invalid category" }, { status: 400 });

  // ── Quality gates ────────────────────────────────────────────────────────
  if (isIntroPost) {
    if (user?.hasPostedIntro) {
      return NextResponse.json({ error: "You have already posted your intro." }, { status: 400 });
    }
    if (validateIntroPost(content)) {
      return NextResponse.json({ error: "Intro posts must be at least 30 characters." }, { status: 400 });
    }
  } else if (validateCirclePost(content)) {
    return NextResponse.json({ error: "Posts must be at least 20 characters and should not contain request language." }, { status: 400 });
  }

  const flagged = checkCircleContent(content);

  if (channelId) {
    const ch = await prisma.circleChannel.findFirst({ where: { id: channelId, circleId } });
    if (!ch) channelId = null;
  }

  const post = await prisma.circlePost.create({
    data: { circleId, userId: auth.userId, content, category: category as never, channelId, photoUrl, isHidden: !!flagged, isIntroPost },
  });

  if (flagged) {
    await prisma.flaggedPost.create({
      data: { postId: post.id, reason: `Keyword match: "${flagged}"` },
    }).catch(() => {});
    return NextResponse.json({ post: null, flagged: true, message: "Your post is under review before it appears in the circle." });
  }

  // After creating post (not flagged), notify circle members who want new post notifications
  // Fire and forget — don't await
  (async () => {
    try {
      const members = await prisma.circleMember.findMany({
        where: { circleId, userId: { not: auth.userId } },
        include: { user: { select: { id: true, notifyNewPosts: true } } },
      });
      const poster = await prisma.user.findUnique({ where: { id: auth.userId }, select: { name: true } });
      const posterName = poster?.name?.split(" ")[0] ?? "Someone";
      const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { name: true } });
      const circleName = circle?.name ?? "your circle";

      const notifData = members
        .filter(m => m.user.notifyNewPosts)
        .map(m => ({
          userId: m.user.id,
          type: "NEW_POST" as const,
          message: `${posterName} posted in ${circleName}`,
          circleId,
          postId: post.id,
          triggeredByUserId: auth.userId,
          link: `/circles`,
        }));

      if (notifData.length > 0) {
        await prisma.notification.createMany({ data: notifData });
      }
    } catch {}
  })();

  // Mark intro post + award trust + log abuse event (fire-and-forget)
  (async () => {
    try {
      if (post.isIntroPost) {
        await prisma.user.update({ where: { id: auth.userId }, data: { hasPostedIntro: true } });
      }
      const u = await prisma.user.findUnique({ where: { id: auth.userId }, select: { trustScore: true } });
      await awardTrust(auth.userId, post.isIntroPost ? "INTRO_POST" : "CIRCLE_POST", {
        referenceId: post.id, referenceType: "CirclePost",
        reason: post.isIntroPost ? "wrote a circle intro post" : "posted in circle",
      });
      await checkAndFreezeIfAbuse(auth.userId);
      logAbuseEvent(auth.userId, post.isIntroPost ? "INTRO_POST_CREATED" : "CIRCLE_POST_CREATED", u?.trustScore ?? 0, { postId: post.id, circleId, category: post.category }, req).catch(() => {});
    } catch {}
  })();

  return NextResponse.json({
    post: { id: post.id, content: post.content, category: post.category, photoUrl: post.photoUrl, isPinned: false, createdAt: post.createdAt },
    flagged: false,
  });
}
