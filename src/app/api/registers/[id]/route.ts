import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;

  const register = await prisma.register.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, location: true, verificationLevel: true } },
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          assignment: {
            include: {
              donor: { select: { id: true, name: true } },
              fulfillmentLog: { select: { momConfirmed: true, mismatch: true } },
            },
          },
          _count: { select: { funding: true } },
          catalogItem: { select: { imageUrl: true } },
        },
      },
    },
  });

  if (!register) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isCreator = auth?.userId === register.creatorId;
  const responseRegister = isCreator
    ? register
    : { ...register, items: register.items.filter((i) => i.status !== "PENDING_APPROVAL") };

  return NextResponse.json({ register: responseRegister });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const register = await prisma.register.findUnique({ where: { id } });
  if (!register) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (register.creatorId !== auth.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, city, dueDate, status } = await req.json();

  if (status === "CLOSED") {
    const updated = await prisma.$transaction(async (tx) => {
      const reg = await tx.register.update({
        where: { id },
        data: { status: "CLOSED", closedAt: new Date() },
      });
      // Cancel all unfunded items — refund of partial contributions deferred to Phase 4
      await tx.registerItem.updateMany({
        where: {
          registerId: id,
          status: { in: ["AVAILABLE", "PENDING_APPROVAL"] },
          fundingStatus: "UNFUNDED",
        },
        data: { status: "CANCELLED" },
      });
      return reg;
    });
    return NextResponse.json({ register: updated });
  }

  const updated = await prisma.register.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(city && { city }),
      ...(dueDate && { dueDate: new Date(dueDate) }),
    },
  });

  return NextResponse.json({ register: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getTokenFromRequest(_req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const register = await prisma.register.findUnique({ where: { id } });
  if (!register) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (register.creatorId !== auth.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.register.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
