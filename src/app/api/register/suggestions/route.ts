import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = ["postpartum", "newborn", "pregnancy", "labour"];

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = await prisma.user.findUnique({
    where:  { id: auth.userId },
    select: { role: true, suggestionSubmissionDisabled: true },
  });

  if (actor?.role !== "RECIPIENT") {
    return NextResponse.json({ error: "Only mothers can submit suggestions" }, { status: 403 });
  }
  if (actor.suggestionSubmissionDisabled) {
    return NextResponse.json({ error: "Suggestions are disabled for your account." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { itemName, category, notes } = body;

  const nameStr = typeof itemName === "string" ? itemName.trim() : "";
  if (nameStr.length < 3 || nameStr.length > 80) {
    return NextResponse.json({ error: "Item name must be between 3 and 80 characters." }, { status: 400 });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Category must be one of: postpartum, newborn, pregnancy, labour." }, { status: 400 });
  }
  const notesStr = typeof notes === "string" ? notes.trim() : null;
  if (notesStr && notesStr.length > 300) {
    return NextResponse.json({ error: "Notes must be 300 characters or fewer." }, { status: 400 });
  }

  // Rate limit: 5 per 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCount = await prisma.registerSuggestion.count({
    where: { userId: auth.userId, createdAt: { gte: since } },
  });
  if (recentCount >= 5) {
    return NextResponse.json({
      error: "You've submitted several suggestions today. Try again tomorrow.",
    }, { status: 429 });
  }

  await prisma.registerSuggestion.create({
    data: { userId: auth.userId, itemName: nameStr, category, notes: notesStr || null },
  });

  return NextResponse.json({ ok: true, message: "Thanks for the suggestion!" });
}
