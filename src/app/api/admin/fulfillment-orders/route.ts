import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateOrderFields, type OrderFields } from "@/lib/fulfillmentOrder";

export const dynamic = "force-dynamic";

// Record order (step 9): the only way an item becomes Purchased. One order
// covers one or more QUEUED items of a single register. In one transaction it
// creates the order, moves those items to PURCHASED with the order attached,
// and sends the existing "we've purchased your item" notifications.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }

  const queueIds = Array.isArray(body.queueIds) ? [...new Set(body.queueIds.filter((x): x is string => typeof x === "string"))] : [];
  if (queueIds.length === 0 || queueIds.length > 100) {
    return NextResponse.json({ error: "Tick at least one queued item." }, { status: 400 });
  }
  const v = validateOrderFields(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const fields = v.fields as OrderFields;
  const purchasedFrom = typeof body.purchasedFrom === "string" && body.purchasedFrom.trim() ? body.purchasedFrom.trim().slice(0, 100) : null;
  const notes         = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 1000) : null;

  const entries = await prisma.fulfillmentQueue.findMany({
    where:  { id: { in: queueIds } },
    select: {
      id: true, status: true,
      registerItem: { select: { id: true, name: true, registerId: true, register: { select: { creatorId: true } } } },
    },
  });
  if (entries.length !== queueIds.length) return NextResponse.json({ error: "Some items weren't found. Reload and try again." }, { status: 404 });
  if (entries.some((e) => e.status !== "QUEUED")) {
    return NextResponse.json({ error: "Only queued items can be put in an order." }, { status: 400 });
  }
  const registerIds = new Set(entries.map((e) => e.registerItem.registerId));
  if (registerIds.size !== 1) {
    return NextResponse.json({ error: "An order can only cover items of one register." }, { status: 400 });
  }
  const registerId = entries[0].registerItem.registerId;
  const creatorId  = entries[0].registerItem.register.creatorId;

  try {
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.fulfillmentOrder.create({
        data: { ...fields, registerId, createdById: admin.userId },
        select: { id: true },
      });
      // Re-checked in the UPDATE: an item another admin ordered meanwhile is
      // no longer QUEUED, the count comes up short, and the whole order rolls back.
      const now = new Date();
      const moved = await tx.fulfillmentQueue.updateMany({
        where: { id: { in: queueIds }, status: "QUEUED", orderId: null },
        data:  {
          status: "PURCHASED", purchasedAt: now, orderId: created.id,
          ...(purchasedFrom && { purchasedFrom }),
          ...(notes && { notes }),
        },
      });
      if (moved.count !== queueIds.length) throw new Error("RACE");

      for (const e of entries) {
        await tx.notification.create({
          data: {
            userId:  creatorId,
            type:    "ITEM_PURCHASED",
            message: `We've purchased your item "${e.registerItem.name}" and it's on the way.`,
            link:    `/registers/${registerId}`,
          },
        });
      }
      await tx.registerItem.updateMany({
        where: { id: { in: entries.map((e) => e.registerItem.id) } },
        data:  { fundingStatus: "IN_FULFILLMENT" },
      });
      return created;
    });
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof Error && err.message === "RACE") {
      return NextResponse.json({ error: "Some of these items were ordered meanwhile. Reload and try again." }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
