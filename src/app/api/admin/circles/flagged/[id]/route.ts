import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** PUT — approve (unhide) or remove (delete) a flagged post */
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
    // Unhide the post
    await prisma.circlePost.update({ where: { id: flagged.postId }, data: { isHidden: false } });
    await prisma.flaggedPost.update({ where: { id }, data: { status: "APPROVED", reviewedAt: new Date() } });
    return NextResponse.json({ action: "approved" });
  }

  if (action === "remove") {
    // Permanently delete the post (cascades to flaggedPost)
    await prisma.circlePost.delete({ where: { id: flagged.postId } });
    return NextResponse.json({ action: "removed" });
  }

  return NextResponse.json({ error: "action must be approve or remove" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
