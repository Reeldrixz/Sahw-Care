/**
 * One-time script: restore trust points lost to DISCOVER_REQUEST deductions.
 *
 * Finds all users with negative DISCOVER_REQUEST entries in trustScoreLog,
 * adds back the absolute value of those points, and logs a DISCOVER_REQUEST_RESTORED event.
 *
 * Run: npx ts-node --project tsconfig.json scripts/restore-request-trust.ts
 * (or: npx tsx scripts/restore-request-trust.ts)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Sum deductions per user
  const deductions = await prisma.trustScoreLog.groupBy({
    by: ["userId"],
    where: { eventType: "DISCOVER_REQUEST", pointsDelta: { lt: 0 } },
    _sum: { pointsDelta: true },
  });

  if (deductions.length === 0) {
    console.log("No DISCOVER_REQUEST deductions found — nothing to restore.");
    return;
  }

  console.log(`Found ${deductions.length} users with DISCOVER_REQUEST deductions.`);

  let restored = 0;
  for (const row of deductions) {
    const totalDeducted = row._sum.pointsDelta ?? 0; // negative
    if (totalDeducted >= 0) continue;
    const pointsToRestore = Math.abs(totalDeducted);

    const user = await prisma.user.findUnique({
      where: { id: row.userId },
      select: { id: true, name: true, trustScore: true },
    });
    if (!user) continue;

    const newScore = user.trustScore + pointsToRestore;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { trustScore: newScore },
      }),
      prisma.trustScoreLog.create({
        data: {
          userId: user.id,
          eventType: "DISCOVER_REQUEST_RESTORED",
          pointsDelta: pointsToRestore,
          newScore,
        },
      }),
    ]);

    console.log(`Restored +${pointsToRestore} to ${user.name} (${user.id}) → new score: ${newScore}`);
    restored++;
  }

  console.log(`\nDone. Restored trust for ${restored} users.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
