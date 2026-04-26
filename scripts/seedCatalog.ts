import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATALOG = [
  { name: "Diaper Pack (Newborn)",    category: "Feeding/Diapering", standardPriceCents: 3500 },
  { name: "Diaper Pack (Size 1)",     category: "Feeding/Diapering", standardPriceCents: 3800 },
  { name: "Baby Wipes (3 pack)",      category: "Feeding/Diapering", standardPriceCents: 1200 },
  { name: "Baby Formula (1 tin)",     category: "Feeding/Diapering", standardPriceCents: 2800 },
  { name: "Feeding Bottles (set of 3)", category: "Feeding/Diapering", standardPriceCents: 1800 },
  { name: "Breast Pump (manual)",     category: "Feeding/Diapering", standardPriceCents: 3800 },
  { name: "Onesies (5 pack, 0-3m)",   category: "Clothing",          standardPriceCents: 2200 },
  { name: "Onesies (5 pack, 3-6m)",   category: "Clothing",          standardPriceCents: 2400 },
  { name: "Swaddle Blankets (3 pack)", category: "Clothing",          standardPriceCents: 2000 },
  { name: "Baby Sleepsuits (3 pack)", category: "Clothing",          standardPriceCents: 2500 },
  { name: "Burp Cloths (6 pack)",     category: "Hygiene",           standardPriceCents: 1400 },
  { name: "Baby Wash & Shampoo",      category: "Hygiene",           standardPriceCents: 1200 },
  { name: "Baby Lotion",              category: "Hygiene",           standardPriceCents: 1000 },
  { name: "Baby Bathtub",             category: "Hygiene",           standardPriceCents: 2800 },
  { name: "Baby Towels (2 pack)",     category: "Hygiene",           standardPriceCents: 1600 },
  { name: "Thermometer",              category: "Hygiene",           standardPriceCents: 1800 },
  { name: "Nail Clipper Set",         category: "Hygiene",           standardPriceCents:  800 },
  { name: "Maternity Pads (2 packs)", category: "Maternity",         standardPriceCents: 1400 },
  { name: "Nursing Bras (2 pack)",    category: "Maternity",         standardPriceCents: 3200 },
  { name: "Breast Pads (60 pack)",    category: "Maternity",         standardPriceCents: 1200 },
  { name: "Maternity Pillow",         category: "Maternity",         standardPriceCents: 4500 },
];

async function main() {
  console.log("Seeding item catalog...");
  for (const item of CATALOG) {
    await prisma.itemCatalog.upsert({
      where: { id: item.name }, // use name as stable key via create
      update: { standardPriceCents: item.standardPriceCents, isActive: true },
      create: item,
    }).catch(async () => {
      // upsert by name requires unique constraint; use findFirst + create instead
      const existing = await prisma.itemCatalog.findFirst({ where: { name: item.name } });
      if (!existing) {
        await prisma.itemCatalog.create({ data: item });
        console.log(`  Created: ${item.name}`);
      } else {
        await prisma.itemCatalog.update({ where: { id: existing.id }, data: { standardPriceCents: item.standardPriceCents, isActive: true } });
        console.log(`  Updated: ${item.name}`);
      }
    });
  }
  console.log("Done!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
