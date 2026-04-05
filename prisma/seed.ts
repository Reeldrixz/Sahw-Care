import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create donor users
  const donors = await Promise.all([
    prisma.user.upsert({
      where: { email: "amara@carecircle.ng" },
      update: {},
      create: {
        name: "Amara Okafor",
        email: "amara@carecircle.ng",
        password: await bcrypt.hash("password123", 12),
        role: "DONOR",
        location: "Ikeja, Lagos",
        trustRating: 4.8,
        status: "ACTIVE",
      },
    }),
    prisma.user.upsert({
      where: { email: "fatima@carecircle.ng" },
      update: {},
      create: {
        name: "Fatima Bello",
        email: "fatima@carecircle.ng",
        password: await bcrypt.hash("password123", 12),
        role: "DONOR",
        location: "Lekki, Lagos",
        trustRating: 4.6,
        status: "ACTIVE",
      },
    }),
    prisma.user.upsert({
      where: { email: "grace@carecircle.ng" },
      update: {},
      create: {
        name: "Grace Nwosu",
        email: "grace@carecircle.ng",
        password: await bcrypt.hash("password123", 12),
        role: "DONOR",
        location: "Surulere, Lagos",
        trustRating: 4.9,
        status: "ACTIVE",
      },
    }),
    prisma.user.upsert({
      where: { email: "kemi@carecircle.ng" },
      update: {},
      create: {
        name: "Kemi Adeyemi",
        email: "kemi@carecircle.ng",
        password: await bcrypt.hash("password123", 12),
        role: "DONOR",
        location: "Victoria Island, Lagos",
        trustRating: 4.4,
        status: "ACTIVE",
      },
    }),
    prisma.user.upsert({
      where: { email: "sandra@carecircle.ng" },
      update: {},
      create: {
        name: "Sandra Eze",
        email: "sandra@carecircle.ng",
        password: await bcrypt.hash("password123", 12),
        role: "DONOR",
        location: "Yaba, Lagos",
        trustRating: 4.7,
        status: "ACTIVE",
      },
    }),
    prisma.user.upsert({
      where: { email: "titi@carecircle.ng" },
      update: {},
      create: {
        name: "Titi Martins",
        email: "titi@carecircle.ng",
        password: await bcrypt.hash("password123", 12),
        role: "DONOR",
        location: "Gbagada, Lagos",
        trustRating: 4.3,
        status: "ACTIVE",
      },
    }),
  ]);

  const [amara, fatima, grace, kemi, sandra, titi] = donors;
  console.log(`✓ Created ${donors.length} donor accounts`);

  // Create items
  const items = [
    {
      title: "Similac Advance Formula",
      category: "Baby Milk",
      condition: "New",
      quantity: "3 cans",
      location: "Ikeja, Lagos",
      description:
        "3 unopened cans of Similac Advance. Baby switched formulas. Expiry June 2026. Absolutely free, just come pick up.",
      urgent: true,
      donorId: amara.id,
    },
    {
      title: "Pampers Newborn Size 1",
      category: "Diapers",
      condition: "New",
      quantity: "2 packs",
      location: "Lekki, Lagos",
      description:
        "2 unopened packs of Pampers. Baby grew too fast. Still sealed with receipt.",
      urgent: false,
      donorId: fatima.id,
    },
    {
      title: "Maternity Pads Bundle",
      category: "Maternity",
      condition: "New",
      quantity: "4 packs",
      location: "Surulere, Lagos",
      description:
        "4 packs of post-delivery maternity pads. Overstocked after C-section. Never opened.",
      urgent: false,
      donorId: grace.id,
    },
    {
      title: "Baby Clothes 0–3 Months",
      category: "Clothing",
      condition: "Slightly used",
      quantity: "12 pieces",
      location: "Victoria Island, Lagos",
      description:
        "12 gently worn outfits (0–3 months). Washed, ironed, and sorted by type. Mix of onesies and sleepsuits.",
      urgent: false,
      donorId: kemi.id,
    },
    {
      title: "Baby Bath Set",
      category: "Accessories",
      condition: "Slightly used",
      quantity: "1 set",
      location: "Yaba, Lagos",
      description:
        "Baby bathtub + wash mitt + Johnson's body wash (half used). Baby outgrew it at 4 months.",
      urgent: false,
      donorId: sandra.id,
    },
    {
      title: "Electric Breast Pump",
      category: "Maternity",
      condition: "Slightly used",
      quantity: "1 unit",
      location: "Gbagada, Lagos",
      description:
        "Medela single electric pump. Used for 3 months only. All parts cleaned, sanitized, and tested.",
      urgent: false,
      donorId: titi.id,
    },
  ];

  for (const item of items) {
    const existing = await prisma.item.findFirst({
      where: { title: item.title, donorId: item.donorId },
    });
    if (!existing) {
      await prisma.item.create({ data: { ...item, status: "ACTIVE" } });
    }
  }
  console.log(`✓ Created ${items.length} listings`);

  // Seed a reviewer so reviews appear
  const reviewer = await prisma.user.upsert({
    where: { email: "reviewer@carecircle.ng" },
    update: {},
    create: {
      name: "Demo Reviewer",
      email: "reviewer@carecircle.ng",
      password: await bcrypt.hash("password123", 12),
      role: "RECIPIENT",
      status: "ACTIVE",
    },
  });

  // Add sample reviews for the first few donors
  const reviewTargets = [
    { donor: amara, pickup: 4.9, quality: 4.8, quantity: 4.7, comment: "Amara was so kind and the formula was exactly as described. Pickup was smooth!" },
    { donor: grace, pickup: 5.0, quality: 4.9, quantity: 4.8, comment: "Brand new pads, perfectly packaged. Grace is a gem 💚" },
    { donor: sandra, pickup: 4.6, quality: 4.4, quantity: 4.5, comment: "Bath set was clean and complete. Quick response too." },
  ];

  for (const { donor, pickup, quality, quantity, comment } of reviewTargets) {
    // Need a fulfilled request to attach review to
    let request = await prisma.request.findFirst({
      where: { requesterId: reviewer.id, item: { donorId: donor.id } },
    });

    if (!request) {
      const donorItem = await prisma.item.findFirst({ where: { donorId: donor.id } });
      if (donorItem) {
        request = await prisma.request.create({
          data: {
            requesterId: reviewer.id,
            itemId: donorItem.id,
            status: "FULFILLED",
          },
        });
      }
    }

    if (request) {
      const existingReview = await prisma.review.findUnique({
        where: { requestId: request.id },
      });
      if (!existingReview) {
        await prisma.review.create({
          data: {
            requestId: request.id,
            reviewerId: reviewer.id,
            donorId: donor.id,
            pickupRating: pickup,
            qualityRating: quality,
            quantityRating: quantity,
            comment,
          },
        });
        // Update donor trust rating
        const avg = (pickup + quality + quantity) / 3;
        await prisma.user.update({
          where: { id: donor.id },
          data: { trustRating: avg },
        });
      }
    }
  }
  console.log("✓ Created sample reviews");

  console.log("\n✅ Seed complete!");
  console.log("   Test accounts (all use password: password123):");
  console.log("   Donors: amara@carecircle.ng, fatima@carecircle.ng, grace@carecircle.ng");
  console.log("   Recipient: reviewer@carecircle.ng");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
