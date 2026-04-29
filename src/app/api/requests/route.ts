import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
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
    select: {
      phoneVerified: true, emailVerified: true, avatar: true,
      trustScore: true, verificationLevel: true,
      activeRequestLockedUntil: true, requestCountSinceReset: true,
    },
  });
  if (!requester) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const isFullyVerified = (requester.verificationLevel ?? 0) >= 2;
  if (!isFullyVerified && (!(requester.phoneVerified || requester.emailVerified) || !requester.avatar)) {
    return NextResponse.json({
      error: "Please complete your profile first — verify your phone or email and add a profile photo.",
      code: "LAYER1_INCOMPLETE",
    }, { status: 403 });
  }

  // Trust gate: score must be >= 60 to request items
  if ((requester.trustScore ?? 0) < 60) {
    return NextResponse.json({
      error: `You need a trust score of 60 to request items. Your current score is ${requester.trustScore ?? 0}. Keep engaging to unlock this.`,
      code: "TRUST_SCORE_TOO_LOW",
      required: 60,
      current: requester.trustScore ?? 0,
    }, { status: 403 });
  }

  // Request cooldown: max 8 requests per 12-hour window
  const now = new Date();
  if (requester.activeRequestLockedUntil && requester.activeRequestLockedUntil > now) {
    const msLeft   = requester.activeRequestLockedUntil.getTime() - now.getTime();
    const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
    return NextResponse.json({
      error: `You've reached your request limit. You can request again in ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}, or sooner by confirming receipt of your items.`,
      code: "REQUEST_LIMIT_REACHED",
      lockedUntil: requester.activeRequestLockedUntil,
    }, { status: 429 });
  }

  const { itemId, note, reasonForRequest, whoIsItFor, pickupPreference } = await req.json();

  if (!itemId) return NextResponse.json({ error: "itemId is required" }, { status: 400 });

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  if (item.status === "RESERVED") {
    return NextResponse.json({ error: "This item has already been reserved." }, { status: 409 });
  }
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

  // Increment counter; lock if this is the 8th request in the window
  const newCount = (requester.requestCountSinceReset ?? 0) + 1;
  const lockUntil = newCount >= 8 ? new Date(Date.now() + 12 * 60 * 60 * 1000) : null;
  await prisma.user.update({
    where: { id: user.userId },
    data: {
      requestCountSinceReset: newCount,
      ...(lockUntil ? { activeRequestLockedUntil: lockUntil } : {}),
    },
  });

  const request = await prisma.request.create({
    data: {
      itemId,
      requesterId: user.userId,
      note: note ?? null,
      reasonForRequest: reasonForRequest ?? null,
      whoIsItFor: whoIsItFor ?? null,
      pickupPreference: pickupPreference ?? null,
    },
    include: {
      item: { select: { id: true, title: true, donor: { select: { id: true, name: true } } } },
    },
  });

  // Notify donor of new request (fire-and-forget)
  prisma.notification.create({
    data: {
      userId:            item.donorId,
      type:              "FULFILLMENT_PENDING",
      message:           `Someone requested your item: ${item.title}. Review their request and decide whether to connect.`,
      link:              "/",
      triggeredByUserId: user.userId,
    },
  }).catch(() => {});

  // Log abuse event + run checks (fire-and-forget)
  Promise.all([
    logAbuseEvent(user.userId, "DISCOVER_REQUEST_CREATED", requester.trustScore ?? 0, { requestId: request.id, itemId }, req),
    runAbuseChecks(user.userId),
  ]).catch(() => {});

  return NextResponse.json({
    request,
    requestCount: newCount,
    lockedUntil: lockUntil,
  }, { status: 201 });
}
