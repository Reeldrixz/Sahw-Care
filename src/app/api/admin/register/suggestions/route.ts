import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await prisma.user.findUnique({ where: { id: auth.userId }, select: { role: true } });
  if (admin?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url    = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending";

  const rows = await prisma.registerSuggestion.findMany({
    where:   status === "all" ? {} : { status },
    orderBy: { createdAt: "desc" },
    select:  { id: true, itemName: true, category: true, notes: true, status: true, createdAt: true, userId: true },
  });

  // Group by normalized item name (case-insensitive)
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.itemName.toLowerCase().trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const suggestions = Array.from(groups.values()).map((group) => {
    const primary = group[0];
    return {
      id:                 primary.id,
      itemName:           primary.itemName,
      category:           primary.category,
      notes:              primary.notes,
      status:             primary.status,
      createdAt:          primary.createdAt,
      suggestedByCount:   group.length,
      similarSuggestions: group.map((s) => ({ id: s.id, notes: s.notes, createdAt: s.createdAt })),
    };
  });

  return NextResponse.json({ suggestions });
}
