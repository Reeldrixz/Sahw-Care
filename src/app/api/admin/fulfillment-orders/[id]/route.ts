import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateOrderFields, TAX_OVER_TOTAL_ERROR } from "@/lib/fulfillmentOrder";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Edit a recorded order: the order number, total, tax, tracking link and estimated
// delivery date (estimates change). Only the fields sent are checked and changed.
// The items it covers don't change here.
export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  const v = validateOrderFields(body, true);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  if (Object.keys(v.fields).length === 0) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const { id } = await params;
  const current = await prisma.fulfillmentOrder.findUnique({ where: { id }, select: { totalCents: true, taxCents: true } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Tax must stay within the total, whichever of the two this edit changes.
  const total = v.fields.totalCents ?? current.totalCents;
  const tax   = v.fields.taxCents !== undefined ? v.fields.taxCents : current.taxCents;
  if (tax !== null && tax > total) return NextResponse.json({ error: TAX_OVER_TOTAL_ERROR }, { status: 400 });

  // Every edit records who made it and when. Conditional on the total and tax
  // just read, so a concurrent edit can't slip the tax past the total.
  const updated = await prisma.fulfillmentOrder.updateMany({
    where: { id, totalCents: current.totalCents, taxCents: current.taxCents },
    data:  { ...v.fields, updatedById: admin.userId, updatedAt: new Date() },
  });
  if (updated.count === 0) return NextResponse.json({ error: "This order changed meanwhile. Reload and try again." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
