import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { awardImpactPoints } from "@/lib/trust";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id } = await params;
    const { status, purchasedFrom, actualCostCents, trackingRef, notes } = await req.json();

    const validStatuses = ["PURCHASED", "DISPATCHED", "DELIVERED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const entry = await prisma.fulfillmentQueue.findUnique({
      where:   { id },
      include: {
        registerItem: {
          select: {
            id: true, name: true, registerId: true,
            register: { select: { creatorId: true } },
            funding: { where: { status: "CONFIRMED" }, select: { donorId: true } },
          },
        },
      },
    });

    if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const now = new Date();
    const updateData: Record<string, unknown> = { status };

    if (status === "PURCHASED") {
      updateData.purchasedAt = now;
      if (purchasedFrom) updateData.purchasedFrom = purchasedFrom;
      if (actualCostCents !== undefined) updateData.actualCostCents = actualCostCents;
    }
    if (status === "DISPATCHED") {
      updateData.dispatchedAt = now;
      if (trackingRef) updateData.trackingRef = trackingRef;
    }
    if (status === "DELIVERED") {
      updateData.deliveredAt = now;
    }
    if (notes) updateData.notes = notes;

    await prisma.$transaction(async (tx) => {
      await tx.fulfillmentQueue.update({ where: { id }, data: updateData });

      const creatorId = entry.registerItem.register.creatorId;
      const itemId    = entry.registerItem.id;
      const itemName  = entry.registerItem.name;
      const registerId = entry.registerItem.registerId;

      if (status === "PURCHASED") {
        await tx.notification.create({
          data: {
            userId:  creatorId,
            type:    "ITEM_PURCHASED",
            message: `We've purchased your item "${itemName}" and it's on the way.`,
            link:    `/registers/${registerId}`,
          },
        });
        await tx.registerItem.update({
          where: { id: itemId },
          data:  { fundingStatus: "IN_FULFILLMENT" },
        });
      }

      if (status === "DISPATCHED") {
        await tx.notification.create({
          data: {
            userId:  creatorId,
            type:    "ITEM_DISPATCHED",
            message: `Your item "${itemName}" has been dispatched! It's on its way to you.${trackingRef ? ` Tracking: ${trackingRef}` : ""}`,
            link:    `/registers/${registerId}`,
          },
        });
      }

      if (status === "DELIVERED") {
        await tx.registerItem.update({
          where: { id: itemId },
          data:  { fundingStatus: "FULFILLED", status: "FULFILLED" },
        });
        await tx.notification.create({
          data: {
            userId:  creatorId,
            type:    "ITEM_DELIVERED",
            message: `Your item "${itemName}" has been delivered. Please confirm receipt.`,
            link:    `/registers/${registerId}`,
          },
        });

        // Award + notify each unique donor
        const uniqueDonorIds = [...new Set(entry.registerItem.funding.map((f) => f.donorId))];
        for (const donorId of uniqueDonorIds) {
          awardImpactPoints(donorId, "REGISTER_ITEM_FULFILLED_DONOR", itemId).catch(() => {});
          await tx.notification.create({
            data: {
              userId:  donorId,
              type:    "ITEM_DELIVERED",
              message: `Great news! "${itemName}" has been delivered to the mother you supported.`,
              link:    `/registers/${registerId}`,
            },
          });
        }

        // Check if all items in the register are now fulfilled
        const remainingItems = await tx.registerItem.count({
          where: { registerId, fundingStatus: { not: "FULFILLED" }, id: { not: itemId } },
        });
        if (remainingItems === 0) {
          // All items fulfilled — notify all unique donors to the register
          const allDonors = await tx.registerItemFunding.findMany({
            where: { registerItem: { registerId }, status: "CONFIRMED" },
            select: { donorId: true },
            distinct: ["donorId"],
          });
          for (const { donorId } of allDonors) {
            await tx.notification.create({
              data: {
                userId:  donorId,
                type:    "ITEM_DELIVERED",
                message: `The register you supported is now fully complete — every item has been delivered to the mother. Thank you!`,
                link:    `/registers/${registerId}`,
              },
            });
          }
          await tx.notification.create({
            data: {
              userId:  creatorId,
              type:    "ITEM_DELIVERED",
              message: `All items in your register have been fulfilled. Your baby is ready! Thank you to everyone who helped.`,
              link:    `/registers/${registerId}`,
            },
          });
        }
      }
    });

    const updated = await prisma.fulfillmentQueue.findUnique({ where: { id } });
    return NextResponse.json({ entry: updated });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
