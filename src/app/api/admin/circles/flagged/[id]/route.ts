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
    const now = new Date();
    await prisma.$transaction([
      prisma.circlePost.update({ where: { id: flagged.postId }, data: { isHidden: false } }),
      prisma.flaggedPost.update({ where: { id }, data: { status: "APPROVED", reviewedAt: now } }),
      prisma.postReport.updateMany({
        where: { postId: flagged.postId, resolvedAt: null },
        data:  { resolvedAt: now },
      }),
    ]);
    return NextResponse.json({ action: "approved" });
  }

  if (action === "remove") {
    // Hide, don't delete. Deleting cascaded to this FlaggedPost and the post's
    // reports, so nothing recorded what was removed or why, and the REMOVED
    // filter in the admin queue could never show anything. The post stays
    // hidden — every circle read path (posts list, stream, comments) excludes
    // hidden posts — and the queue entry and reports remain as the record.
    // reviewedAt records when; there is no field yet for which admin.
    await prisma.$transaction([
      prisma.circlePost.update({ where: { id: flagged.postId }, data: { isHidden: true } }),
      prisma.flaggedPost.update({ where: { id }, data: { status: "REMOVED", reviewedAt: new Date() } }),
    ]);
    return NextResponse.json({ action: "removed" });
  }

  return NextResponse.json({ error: "action must be approve or remove" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
