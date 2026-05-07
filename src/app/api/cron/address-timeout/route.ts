import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now            = new Date();
  const sevenDaysAgo   = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // ── Sweep A: 7-day reminder ────────────────────────────────────────────────
  const reminderCandidates = await prisma.registerItem.findMany({
    where: {
      status:    "AWAITING_ADDRESS",
      updatedAt: { lte: sevenDaysAgo, gt: fourteenDaysAgo },
    },
    select: {
      id: true, name: true, registerId: true,
      register: { select: { id: true, creatorId: true } },
    },
    take: 200,
  });

  let remindersCount = 0;
  for (const item of reminderCandidates) {
    const reminderLink = `/registers/${item.register.id}?confirm=true&item=${item.id}`;
    const recentReminder = await prisma.notification.findFirst({
      where: {
        userId:    item.register.creatorId,
        type:      "ADDRESS_REMINDER",
        link:      reminderLink,
        createdAt: { gte: sevenDaysAgo },
      },
    });
    if (recentReminder) continue;

    await prisma.notification.create({
      data: {
        userId:  item.register.creatorId,
        type:    "ADDRESS_REMINDER",
        message: `Reminder: your ${item.name} needs a shipping address. We'll hold it for one more week. After that, contributions will be refunded and the item removed from your register.`,
        link:    reminderLink,
      },
    });
    remindersCount++;
  }

  // ── Sweep B: 14-day cancellation ──────────────────────────────────────────
  const expiredItems = await prisma.registerItem.findMany({
    where: {
      status:    "AWAITING_ADDRESS",
      updatedAt: { lte: fourteenDaysAgo },
    },
    select: {
      id: true, name: true, registerId: true,
      register: { select: { id: true, creatorId: true } },
    },
    take: 100,
  });

  const stripe = getStripe();
  let cancelledCount = 0;
  let refundFailures = 0;

  for (const item of expiredItems) {
    const fundings = await prisma.registerItemFunding.findMany({
      where:  { registerItemId: item.id, status: "CONFIRMED" },
      select: { id: true, amountCents: true, donorId: true, stripePaymentIntentId: true },
    });

    const successfulRefundIds: string[] = [];
    for (const f of fundings) {
      if (!f.stripePaymentIntentId) continue;
      try {
        await stripe.refunds.create({ payment_intent: f.stripePaymentIntentId });
        successfulRefundIds.push(f.id);
      } catch (err) {
        console.error(`Address timeout: refund failed for funding ${f.id}:`, err);
        refundFailures++;
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const fId of successfulRefundIds) {
        await tx.registerItemFunding.update({
          where: { id: fId },
          data:  { status: "REFUNDED", refundedAt: now },
        });
      }
      await tx.registerItem.update({
        where: { id: item.id },
        data:  { status: "CANCELLED", fundingStatus: "UNFUNDED", totalFundedCents: 0 },
      });
      await tx.notification.create({
        data: {
          userId:  item.register.creatorId,
          type:    "ADDRESS_TIMEOUT_CANCELLED",
          message: `Your ${item.name} has been removed from your register because we didn't receive a shipping address in time. Contributions have been refunded to donors.`,
          link:    `/registers/${item.register.id}`,
        },
      });
      for (const f of fundings) {
        if (!successfulRefundIds.includes(f.id)) continue;
        await tx.notification.create({
          data: {
            userId:  f.donorId,
            type:    "ADDRESS_TIMEOUT_CANCELLED",
            message: `Your $${(f.amountCents / 100).toFixed(2)} contribution to "${item.name}" has been refunded. The item couldn't be shipped within our timeline.`,
            link:    `/registers/${item.register.id}`,
          },
        });
      }
    });
    cancelledCount++;
  }

  return NextResponse.json({
    ok:             true,
    reminders:      remindersCount,
    cancelled:      cancelledCount,
    refundFailures,
    timestamp:      now.toISOString(),
  });
}
