import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Codes relevant per stage for Section 6 slot counts
function relevantCodesForStage(
  dueDate: Date | null,
  babyBirthDate: Date | null,
  journeyType: string | null,
): string[] {
  const now = new Date();
  if (dueDate && dueDate > now) {
    const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
    if (daysLeft > 90) return ["B01", "B02"];
    return ["B03", "B04", "B05"];
  }
  if (dueDate && !babyBirthDate) return ["B04", "B05"];
  if (babyBirthDate) {
    const agedays = Math.floor((now.getTime() - babyBirthDate.getTime()) / 86400000);
    if (agedays <= 84)  return ["B09", "B10", "B12"];
    if (agedays <= 365) return ["B06", "B07", "B08"];
    return ["B06", "B07"];
  }
  if (journeyType === "pregnant") return ["B01", "B02", "B03"];
  if (journeyType === "postpartum") return ["B09", "B10", "B12"];
  return ["B06", "B09"];
}

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      journeyType: true,
      dueDate: true,
      babyBirthDate: true,
      currentStage: true,
      createdAt: true,
      verificationLevel: true,
      registers: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          title: true,
          items: {
            select: {
              id: true,
              name: true,
              status: true,
              fundingStatus: true,
              fulfillmentQueue: { select: { status: true } },
            },
          },
        },
      },
      bundleApplications: {
        where: { status: { in: ["PENDING", "APPROVED", "WAITLISTED"] } },
        select: {
          id: true,
          status: true,
          createdAt: true,
          bundle: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      requests: {
        select: {
          id: true,
          item: {
            select: {
              id: true,
              title: true,
              donor: { select: { name: true } },
            },
          },
          coordination: { select: { status: true } },
        },
      },
      circleMembers: { select: { circleId: true }, take: 1 },
      circlePosts:   { select: { id: true },       take: 1 },
    },
  });

  if (!raw) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (raw.journeyType === "donor") {
    return NextResponse.json({ error: "Not a mother" }, { status: 403 });
  }

  // Items in fulfillment
  const fulfillmentItems = raw.registers.flatMap((reg) =>
    reg.items
      .filter(
        (item) =>
          item.status === "AWAITING_ADDRESS" ||
          item.status === "AWAITING_PURCHASE" ||
          (item.fulfillmentQueue !== null &&
            item.fulfillmentQueue!.status !== "DELIVERED"),
      )
      .map((item) => ({
        id: item.id,
        name: item.name,
        registerId: reg.id,
        registerTitle: reg.title,
        status: item.status as string,
        queueStatus: item.fulfillmentQueue?.status ?? null,
      })),
  );

  // Active pickups
  const activePickups = raw.requests
    .filter(
      (req) =>
        req.coordination &&
        !["DELIVERED", "CANCELLED"].includes(req.coordination.status),
    )
    .map((req) => ({
      requestId: req.id,
      itemTitle: req.item.title,
      donorFirstName: req.item.donor.name.split(" ")[0],
      coordinationStatus: req.coordination!.status,
    }));

  // Milestone: first item in a completed state
  const hasItemFulfilled = raw.registers.some((reg) =>
    reg.items.some((item) =>
      ["FULFILLED", "DELIVERED"].includes(item.status),
    ),
  );

  // Milestone: first bundle approved
  const firstBundle = await prisma.bundleApplication.findFirst({
    where: { userId: auth.userId, status: { in: ["APPROVED", "DELIVERED"] } },
    select: { id: true },
  });

  // Milestone: first pickup delivered
  const hasPickupDelivered = raw.requests.some(
    (req) => req.coordination?.status === "DELIVERED",
  );

  // Section 6: bundle slots
  const codes = relevantCodesForStage(raw.dueDate, raw.babyBirthDate, raw.journeyType);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const bundles = codes.length > 0
    ? await prisma.bundle.findMany({
        where: { code: { in: codes }, isActive: true },
        select: {
          code: true,
          name: true,
          slotsPerMonth: true,
          _count: {
            select: {
              applications: {
                where: {
                  status: "APPROVED",
                  createdAt: { gte: monthStart, lt: monthEnd },
                },
              },
            },
          },
        },
        take: 3,
      })
    : [];

  return NextResponse.json({
    user: {
      dueDate:           raw.dueDate,
      babyBirthDate:     raw.babyBirthDate,
      journeyType:       raw.journeyType,
      currentStage:      raw.currentStage,
      createdAt:         raw.createdAt,
      isVerified:        raw.verificationLevel >= 2,
    },
    registers: raw.registers.map((reg) => ({
      id: reg.id,
      title: reg.title,
      totalItems: reg.items.length,
      fundedItems: reg.items.filter(
        (i) =>
          ["FULFILLED", "DELIVERED", "AWAITING_ADDRESS", "AWAITING_PURCHASE"].includes(i.status) ||
          i.fulfillmentQueue !== null,
      ).length,
    })),
    bundleApplications: raw.bundleApplications,
    fulfillmentItems,
    activePickups,
    milestones: {
      hasCircleMembership: raw.circleMembers.length > 0,
      hasRegister:         raw.registers.length > 0,
      hasItemFulfilled,
      hasBundleApproved:   !!firstBundle,
      hasPickupDelivered,
      hasCommunityPost:    raw.circlePosts.length > 0,
    },
    bundleSlots: bundles.map((b) => ({
      code: b.code,
      name: b.name,
      slotsRemaining: Math.max(0, b.slotsPerMonth - b._count.applications),
      slotsPerMonth:  b.slotsPerMonth,
    })),
  });
}
