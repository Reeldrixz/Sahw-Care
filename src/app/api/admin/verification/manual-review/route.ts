import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "PENDING") as
    "NONE" | "PENDING" | "APPROVED" | "REJECTED";

  const users = await prisma.user.findMany({
    where:   { manualReviewStatus: status },
    select: {
      id: true, name: true, email: true, phone: true, avatar: true,
      phoneVerified: true, emailVerified: true,
      manualReviewStatus: true,
      manualReviewSubmittedAt: true,
      manualReviewedAt: true,
      manualReviewRejectionReason: true,
      createdAt: true,
    },
    orderBy: { manualReviewSubmittedAt: "asc" },
  });

  return NextResponse.json({ users });
}
