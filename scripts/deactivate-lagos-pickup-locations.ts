import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.publicPickupLocation.updateMany({
    where: { city: "Lagos" },
    data: { isActive: false },
  });
  console.log(`Deactivated ${result.count} Lagos pickup location(s).`);

  const rows = await prisma.publicPickupLocation.findMany({
    select: { name: true, city: true, isActive: true },
    orderBy: [{ city: "asc" }, { name: "asc" }],
  });

  console.log("\nAll pickup locations:");
  console.log("name                       city      isActive");
  console.log("─".repeat(52));
  for (const r of rows) {
    console.log(`${r.name.padEnd(27)}${r.city.padEnd(10)}${r.isActive}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
