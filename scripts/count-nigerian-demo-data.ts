/**
 * READ-ONLY count of records with a Nigerian location (demo/seed markers).
 * Writes nothing. Run against prod with its DATABASE_URL:
 *   DATABASE_URL="<prod-url>" npx tsx scripts/count-nigerian-demo-data.ts
 *
 * Purpose: decide whether the delete script is trivial (only the known seed
 * accounts) or whether real users have set Nigerian cities. It lists the
 * matching Users (name/email/role/created) so you can tell them apart.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Nigerian-location markers (seed neighborhoods + country/city names).
const MARKERS = [
  "lagos", "abuja", "nigeria", "ikeja", "lekki", "surulere",
  "victoria island", "yaba", "gbagada", "agege", "mushin", "ikoyi",
];
const OR = (field: string) => MARKERS.map((m) => ({ [field]: { contains: m, mode: "insensitive" as const } }));

async function main() {
  const [userCount, itemCount] = await Promise.all([
    prisma.user.count({ where: { OR: OR("location") } }),
    prisma.item.count({ where: { OR: OR("location") } }),
  ]);

  console.log(`Users with a Nigerian location: ${userCount}`);
  console.log(`Items with a Nigerian location: ${itemCount}\n`);

  const users = await prisma.user.findMany({
    where: { OR: OR("location") },
    select: { id: true, name: true, email: true, role: true, location: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log("── Matching users (eyeball seed vs real) ──");
  for (const u of users) {
    console.log(`  ${u.createdAt.toISOString().slice(0, 10)}  ${u.role.padEnd(9)}  "${u.location ?? ""}"  ${u.name}  <${u.email ?? "no-email"}>`);
  }

  const itemLocs = await prisma.item.findMany({
    where: { OR: OR("location") },
    select: { location: true },
    distinct: ["location"],
  });
  console.log(`\n── Distinct item locations matched (${itemLocs.length}) ──`);
  for (const i of itemLocs) console.log(`  "${i.location}"`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
