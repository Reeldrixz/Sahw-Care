import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ registerId: string }> };

function parseBody(body: Record<string, unknown>) {
  const { fullName, streetAddress, unit, city, province, postalCode, phone } = body;
  if (!fullName || !streetAddress || !city || !province || !postalCode || !phone) {
    return null;
  }
  return {
    fullName: String(fullName),
    streetAddress: String(streetAddress),
    unit: unit ? String(unit) : null,
    city: String(city),
    province: String(province),
    postalCode: String(postalCode),
    phone: String(phone),
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { registerId } = await params;
  const address = await prisma.registerAddress.findUnique({ where: { registerId } });
  if (!address) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ address });
}

export async function POST(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { registerId } = await params;
  const register = await prisma.register.findUnique({ where: { id: registerId } });
  if (!register) return NextResponse.json({ error: "Register not found" }, { status: 404 });
  if (register.addressMode !== "SAVED_PER_REGISTER") {
    return NextResponse.json({ error: "Register is not in SAVED_PER_REGISTER mode" }, { status: 400 });
  }
  if (register.status !== "ACTIVE") {
    return NextResponse.json({ error: "Register must be ACTIVE to set a saved address" }, { status: 400 });
  }

  const existing = await prisma.registerAddress.findUnique({ where: { registerId } });
  if (existing) return NextResponse.json({ error: "Address already exists — use PUT to update" }, { status: 409 });

  const body = parseBody(await req.json());
  if (!body) return NextResponse.json({ error: "fullName, streetAddress, city, province, postalCode and phone are required" }, { status: 400 });

  const address = await prisma.registerAddress.create({ data: { registerId, ...body } });
  return NextResponse.json({ address }, { status: 201 });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { registerId } = await params;
  const existing = await prisma.registerAddress.findUnique({ where: { registerId } });
  if (!existing) return NextResponse.json({ error: "No saved address found — use POST to create" }, { status: 404 });

  const body = parseBody(await req.json());
  if (!body) return NextResponse.json({ error: "fullName, streetAddress, city, province, postalCode and phone are required" }, { status: 400 });

  const address = await prisma.registerAddress.update({ where: { registerId }, data: body });
  return NextResponse.json({ address });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { registerId } = await params;
  const existing = await prisma.registerAddress.findUnique({ where: { registerId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.registerAddress.delete({ where: { registerId } });
  return NextResponse.json({ ok: true });
}
