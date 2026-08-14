import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SINGLETON_ID = "singleton";

// Live-computed capacity snapshot. Nothing here is denormalised: the config row
// stores ONLY the admin-set slot cap; active-episode count and committed
// formula-months are counted fresh every read.
async function capacitySnapshot() {
  const [config, activeEpisodes, committedMonths] = await Promise.all([
    prisma.formulaCapacityConfig.findUnique({ where: { id: SINGLETON_ID } }),
    prisma.formulaEpisode.count({ where: { status: "ACTIVE" } }),
    // Remaining (un-fulfilled, un-cancelled) months across ACTIVE episodes =
    // the programme's committed future formula obligation.
    prisma.formulaDelivery.count({
      where: { status: { in: ["SCHEDULED", "DUE"] }, episode: { status: "ACTIVE" } },
    }),
  ]);

  // Fails closed: no config row (or never set) means 0 capacity = no admission.
  const maxActiveEpisodes = config?.maxActiveEpisodes ?? 0;

  return {
    maxActiveEpisodes,
    activeEpisodes,
    committedMonths,
    availableSlots: maxActiveEpisodes - activeEpisodes,
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
