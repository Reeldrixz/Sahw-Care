import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { deductTrustPoints } from "@/lib/trust";
import { logAbuseEvent, runAbuseChecks } from "@/lib/abuse";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type"); // "sent" | "received"

  let requests;

  if (type === "received") {
    requests = await prisma.request.findMany({
      where: { item: { donorId: user.userId } },
      include: {
        item: { select: { id: true, title: true, images: true } },
        requester: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } else {
    requests = await prisma.request.findMany({
      where: { requesterId: user.userId },
      include: {
        item: {
          select: {
            id: true,
            title: true,
            images: true,
            donor: { select: { id: true, name: true, avatar: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Enforce Layer 1 before requesting items (bypassed for verificationLevel >= 2)
  const requester = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { phoneVerified: true, emailVerified: true, avatar: true, trustScore: true, graceRequestsUsed: true, verificationLevel: true },
  });
  const isFullyVerified = (requester?.verificationLevel ?? 0) >= 2;
  if (!isFullyVerified && (requester && !(requester.phoneVerified || requester.emailVerified) || !requester?.avatar)) {
    return NextResponse.json({
      error: "Please complete your profile first — verify your phone or email and add a profile photo.",
      code: "LAYER1_INCOMPLETE",
    }, { status: 403 });
  }

  // Trust gate: score must be >= 60 to request items
  if (!requester) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if ((requester.trustScore ?? 0) < 60) {
    return NextResponse.json({
      error: `You need a trust score of 60 to request items. Your current score is ${requester.trustScore ?? 0}. Keep engaging to unlock this.`,
      code: "TRUST_SCORE_TOO_LOW",
      required: 60,
      current: requester.trustScore ?? 0,
    }, { status: 403 });
  }

  const { itemId, note } = await req.json();

  // Grace requests: first 2 are free, subsequent requests deduct -2 trust points
  const graceUsed = requester.graceRequestsUsed ?? 0;
  if (graceUsed < 2) {
    await prisma.user.update({ where: { id: user.userId }, data: { graceRequestsUsed: { increment: 1 } } });
  } else {
    // Deduct points (fire-and-forget)
    deductTrustPoints(user.userId, "DISCOVER_REQUEST", 2, { reason: "discover item request" }).catch(() => {});
  }

  if (!itemId) return NextResponse.json({ error: "itemId is required" }, { status: 400 });

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  if (item.status !== "ACTIVE") {
    return NextResponse.json({ error: "This item is no longer available" }, { status: 409 });
  }

  if (item.donorId === user.userId) {
    return NextResponse.json({ error: "You cannot request your own item" }, { status: 400 });
  }

  const existing = await prisma.request.findFirst({
    where: { itemId, requesterId: user.userId },
  });

  if (existing) {
    return NextResponse.json({ error: "You have already requested this item" }, { status: 409 });
  }

  const request = await prisma.request.create({
    data: { itemId, requesterId: user.userId, note: note ?? null },
    include: {
      item: { select: { id: true, title: true, donor: { select: { id: true, name: true } } } },
    },
  });

  // Create conversation so donor and requester can coordinate immediately
  const conversation = await prisma.conversation.create({
    data: {
      requestId: request.id,
      participants: {
        create: [
          { userId: user.userId },
          { userId: item.donorId },
        ],
      },
    },
    select: { id: true },
  });

  // Log abuse event + run checks (fire-and-forget)
  Promise.all([
    logAbuseEvent(user.userId, "DISCOVER_REQUEST_CREATED", requester.trustScore ?? 0, { requestId: request.id, itemId }, req),
    runAbuseChecks(user.userId),
  ]).catch(() => {});

  return NextResponse.json({ request, conversationId: conversation.id }, { status: 201 });
}
