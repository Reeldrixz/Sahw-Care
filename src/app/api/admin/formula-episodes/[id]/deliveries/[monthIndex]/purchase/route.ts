import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// F4: record that this month's formula was bought, and hand back the link to
// open. THE SAFETY BLOCK LIVES HERE: without purchaseUrlConfirmedAt — set only
// by the mother (F3) — this endpoint refuses, so an admin can never purchase a
// product she hasn't checked. There is deliberately no override.
//
// We stamp at click and then open Amazon, because we cannot observe the actual
// checkout. Complete (fulfill) is the real second gate, and DELETE below undoes
// a mis-click.

async function loadContext(id: string, monthIndexRaw: string) {
  const monthIndex = Number(monthIndexRaw);
  if (!Number.isInteger(monthIndex) || monthIndex < 1) {
    return { error: NextResponse.json({ error: "Invalid month." }, { status: 400 }) };
  }

  const episode = await prisma.formulaEpisode.findUnique({
    where:  { id },
    select: { id: true, status: true, monthsTotal: true, purchaseUrl: true, purchaseUrlConfirmedAt: true },
  });
  if (!episode) return { error: NextResponse.json({ error: "Episode not found" }, { status: 404 }) };
  if (episode.status !== "ACTIVE") {
    return { error: NextResponse.json({ error: "Only an active episode's months can be purchased." }, { status: 409 }) };
  }
  if (monthIndex > episode.monthsTotal) {
    return { error: NextResponse.json({ error: `This episode only has ${episode.monthsTotal} months.` }, { status: 400 }) };
  }

  const delivery = await prisma.formulaDelivery.findUnique({
    where:  { episodeId_monthIndex: { episodeId: episode.id, monthIndex } },
    select: { id: true, status: true, purchasedAt: true },
  });
  if (!delivery) return { error: NextResponse.json({ error: "Delivery not found for that month." }, { status: 404 }) };

  return { episode, delivery, monthIndex };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; monthIndex: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, monthIndex: monthIndexRaw } = await params;
  const ctx = await loadContext(id, monthIndexRaw);
  if ("error" in ctx) return ctx.error;
  const { episode, delivery, monthIndex } = ctx;

  if (!episode.purchaseUrl) {
    return NextResponse.json({ error: "Add a purchase link before buying.", code: "NO_LINK" }, { status: 409 });
  }
  // The block. Only her confirmation opens this.
  if (!episode.purchaseUrlConfirmedAt) {
    return NextResponse.json({
      error: "She hasn't confirmed this product yet, so it can't be purchased. Send her the link and wait for her to check it.",
      code:  "NOT_CONFIRMED",
    }, { status: 409 });
  }
  if (delivery.status === "FULFILLED") {
    return NextResponse.json({ error: "That month is already fulfilled." }, { status: 409 });
  }
  if (delivery.status === "CANCELLED") {
    return NextResponse.json({ error: "That month was cancelled." }, { status: 409 });
  }

  // Idempotent: a second click just reopens the listing, never re-stamps.
  if (delivery.purchasedAt) {
    return NextResponse.json({ ok: true, monthIndex, purchaseUrl: episode.purchaseUrl, alreadyPurchased: true });
  }

  await prisma.formulaDelivery.update({
    where: { episodeId_monthIndex: { episodeId: episode.id, monthIndex } },
    data:  {
      purchasedAt:           new Date(),
      purchasedByAdminId:    admin.userId,
      purchaseUrlAtPurchase: episode.purchaseUrl, // exactly what was bought
    },
  });

  return NextResponse.json({ ok: true, monthIndex, purchaseUrl: episode.purchaseUrl });
}

// Undo a purchase stamp. The necessary exit when she retracts her confirmation
// after a purchase (the month would otherwise be uncompletable), and for a plain
// mis-click. Refuses once the month is FULFILLED — completed history is not
// rewritten here.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; monthIndex: string }> }
) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, monthIndex: monthIndexRaw } = await params;
  const ctx = await loadContext(id, monthIndexRaw);
  if ("error" in ctx) return ctx.error;
  const { episode, delivery, monthIndex } = ctx;

  if (delivery.status === "FULFILLED") {
    return NextResponse.json({
      error: "That month is already fulfilled — its purchase record can't be reset.",
      code:  "ALREADY_FULFILLED",
    }, { status: 409 });
  }
  if (!delivery.purchasedAt) {
    return NextResponse.json({ error: "That month isn't marked as purchased.", code: "NOT_PURCHASED" }, { status: 409 });
  }

  await prisma.formulaDelivery.update({
    where: { episodeId_monthIndex: { episodeId: episode.id, monthIndex } },
    data:  { purchasedAt: null, purchasedByAdminId: null, purchaseUrlAtPurchase: null },
  });

  return NextResponse.json({ ok: true, monthIndex });
}
