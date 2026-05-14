import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/missions — list active missions for the current month
export async function GET() {
  const month = new Date().toISOString().slice(0, 7); // "2026-05"

  const missions = await prisma.mission.findMany({
    where: { isActive: true, month },
    include: {
      teams: {
        include: {
          _count: { select: { members: { where: { isActive: true } } } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const result = missions.map((m) => {
    const totalMembers = m.teams.reduce((sum, t) => sum + t._count.members, 0);
    const openSpots    = Math.max(0, m.teams.length * 5 - totalMembers + 5); // assume at least one new team slot
    const avgBlocks    = m.teams.length
      ? Math.round(m.teams.reduce((s, t) => s + t.totalBlocks, 0) / m.teams.length)
      : 0;
    return {
      id:          m.id,
      name:        m.name,
      description: m.description,
      month:       m.month,
      category:    m.category,
      goalBlocks:  m.goalBlocks,
      totalMembers,
      openSpots,
      avgBlocks,
    };
  });

  return NextResponse.json({ missions: result });
}
