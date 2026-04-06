import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// POST: donor commits to fulfilling an item
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { itemId } = await params;
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await prisma.registerItem.findUnique({
    where: { id: itemId },
    include: { register: true, assignment: true },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.status !== "AVAILABLE") return NextResponse.json({ error: "Item already reserved or fulfilled" }, { status: 409 });
  if (item.register.creatorId === auth.userId) return NextResponse.json({ error: "You cannot claim your own register item" }, { status: 400 });

  const assignment = await prisma.itemAssignment.create({
    data: { itemId, donorId: auth.userId },
  });
  await prisma.registerItem.update({ where: { id: itemId }, data: { status: "RESERVED" } });

  return NextResponse.json({ assignment }, { status: 201 });
}

// PATCH: update assignment status (PURCHASED or DELIVERED)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { itemId } = await params;
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status } = await req.json();
  if (!["PURCHASED", "DELIVERED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const assignment = await prisma.itemAssignment.findFirst({
    where: { itemId, donorId: auth.userId },
  });
  if (!assignment) return NextResponse.json({ error: "No assignment found" }, { status: 404 });

  const updated = await prisma.itemAssignment.update({
    where: { id: assignment.id },
    data: { status },
  });

  if (status === "DELIVERED") {
    await prisma.registerItem.update({ where: { id: itemId }, data: { status: "FULFILLED" } });
  }

  return NextResponse.json({ assignment: updated });
}
