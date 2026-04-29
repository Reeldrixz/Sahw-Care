import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LOCATIONS = [
  // Toronto
  { name: "FreshCo", type: "GROCERY", city: "Toronto", address: "Toronto, ON" },
  { name: "Walmart", type: "GROCERY", city: "Toronto", address: "Toronto, ON" },
  { name: "Tim Hortons", type: "CAFE", city: "Toronto", address: "Toronto, ON" },
  { name: "Toronto Public Library", type: "LIBRARY", city: "Toronto", address: "Toronto, ON" },
  { name: "Shoppers Drug Mart", type: "PHARMACY", city: "Toronto", address: "Toronto, ON" },
  { name: "Scarborough Town Centre", type: "COMMUNITY_CENTRE", city: "Toronto", address: "Scarborough, Toronto, ON" },
  // Lagos
  { name: "Shoprite", type: "GROCERY", city: "Lagos", address: "Lagos, Nigeria" },
  { name: "Cold Stone Creamery", type: "CAFE", city: "Lagos", address: "Lagos, Nigeria" },
  { name: "Maryland Mall", type: "COMMUNITY_CENTRE", city: "Lagos", address: "Maryland, Lagos" },
  { name: "Lagos Public Library", type: "LIBRARY", city: "Lagos", address: "Lagos, Nigeria" },
  { name: "Jara Mall", type: "GROCERY", city: "Lagos", address: "Lagos, Nigeria" },
];

async function main() {
  console.log("Seeding pickup locations…");
  for (const loc of LOCATIONS) {
    await prisma.publicPickupLocation.upsert({
      where: { id: `seed-${loc.city.toLowerCase()}-${loc.name.toLowerCase().replace(/\s+/g, "-")}` },
      update: {},
      create: {
        id: `seed-${loc.city.toLowerCase()}-${loc.name.toLowerCase().replace(/\s+/g, "-")}`,
        ...loc,
      },
    });
    console.log(`  ✓ ${loc.name} (${loc.city})`);
  }
  console.log("Done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
