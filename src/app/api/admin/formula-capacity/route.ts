import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SINGLETON_ID = "singleton";

// Live-computed capacity snapshot. Nothing here is denormalised: the config row
// stores ONLY the admin-set slot cap; every other figure is counted fresh.
//
// An AWAITING_CONFIRMATION episode (admitted but not yet confirmed) RESERVES a
// slot and its full 6 months, so occupancy = ACTIVE + AWAITING_CONFIRMATION.
// That prevents over-admission while a mother is still confirming. Its deliveries
// don't exist until she confirms, so its committed months come from monthsTotal.
async function capacitySnapshot() {
  const [config, activeEpisodes, awaitingEpisodes, activeRemaining, awaitingAgg] = await Promise.all([
    prisma.formulaCapacityConfig.findUnique({ where: { id: SINGLETON_ID } }),
    prisma.formulaEpisode.count({ where: { status: "ACTIVE" } }),
    prisma.formulaEpisode.count({ where: { status: "AWAITING_CONFIRMATION" } }),
    // Remaining (un-fulfilled, un-cancelled) months across ACTIVE episodes.
    prisma.formulaDelivery.count({
      where: { status: { in: ["SCHEDULED", "DUE"] }, episode: { status: "ACTIVE" } },
    }),
    // Reserved months for awaiting episodes (deliveries not created yet).
    prisma.formulaEpisode.aggregate({
      where: { status: "AWAITING_CONFIRMATION" },
      _sum:  { monthsTotal: true },
    }),
  ]);

  // Fails closed: no config row (or never set) means 0 capacity = no admission.
  const maxActiveEpisodes = config?.maxActiveEpisodes ?? 0;
  const occupiedSlots = activeEpisodes + awaitingEpisodes;
  const committedMonths = activeRemaining + (awaitingAgg._sum.monthsTotal ?? 0);

  return {
    maxActiveEpisodes,
    activeEpisodes,
    awaitingEpisodes,
    occupiedSlots,
    committedMonths,
    availableSlots: maxActiveEpisodes - occupiedSlots,
  };
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(await capacitySnapshot());
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const raw = body.maxActiveEpisodes;

  // Non-negative integer only. Lowering below the current active count is
  // allowed (it just drives availableSlots negative, blocking new admissions);
  // it never force-ends an existing episode.
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) {
    return NextResponse.json(
      { error: "maxActiveEpisodes must be a non-negative whole number." },
      { status: 400 }
    );
  }

  await prisma.formulaCapacityConfig.upsert({
    where:  { id: SINGLETON_ID },
    update: { maxActiveEpisodes: raw, updatedByAdminId: admin.userId },
    create: { id: SINGLETON_ID, maxActiveEpisodes: raw, updatedByAdminId: admin.userId },
  });

  return NextResponse.json(await capacitySnapshot());
}
