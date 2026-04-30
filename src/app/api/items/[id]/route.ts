import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { cancelActiveRequestsForItem } from "@/lib/cancel-item-requests";

export const dynamic = "force-dynamic";

const PROFANITY_LIST = ["fuck", "shit", "cunt", "nigger", "bitch", "asshole", "bastard", "cock", "pussy", "whore"];

function validateItemTitle(title: string): { valid: boolean; reason?: string } {
  if (title.trim().length < 3) return { valid: false, reason: "Title is too short." };
  if (title.length > 100) return { valid: false, reason: "Title is too long (max 100 characters)." };
  const lower = title.toLowerCase();
  if (PROFANITY_LIST.some((w) => lower.includes(w))) return { valid: false, reason: "Title contains inappropriate language." };
  const letters = title.replace(/[^a-zA-Z]/g, "");
  const upperCount = (title.match(/[A-Z]/g) ?? []).length;
  if (letters.length > 4 && upperCount / letters.length > 0.5) return { valid: false, reason: "Please use normal capitalisation in your title." };
  const emojiCount = (title.match(/\p{Emoji}/gu) ?? []).length;
  if (emojiCount > 2) return { valid: false, reason: "Too many emojis in the title." };
  if (/(.)\1{4,}/.test(title)) return { valid: false, reason: "Title looks like spam." };
  return { valid: true };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      donor: { select: { id: true, name: true, avatar: true, trustRating: true, location: true, verificationLevel: true } },
      _count: { select: { requests: true } },
    },
  });

  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  return NextResponse.json({ item });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  if (item.donorId !== user.userId && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { title, category, condition, quantity, location, description, images, urgent, status, adminBlurred, frozenReason } = body;

  if (title) {
    const titleCheck = validateItemTitle(title);
    if (!titleCheck.valid) return NextResponse.json({ error: titleCheck.reason }, { status: 422 });
  }

  const isAdmin = user.role === "ADMIN";
  const frozenAt = status === "FROZEN" ? new Date() : undefined;

  // Owners can toggle between ACTIVE and REMOVED only; admins can set any status
  if (status && !isAdmin) {
    if (!["ACTIVE", "REMOVED"].includes(status)) {
      return NextResponse.json({ error: "You can only mark a listing as active or unavailable." }, { status: 400 });
    }
  }

  const updated = await prisma.item.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(category && { category }),
      ...(condition && { condition }),
      ...(quantity && { quantity }),
      ...(location && { location }),
      ...(description !== undefined && { description }),
      ...(images && { images }),
      ...(urgent !== undefined && { urgent }),
      ...(status && { status }),
      ...(adminBlurred !== undefined && isAdmin && { adminBlurred }),
      ...(frozenAt && { frozenAt }),
      ...(frozenReason !== undefined && isAdmin && { frozenReason: frozenReason ?? null }),
    },
    include: {
      donor: { select: { id: true, name: true, avatar: true } },
    },
  });

  if (status === "REMOVED") {
    await cancelActiveRequestsForItem(
      id,
      updated.title,
      "Item removed by donor",
      user.userId,
    ).catch(() => {});
  }

  return NextResponse.json({ item: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getTokenFromRequest(req);
  const user = token ? await verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  if (item.donorId !== user.userId && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.item.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
