import { prisma } from "@/lib/prisma";

const BLOCKS: Record<string, number> = {
  click:    1,
  listing:  2,
  donation: 4,
};

const LABELS: Record<string, string> = {
  click:    "Someone joined the Kradel community through your link. That's the first step toward more support for mothers.",
  listing:  "A new member posted their first listing. That's one more family ready to help mothers in need.",
  donation: "An essential was delivered to a mother in need — funded by this team's collective effort.",
};

export async function recordMissionAction(
  userId: string,
  actionType: "click" | "listing" | "donation",
  overrideTeamId?: string,
): Promise<void> {
  try {
    const blocks     = BLOCKS[actionType];
    const humanLabel = LABELS[actionType];

    let teamId = overrideTeamId;

    if (!teamId) {
      const membership = await prisma.missionMember.findFirst({
        where: { userId, isActive: true },
        include: { team: { include: { mission: true } } },
      });
      if (!membership) return;
      if (!membership.team.mission.isActive) return;
      teamId = membership.teamId;
    }

    await prisma.$transaction([
      prisma.missionAction.create({
        data: { teamId, userId, actionType, blocks, humanLabel },
      }),
      prisma.missionTeam.update({
        where: { id: teamId },
        data:  { totalBlocks: { increment: blocks } },
      }),
    ]);

    // Check completion
    const team = await prisma.missionTeam.findUnique({
      where:   { id: teamId },
      include: { mission: true },
    });
    if (team && !team.isComplete && team.totalBlocks >= team.mission.goalBlocks) {
      await prisma.missionTeam.update({
        where: { id: teamId },
        data:  { isComplete: true },
      });
    }
  } catch {
    // fire-and-forget — never let mission errors affect core flows
  }
}
