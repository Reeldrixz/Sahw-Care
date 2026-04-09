import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ postId: string }> };

/** Toggle a reaction. Same type = remove, different type = update, no reaction = add. */
export async function POST(req: NextRequest, { params }: Params) {
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await params;
  const { type } = await req.json(); // "HEART" | "HUG" | "CLAP"

  const VALID = ["HEART", "HUG", "CLAP"];
  if (!VALID.includes(type)) return NextResponse.json({ error: "Invalid reaction type" }, { status: 400 });

  const post = await prisma.circlePost.findUnique({ where: { id: postId }, select: { id: true, isHidden: true } });
  if (!post || post.isHidden) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const existing = await prisma.postReaction.findUnique({
    where: { postId_userId: { postId, userId: auth.userId } },
  });

  if (existing?.type === type) {
    // Toggle off
    await prisma.postReaction.delete({ where: { postId_userId: { postId, userId: auth.userId } } });
    return NextResponse.json({ action: "removed", type: null });
  }

  if (existing) {
    // Change type
    await prisma.postReaction.update({
      where: { postId_userId: { postId, userId: auth.userId } },
      data: { type: type as never },
    });
    return NextResponse.json({ action: "updated", type });
  }

  // New reaction
  await prisma.postReaction.create({ data: { postId, userId: auth.userId, type: type as never } });
  return NextResponse.json({ action: "added", type });
}
