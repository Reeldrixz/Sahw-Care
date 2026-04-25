import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/fulfillments
 * Returns disputed and recent auto-confirmed fulfillments for admin review.
 *
 * Query params:
 *   status: DISPUTED | AUTO_CONFIRMED | PENDING (default DISPUTED)
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
  const status = req.nextUrl.searchParams.get("status") ?? "DISPUTED";

  const fulfillments = await prisma.requestFulfillment.findMany({
    where:   { status: status as never },
    orderBy: { respondedAt: "desc" },
    take:    100,
    include: {
      request: {
        include: {
          item:      { select: { id: true, title: true, category: true, donor: { select: { id: true, name: true, email: true } } } },
          requester: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return NextResponse.json({
    fulfillments: fulfillments.map((f) => ({
      id:               f.id,
      status:           f.status,
      donorNote:        f.donorNote,
      donorPhotoUrl:    f.donorPhotoUrl,
      markedAt:         f.markedAt,
      respondedAt:      f.respondedAt,
      autoConfirmedAt:  f.autoConfirmedAt,
      itemTitle:        f.request.item.title,
      itemCategory:     f.request.item.category,
      donor:            f.request.item.donor,
      recipient:        f.request.requester,
    })),
  });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
