import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { logAbuseEvent, runAbuseChecks } from "@/lib/abuse";
import { canClaimDiscoverItem } from "@/lib/access";

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
        coordination: { select: { id: true } },
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
  const [requester, priorClaimCount, giftInProgress] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        phoneVerified: true, emailVerified: true, avatar: true,
        trustScore: true, verificationLevel: true,
        manualReviewStatus: true, identityVerified: true,
        activeRequestLockedUntil: true, requestCountSinceReset: true,
        accountHold: true,
      },
    }),
    prisma.request.count({
      where: {
        requesterId: user.userId,
        status: { notIn: ["CANCELLED", "DECLINED", "REJECTED"] },
      },
    }),
    // Turn-taking: the one gift already being arranged, if any. Same query shape
    // as priorClaimCount, but selects the id so we can link her straight to it.
    prisma.request.findFirst({
      where: {
        requesterId: user.userId,
        status: { in: ["ACCEPTED", "PICKUP_AGREED"] },
      },
      select: { id: true },
    }),
  ]);
  if (!requester) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const isFullyVerified = (requester.verificationLevel ?? 0) >= 2;
  if (!isFullyVerified && (!(requester.phoneVerified || requester.emailVerified) || !requester.avatar)) {
    return NextResponse.json({
      error: "Please complete your profile first. Verify your phone or email and add a profile photo.",
      code: "LAYER1_INCOMPLETE",
    }, { status: 403 });
  }

  // Access gate: verification tier check
  const claimAccess = canClaimDiscoverItem(requester, priorClaimCount);
  if (!claimAccess.allowed) {
    return NextResponse.json({
      error: claimAccess.message,
      code:  claimAccess.code,
    }, { status: 403 });
  }

  // Turn-taking: one gift in progress at a time. ACCEPTED and PICKUP_AGREED are
  // the states where a giver has committed and a handover is being arranged
  // (post-rename, PICKUP_AGREED means a time was actually agreed). PENDING does
  // NOT block: an unanswered claim may sit for up to 48h before the expiry cron
  // clears it, and freezing her on a giver's silence would punish her for it.
  //
  // This can never trap her: the stall timeouts free the slot automatically
  // (48h unanswered / 72h stalled), and she can cancel the coordination herself
  // at any point — which is why the copy names both exits.
  if (giftInProgress) {
    return NextResponse.json({
      error: "You have a gift being arranged right now. Once it's handed over, or if it falls through, you can claim another.",
      code:  "GIFT_IN_PROGRESS",
      coordinationUrl: `/coordination/${giftInProgress.id}`,
    }, { status: 409 });
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

  // note / reasonForRequest / requestNote are deliberately NOT read from the
  // body any more. Asking a mother to explain herself at claim time made the
  // gift conditional on how well she justified her need. The columns remain so
  // historical rows keep their text; nothing new is collected. Logistics live in
  // coordination, where both parties can talk.
  const { itemId, whoIsItFor, pickupPreference, pickupLocationId, pickupMode, pickupCategoryId, pickupLocationNote } = await req.json();

  if (!itemId) return NextResponse.json({ error: "itemId is required" }, { status: 400 });

  if (whoIsItFor !== undefined && whoIsItFor !== null && !["ME", "MY_BABY"].includes(whoIsItFor)) {
    return NextResponse.json({ error: "Please choose Myself or My baby." }, { status: 400 });
  }

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
      whoIsItFor: whoIsItFor ?? null,
      pickupPreference: pickupPreference ?? null,
      pickupMode: pickupMode ?? "PICKUP",
      pickupCategoryId: pickupCategoryId ?? null,
      pickupLocationId: pickupLocationId ?? null,
      pickupLocationNote: pickupLocationNote ?? null,
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
