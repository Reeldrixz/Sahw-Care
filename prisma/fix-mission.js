const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const correctMonth = new Date().toISOString().slice(0, 7); // "2026-05"
  console.log("Fixing mission month to:", correctMonth);

  // Fix any mission with the wrong month string
  const wrongMonth = await prisma.mission.updateMany({
    where: { month: "May 2026" },
    data:  { month: correctMonth, isActive: true },
  });
  console.log(`Updated ${wrongMonth.count} mission(s) from "May 2026" → "${correctMonth}"`);

  // Check if the correct mission already exists
  const existing = await prisma.mission.findFirst({
    where: { month: correctMonth, isActive: true },
  });

  if (!existing) {
    // Seed a fresh mission
    const donors = await prisma.user.findMany({
      where:  { role: "DONOR", status: "ACTIVE" },
      take:   3,
      select: { id: true, name: true },
    });

    const mission = await prisma.mission.create({
      data: {
        name:        "Newborn Essentials Drive",
        description: "Help five families get through their first month with a newborn. Every action your team takes funds diapers, formula, and maternity pads for mothers in your community.",
        month:       correctMonth,
        category:    "bundles",
        goalBlocks:  40,
        isActive:    true,
      },
    });

    const team = await prisma.missionTeam.create({
      data: { missionId: mission.id, totalBlocks: 18 },
    });

    for (const d of donors) {
      await prisma.missionMember.create({
        data: { teamId: team.id, userId: d.id, isActive: true },
      });
    }

    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const actions = [
      { actionType: "donation", blocks: 4, humanLabel: "A donation was completed through your mission. That directly helped fund maternal essentials." },
      { actionType: "donation", blocks: 4, humanLabel: "A donation was completed through your mission. That directly helped fund maternal essentials." },
      { actionType: "listing",  blocks: 2, humanLabel: "A new donor joined and listed their first item. That's one more family ready to help." },
      { actionType: "click",    blocks: 1, humanLabel: "Someone discovered Kradel through a shared link. That awareness helps more mothers find support." },
      { actionType: "donation", blocks: 4, humanLabel: "A donation was completed through your mission. That directly helped fund maternal essentials." },
      { actionType: "click",    blocks: 1, humanLabel: "Someone discovered Kradel through a shared link. That awareness helps more mothers find support." },
      { actionType: "click",    blocks: 1, humanLabel: "Someone discovered Kradel through a shared link. That awareness helps more mothers find support." },
      { actionType: "donation", blocks: 4, humanLabel: "A donation was completed through your mission. That directly helped fund maternal essentials." },
    ];

    const userIds = donors.map(d => d.id);
    for (let i = 0; i < actions.length; i++) {
      await prisma.missionAction.create({
        data: { ...actions[i], teamId: team.id, userId: userIds[i % userIds.length] || userIds[0], createdAt: past },
      });
    }

    console.log(`Created mission "${mission.name}" with ${donors.length} members, 18 blocks`);
  } else {
    console.log(`Mission already exists: "${existing.name}" (${existing.id}), month=${existing.month}, isActive=${existing.isActive}`);
  }

  // Verify
  const check = await prisma.mission.findMany({ where: { month: correctMonth, isActive: true } });
  console.log(`\n✓ Verified: ${check.length} active mission(s) for month "${correctMonth}"`);
  check.forEach(m => console.log(`  - ${m.id}: "${m.name}"`));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
