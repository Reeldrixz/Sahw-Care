import { prisma } from "@/lib/prisma";

const BLOCKS: Record<string, number> = {
  click:    1,
  listing:  2,
  donation: 4,
};

const LABELS: Record<string, string> = {
  click:    "Someone discovered Kradel through a shared link. That awareness helps more mothers find support.",
  listing:  "A new donor joined and listed their first item. That's one more family ready to help.",
  donation: "A donation was completed through your mission. That directly helped fund maternal essentials.",
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
