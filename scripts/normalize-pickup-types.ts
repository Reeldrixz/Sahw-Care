import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RENAMES: { id: string; name: string; oldType: string; newType: string }[] = [
  { id: "seed-toronto-freshco",            name: "FreshCo",                 oldType: "GROCERY",          newType: "GROCERY_STORE" },
  { id: "seed-toronto-walmart",            name: "Walmart",                 oldType: "GROCERY",          newType: "GROCERY_STORE" },
  { id: "seed-lagos-shoprite",             name: "Shoprite",                oldType: "GROCERY",          newType: "GROCERY_STORE" },
  { id: "seed-toronto-scarborough-town-centre", name: "Scarborough Town Centre", oldType: "COMMUNITY_CENTRE", newType: "MALL" },
  { id: "seed-lagos-maryland-mall",        name: "Maryland Mall",           oldType: "COMMUNITY_CENTRE", newType: "MALL" },
  { id: "seed-lagos-jara-mall",            name: "Jara Mall",               oldType: "GROCERY",          newType: "MALL" },
];

async function main() {
  let updated = 0;
  let unchanged = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of RENAMES) {
      const current = await tx.publicPickupLocation.findUnique({
        where: { id: row.id },
        select: { id: true, type: true },
      });

      if (!current) {
        console.log(`  SKIP  ${row.name}: row not found (id=${row.id})`);
        continue;
      }

      if (current.type === row.newType) {
        console.log(`  --    ${row.name}: already ${row.newType} (no change)`);
        unchanged++;
        continue;
      }

      await tx.publicPickupLocation.update({
        where: { id: row.id },
        data: { type: row.newType },
      });
      console.log(`  OK    ${row.name}: ${row.oldType} → ${row.newType}`);
      updated++;
    }
  });

  console.log(`\nDone. ${updated} rows updated, ${unchanged} rows unchanged.`);
}

main()
  .catch((e) => { console.error("ERROR:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
