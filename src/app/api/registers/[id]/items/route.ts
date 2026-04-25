import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = await prisma.registerItem.findMany({
    where: { registerId: id },
    orderBy: { createdAt: "asc" },
    include: {
      assignment: {
        include: { donor: { select: { id: true, name: true } } },
      },
    },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const register = await prisma.register.findUnique({ where: { id } });
  if (!register) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (register.creatorId !== auth.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, quantity, note, storeLinks } = await req.json();
  if (!name || typeof name !== "string" || !name.trim())
    return NextResponse.json({ error: "Item name is required" }, { status: 400 });
  if (name.trim().length > 200)
    return NextResponse.json({ error: "Item name must be 200 characters or less" }, { status: 400 });

  // Validate store links — only allow http/https URLs, max 5
  const rawLinks: unknown[] = Array.isArray(storeLinks) ? storeLinks : [];
  if (rawLinks.length > 5)
    return NextResponse.json({ error: "Maximum 5 store links allowed" }, { status: 400 });
  const safeLinks: string[] = [];
  for (const link of rawLinks) {
    if (typeof link !== "string") continue;
    try {
      const url = new URL(link.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:")
        return NextResponse.json({ error: "Store links must be http or https URLs" }, { status: 400 });
      safeLinks.push(url.toString());
    } catch {
      return NextResponse.json({ error: `Invalid store link: ${link}` }, { status: 400 });
    }
  }

  const item = await prisma.registerItem.create({
    data: {
      registerId: id,
      name:       name.trim(),
      quantity:   quantity ?? "1",
      note:       note?.trim() ?? null,
      storeLinks: safeLinks,
    },
  });

  return NextResponse.json({ item }, { status: 201 });
}
