import { prisma } from "@/lib/prisma";

export type ActionType =
  | "click"
  | "signup"
  | "listing_posted"
  | "register_committed"
  | "listing_completed"
  | "register_fulfilled"
  | "bundle_delivered";

export interface MissionActionMeta {
  category?:    string; // "Postpartum", "Newborn", "Pregnancy", "Labour"
  itemName?:    string; // bundle name or item title
  stage?:       string; // bundle stage label
  referenceId?: string; // item/register/bundle ID for upgrade-in-place matching
}

const BLOCKS: Record<ActionType, number> = {
  click:               1,
  signup:              2,
  listing_posted:      2,
  register_committed:  2,
  listing_completed:   4,
  register_fulfilled:  4,
  bundle_delivered:    4,
};

const LABELS: Record<ActionType, string> = {
  click:               "Someone discovered Kradel through your shared link.",
  signup:              "A new member joined Kradel through your link.",
  listing_posted:      "A new item was listed on Discover through someone you brought in.",
  register_committed:  "A donation was committed toward a mom's register request.",
  listing_completed:   "A mom received [category] essentials through your link.",
  register_fulfilled:  "A mom received a [category] donation through your link.",
  bundle_delivered:    "A mom received [itemName] · [stage].",
};

// When a completion fires, look for and upgrade the matching intent action
const UPGRADE_FROM: Partial<Record<ActionType, ActionType>> = {
  listing_completed:  "listing_posted",
  register_fulfilled: "register_committed",
};

export async function recordMissionAction(
  userId:          string,
  actionType:      ActionType,
  overrideTeamId?: string,
  meta?:           MissionActionMeta,
): Promise<void> {
  try {
    const blocks = BLOCKS[actionType];
    let humanLabel = LABELS[actionType];

    if (meta?.category) humanLabel = humanLabel.replace("[category]", meta.category);
    if (meta?.itemName) humanLabel = humanLabel.replace("[itemName]",  meta.itemName);
    if (meta?.stage)    humanLabel = humanLabel.replace("[stage]",     meta.stage);

    let teamId = overrideTeamId;
    if (!teamId) {
      const membership = await prisma.missionMember.findFirst({
        where:   { userId, isActive: true },
        include: { team: { include: { mission: true } } },
      });
      if (!membership) return;
      if (!membership.team.mission.isActive) return;
      teamId = membership.teamId;
    }

    const priorType = UPGRADE_FROM[actionType];

    if (priorType) {
      // Try to find and upgrade an existing intent action
      const prior = await prisma.missionAction.findFirst({
        where: {
          teamId,
          userId,
          actionType: priorType,
          ...(meta?.referenceId ? { referenceId: meta.referenceId } : {}),
        },
        orderBy: { createdAt: "desc" },
      });

      if (prior) {
        const delta = blocks - prior.blocks; // +2 (4-2)
        await prisma.$transaction([
          prisma.missionAction.update({
            where: { id: prior.id },
            data:  { actionType, blocks, humanLabel },
          }),
          prisma.missionTeam.update({
            where: { id: teamId },
            data:  { totalBlocks: { increment: delta } },
          }),
        ]);
      } else {
        // No prior intent found — create at full value
        await prisma.$transaction([
          prisma.missionAction.create({
            data: {
              teamId, userId, actionType, blocks, humanLabel,
              ...(meta?.referenceId ? { referenceId: meta.referenceId } : {}),
            },
          }),
          prisma.missionTeam.update({
            where: { id: teamId },
            data:  { totalBlocks: { increment: blocks } },
          }),
        ]);
      }
    } else {
      await prisma.$transaction([
        prisma.missionAction.create({
          data: {
            teamId, userId, actionType, blocks, humanLabel,
            ...(meta?.referenceId ? { referenceId: meta.referenceId } : {}),
          },
        }),
        prisma.missionTeam.update({
          where: { id: teamId },
          data:  { totalBlocks: { increment: blocks } },
        }),
      ]);
    }

    // Check mission completion
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
