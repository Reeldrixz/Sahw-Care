import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** PUT — approve (unhide) or remove (keep hidden, mark REMOVED) a flagged post */
export async function PUT(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { role: true } });
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {

  const { id } = await params;
  const { action } = await req.json(); // "approve" | "remove"

  const flagged = await prisma.flaggedPost.findUnique({ where: { id }, include: { post: true } });
  if (!flagged) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "approve") {
    // Unhide the post, close the review, and resolve its open reports — kept
    // as rows, but no longer open. A mother whose report is resolved cannot
    // re-queue the post; only a mother who has never reported it can.
    //
    // A REMOVED post cannot be approved: removal is final, and approving it
    // would put content an admin took down back in the circle. The status
    // check is part of the update itself, so it holds against a concurrent
    // Remove; the post is only un-hidden if that update matched.
    const now = new Date();
    const approved = await prisma.$transaction(async (tx) => {
      const res = await tx.flaggedPost.updateMany({
        where: { id, status: { not: "REMOVED" } },
        data:  { status: "APPROVED", reviewedAt: now, reviewedByAdminId: auth.userId },
      });
      if (res.count !== 1) return false;
      await tx.circlePost.update({ where: { id: flagged.postId }, data: { isHidden: false } });
      await tx.postReport.updateMany({
        where: { postId: flagged.postId, resolvedAt: null },
        data:  { resolvedAt: now },
      });
      return true;
    });
    if (!approved) {
      return NextResponse.json({ error: "This post was removed and can't be approved." }, { status: 409 });
    }
    return NextResponse.json({ action: "approved" });
  }

  if (action === "remove") {
    // Hide, don't delete. Deleting cascaded to this FlaggedPost and the post's
    // reports, so nothing recorded what was removed or why, and the REMOVED
    // filter in the admin queue could never show anything. The post stays
    // hidden — every circle read path (posts list, stream, comments) excludes
    // hidden posts — and the queue entry and reports remain as the record,
    // with when (reviewedAt) and which admin (reviewedByAdminId).
    await prisma.$transaction([
      prisma.circlePost.update({ where: { id: flagged.postId }, data: { isHidden: true } }),
      prisma.flaggedPost.update({
        where: { id },
        data:  { status: "REMOVED", reviewedAt: new Date(), reviewedByAdminId: auth.userId },
      }),
    ]);
    return NextResponse.json({ action: "removed" });
  }

  return NextResponse.json({ error: "action must be approve or remove" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
