import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { requestId, pickupRating, qualityRating, quantityRating, comment } = await req.json();

  if (!requestId || !pickupRating || !qualityRating || !quantityRating) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { item: true },
  });

  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (request.requesterId !== user.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (request.status !== "FULFILLED") return NextResponse.json({ error: "Can only review fulfilled requests" }, { status: 400 });

  const existing = await prisma.review.findUnique({ where: { requestId } });
  if (existing) return NextResponse.json({ error: "Already reviewed" }, { status: 409 });

  const review = await prisma.review.create({
    data: {
      pickupRating,
      qualityRating,
      quantityRating,
      comment: comment ?? null,
      reviewerId: user.userId,
      donorId: request.item.donorId,
      requestId,
    },
  });

  // update donor trust rating
  const allReviews = await prisma.review.findMany({ where: { donorId: request.item.donorId } });
  const avg = allReviews.reduce((s, r) => s + (r.pickupRating + r.qualityRating + r.quantityRating) / 3, 0) / allReviews.length;
  await prisma.user.update({ where: { id: request.item.donorId }, data: { trustRating: Math.round(avg * 10) / 10 } });

  return NextResponse.json({ review }, { status: 201 });
}
