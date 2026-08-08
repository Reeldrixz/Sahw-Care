import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rejectionMessageFor, type RejectionCategory } from "@/lib/reflectionSupport";

export const dynamic = "force-dynamic";

// Manual admin decision on a reflection. No auto-anything: approve publishes;
// reject notifies the mother with the warm, category-appropriate message.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { action, rejectionCategory, rejectionNote } = await req.json();

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const reflection = await prisma.reflection.findUnique({
    where:  { id },
    select: { id: true, authorId: true, status: true },
  });
  if (!reflection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── Approve ──────────────────────────────────────────────────────────────
  if (action === "approve") {
    await prisma.reflection.update({
      where: { id },
      data: {
        status:      "PUBLISHED",
        publishedAt: new Date(),
        reviewedAt:  new Date(),
        reviewedBy:  admin.userId,
        // clear any prior rejection metadata if re-approving
        rejectionCategory: null,
        rejectionNote:     null,
      },
    });

    const author = await prisma.user.findUnique({
      where:  { id: reflection.authorId },
      select: { currentCircleId: true },
    });
    const link = author?.currentCircleId ? `/circles/${author.currentCircleId}/reflections` : "/circles";

    prisma.notification.create({
      data: {
        userId:  reflection.authorId,
        type:    "ADMIN_MESSAGE",
        message: "Your reflection has been published. Thank you for sharing your experience with your stage.",
        link,
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, status: "PUBLISHED" });
  }

  // ── Reject ───────────────────────────────────────────────────────────────
  // rejectionCategory drives which warm message the mother receives. Defaults to
  // NON_CRISIS so an off-topic post never gets the alarming crisis reply unless
  // the admin explicitly marks it CRISIS.
  const category: RejectionCategory = rejectionCategory === "CRISIS" ? "CRISIS" : "NON_CRISIS";

  await prisma.reflection.update({
    where: { id },
    data: {
      status:            "REJECTED",
      reviewedAt:        new Date(),
      reviewedBy:        admin.userId,
      rejectionCategory: category,
      rejectionNote:     typeof rejectionNote === "string" && rejectionNote.trim() ? rejectionNote.trim().slice(0, 500) : null,
    },
  });

  const link = "/circles"; // keep the door open to Reflections without assuming a circle id
  prisma.notification.create({
    data: {
      userId:  reflection.authorId,
      type:    "ADMIN_MESSAGE",
      message: rejectionMessageFor(category), // approved crisis / non-crisis copy
      link,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, status: "REJECTED", category });
}
