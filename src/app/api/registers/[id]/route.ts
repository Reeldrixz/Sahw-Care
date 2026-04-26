import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const register = await prisma.register.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, location: true } },
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
        },
      },
    },
  });

  if (!register) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ register });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const register = await prisma.register.findUnique({ where: { id } });
  if (!register) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (register.creatorId !== auth.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, city, dueDate } = await req.json();
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
