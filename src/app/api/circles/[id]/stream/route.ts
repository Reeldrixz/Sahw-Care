import { NextRequest } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: circleId } = await params;
  const sinceParam = req.nextUrl.searchParams.get("since");
  let lastCheck = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 10000);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Send initial ping
      send({ type: "ping" });

      // Heartbeat every 25s to keep alive
      const heartbeat = setInterval(() => {
        send({ type: "ping" });
      }, 25000);

      // Poll DB every 4s for new posts
      const poll = setInterval(async () => {
        if (closed) { clearInterval(poll); clearInterval(heartbeat); return; }
        try {
          const checkTime = new Date(lastCheck);
          lastCheck = new Date();

          const newPosts = await prisma.circlePost.findMany({
            where: { circleId, isHidden: false, createdAt: { gt: checkTime } },
            orderBy: { createdAt: "asc" },
            take: 10,
            include: {
              user: {
                select: {
                  id: true, name: true, avatar: true, location: true,
                  trustScore: true, countryCode: true,
                  circleContext: true, circleDisplayName: true, subTags: true,
                  circleMembers: { where: { circleId }, select: { isLeader: true } },
                },
              },
              channel: { select: { id: true, name: true, emoji: true } },
              reactions: { select: { type: true, userId: true } },
              _count: { select: { comments: true } },
            },
          });

          for (const p of newPosts) {
            const reactionCounts = { HEART: 0, HUG: 0, CLAP: 0 };
            for (const r of p.reactions) reactionCounts[r.type as keyof typeof reactionCounts]++;

            const loc = p.user.location ?? "";
            const city = loc.includes(",") ? loc.split(",")[0].trim() : null;

            send({
              type: "new_post",
              post: {
                id: p.id,
                content: p.content,
                category: p.category,
                photoUrl: p.photoUrl,
                isPinned: false,
                createdAt: p.createdAt,
                channelId: p.channel?.id ?? null,
                channelName: p.channel?.name ?? null,
                channelEmoji: p.channel?.emoji ?? null,
                author: {
                  id: p.user.id,
                  name: p.user.name,
                  avatar: p.user.avatar,
                  city,
                  countryFlag: null,
                  circleContext: p.user.circleContext ?? null,
                  circleDisplayName: p.user.circleDisplayName ?? null,
                  subTags: p.user.subTags ?? [],
                  trustScore: p.user.trustScore,
                  isLeader: p.user.circleMembers[0]?.isLeader ?? false,
                },
                reactions: { ...reactionCounts, myReaction: null },
                commentCount: p._count.comments,
              },
            });
          }
        } catch {
          // DB error — don't crash stream
        }
      }, 4000);

      // Auto-close after 55s (let client reconnect)
      const timeout = setTimeout(() => {
        clearInterval(heartbeat);
        clearInterval(poll);
        closed = true;
        try { controller.close(); } catch {}
      }, 55000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        clearInterval(poll);
        clearTimeout(timeout);
        closed = true;
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
