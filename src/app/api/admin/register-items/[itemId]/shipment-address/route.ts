import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ itemId: string }> };

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

  const { itemId } = await params;
  const address = await prisma.shipmentAddress.findUnique({ where: { registerItemId: itemId } });
  if (!address) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ address });
}

export async function POST(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { itemId } = await params;
  const item = await prisma.registerItem.findUnique({
    where: { id: itemId },
    include: { register: { select: { addressMode: true } } },
  });
  if (!item) return NextResponse.json({ error: "Register item not found" }, { status: 404 });
  if (item.register.addressMode !== "ASK_PER_SHIPMENT") {
    return NextResponse.json({ error: "Register is not in ASK_PER_SHIPMENT mode" }, { status: 400 });
  }

  const existing = await prisma.shipmentAddress.findUnique({ where: { registerItemId: itemId } });
  if (existing) return NextResponse.json({ error: "Shipment address already exists — use PUT to update" }, { status: 409 });

  const body = parseBody(await req.json());
  if (!body) return NextResponse.json({ error: "fullName, streetAddress, city, province, postalCode and phone are required" }, { status: 400 });

  const address = await prisma.shipmentAddress.create({ data: { registerItemId: itemId, ...body } });
  return NextResponse.json({ address }, { status: 201 });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { itemId } = await params;
  const existing = await prisma.shipmentAddress.findUnique({ where: { registerItemId: itemId } });
  if (!existing) return NextResponse.json({ error: "No shipment address found — use POST to create" }, { status: 404 });

  const body = parseBody(await req.json());
  if (!body) return NextResponse.json({ error: "fullName, streetAddress, city, province, postalCode and phone are required" }, { status: 400 });

  const address = await prisma.shipmentAddress.update({ where: { registerItemId: itemId }, data: body });
  return NextResponse.json({ address });
}
