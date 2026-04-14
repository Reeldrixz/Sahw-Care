const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const hash = await bcrypt.hash("password123", 12);

  const donors = await Promise.all([
    prisma.user.upsert({
      where: { email: "amara@carecircle.ng" },
      update: {},
      create: { name: "Amara Okafor", email: "amara@carecircle.ng", password: hash, role: "DONOR", location: "Ikeja, Lagos", trustRating: 4.8, status: "ACTIVE" },
    }),
    prisma.user.upsert({
      where: { email: "fatima@carecircle.ng" },
      update: {},
      create: { name: "Fatima Bello", email: "fatima@carecircle.ng", password: hash, role: "DONOR", location: "Lekki, Lagos", trustRating: 4.6, status: "ACTIVE" },
    }),
    prisma.user.upsert({
      where: { email: "grace@carecircle.ng" },
      update: {},
      create: { name: "Grace Nwosu", email: "grace@carecircle.ng", password: hash, role: "DONOR", location: "Surulere, Lagos", trustRating: 4.9, status: "ACTIVE" },
    }),
    prisma.user.upsert({
      where: { email: "kemi@carecircle.ng" },
      update: {},
      create: { name: "Kemi Adeyemi", email: "kemi@carecircle.ng", password: hash, role: "DONOR", location: "Victoria Island, Lagos", trustRating: 4.4, status: "ACTIVE" },
    }),
    prisma.user.upsert({
      where: { email: "sandra@carecircle.ng" },
      update: {},
      create: { name: "Sandra Eze", email: "sandra@carecircle.ng", password: hash, role: "DONOR", location: "Yaba, Lagos", trustRating: 4.7, status: "ACTIVE" },
    }),
    prisma.user.upsert({
      where: { email: "titi@carecircle.ng" },
      update: {},
      create: { name: "Titi Martins", email: "titi@carecircle.ng", password: hash, role: "DONOR", location: "Gbagada, Lagos", trustRating: 4.3, status: "ACTIVE" },
    }),
  ]);

  const [amara, fatima, grace, kemi, sandra, titi] = donors;
  console.log(`✓ ${donors.length} donor accounts ready`);

  const itemDefs = [
    { title: "Similac Advance Formula", category: "Baby Milk", condition: "New", quantity: "3 cans", location: "Ikeja, Lagos", description: "3 unopened cans of Similac Advance. Baby switched formulas. Expiry June 2026. Absolutely free, just come pick up.", urgent: true, donorId: amara.id },
    { title: "Pampers Newborn Size 1", category: "Diapers", condition: "New", quantity: "2 packs", location: "Lekki, Lagos", description: "2 unopened packs of Pampers. Baby grew too fast. Still sealed with receipt.", urgent: false, donorId: fatima.id },
    { title: "Maternity Pads Bundle", category: "Maternity", condition: "New", quantity: "4 packs", location: "Surulere, Lagos", description: "4 packs of post-delivery maternity pads. Overstocked after C-section. Never opened.", urgent: false, donorId: grace.id },
    { title: "Baby Clothes 0-3 Months", category: "Clothing", condition: "Slightly used", quantity: "12 pieces", location: "Victoria Island, Lagos", description: "12 gently worn outfits (0-3 months). Washed, ironed, and sorted by type. Mix of onesies and sleepsuits.", urgent: false, donorId: kemi.id },
    { title: "Baby Bath Set", category: "Accessories", condition: "Slightly used", quantity: "1 set", location: "Yaba, Lagos", description: "Baby bathtub + wash mitt + Johnson's body wash (half used). Baby outgrew it at 4 months.", urgent: false, donorId: sandra.id },
    { title: "Electric Breast Pump", category: "Maternity", condition: "Slightly used", quantity: "1 unit", location: "Gbagada, Lagos", description: "Medela single electric pump. Used for 3 months only. All parts cleaned, sanitized, and tested.", urgent: false, donorId: titi.id },
  ];

  let created = 0;
  for (const def of itemDefs) {
    const existing = await prisma.item.findFirst({ where: { title: def.title, donorId: def.donorId } });
    if (!existing) {
      await prisma.item.create({ data: { ...def, status: "ACTIVE", images: [] } });
      created++;
    }
  }
  console.log(`✓ ${created} new items created (${itemDefs.length - created} already existed)`);

  // Reviewer account
  const reviewer = await prisma.user.upsert({
    where: { email: "reviewer@carecircle.ng" },
    update: {},
    create: { name: "Demo Reviewer", email: "reviewer@carecircle.ng", password: hash, role: "RECIPIENT", status: "ACTIVE" },
  });

  // Sample reviews
  const reviewDefs = [
    { donor: amara, pickup: 4.9, quality: 4.8, quantity: 4.7, comment: "Amara was so kind and the formula was exactly as described. Pickup was smooth!" },
    { donor: grace, pickup: 5.0, quality: 4.9, quantity: 4.8, comment: "Brand new pads, perfectly packaged. Grace is a gem 💚" },
    { donor: sandra, pickup: 4.6, quality: 4.4, quantity: 4.5, comment: "Bath set was clean and complete. Quick response too." },
  ];

  let reviewsCreated = 0;
  for (const { donor, pickup, quality, quantity, comment } of reviewDefs) {
    const donorItem = await prisma.item.findFirst({ where: { donorId: donor.id } });
    if (!donorItem) continue;

    let request = await prisma.request.findFirst({ where: { requesterId: reviewer.id, itemId: donorItem.id } });
    if (!request) {
      request = await prisma.request.create({ data: { requesterId: reviewer.id, itemId: donorItem.id, status: "FULFILLED" } });
    }

    const existingReview = await prisma.review.findUnique({ where: { requestId: request.id } });
    if (!existingReview) {
      await prisma.review.create({
        data: { requestId: request.id, reviewerId: reviewer.id, donorId: donor.id, pickupRating: pickup, qualityRating: quality, quantityRating: quantity, comment },
      });
      await prisma.user.update({ where: { id: donor.id }, data: { trustRating: (pickup + quality + quantity) / 3 } });
      reviewsCreated++;
    }
  }
  console.log(`✓ ${reviewsCreated} reviews created`);

  // ── Cohort circles ──────────────────────────────────────────────────────────
  console.log("Seeding cohort circles...");

  const COHORT_CIRCLES = [
    {
      stageKey: "pregnancy-0-3",    name: "The Quiet Beginning",   emoji: null, groupLetter: "A",
      channels: [
        { name: "Body Changes",             emoji: "🤱", order: 1 },
        { name: "Food & Diet",              emoji: "🍽️", order: 2 },
        { name: "Emotions & Mental Health", emoji: "🧠", order: 3 },
        { name: "Doctor & Health",          emoji: "🏥", order: 4 },
        { name: "General Chat",             emoji: "💬", order: 5 },
      ],
    },
    {
      stageKey: "pregnancy-4-6",    name: "Growing Into It",       emoji: null, groupLetter: "A",
      channels: [
        { name: "Body Changes",             emoji: "🤱", order: 1 },
        { name: "Food & Diet",              emoji: "🍽️", order: 2 },
        { name: "Emotions & Mental Health", emoji: "🧠", order: 3 },
        { name: "Doctor & Health",          emoji: "🏥", order: 4 },
        { name: "General Chat",             emoji: "💬", order: 5 },
      ],
    },
    {
      stageKey: "pregnancy-7-9",    name: "Almost There",          emoji: null, groupLetter: "A",
      channels: [
        { name: "Body Changes",             emoji: "🤱", order: 1 },
        { name: "Food & Diet",              emoji: "🍽️", order: 2 },
        { name: "Emotions & Mental Health", emoji: "🧠", order: 3 },
        { name: "Doctor & Health",          emoji: "🏥", order: 4 },
        { name: "General Chat",             emoji: "💬", order: 5 },
      ],
    },
    {
      stageKey: "postpartum-0-3",   name: "The Golden Hours",      emoji: null, groupLetter: "A",
      channels: [
        { name: "Recovery & Wellness", emoji: "💪", order: 1 },
        { name: "Feeding",             emoji: "🍼", order: 2 },
        { name: "Sleep",               emoji: "😴", order: 3 },
        { name: "Baby Development",    emoji: "🌱", order: 4 },
        { name: "General Chat",        emoji: "💬", order: 5 },
      ],
    },
    {
      stageKey: "postpartum-4-6",   name: "Finding Your Rhythm",   emoji: null, groupLetter: "A",
      channels: [
        { name: "Recovery & Wellness", emoji: "💪", order: 1 },
        { name: "Feeding",             emoji: "🍼", order: 2 },
        { name: "Sleep",               emoji: "😴", order: 3 },
        { name: "Baby Development",    emoji: "🌱", order: 4 },
        { name: "General Chat",        emoji: "💬", order: 5 },
      ],
    },
    {
      stageKey: "postpartum-7-12",  name: "Into the World",        emoji: null, groupLetter: "A",
      channels: [
        { name: "Recovery & Wellness", emoji: "💪", order: 1 },
        { name: "Feeding",             emoji: "🍼", order: 2 },
        { name: "Sleep",               emoji: "😴", order: 3 },
        { name: "Baby Development",    emoji: "🌱", order: 4 },
        { name: "General Chat",        emoji: "💬", order: 5 },
      ],
    },
    {
      stageKey: "postpartum-13-24", name: "Little Steps",          emoji: null, groupLetter: "A",
      channels: [
        { name: "Recovery & Wellness", emoji: "💪", order: 1 },
        { name: "Feeding",             emoji: "🍼", order: 2 },
        { name: "Sleep",               emoji: "😴", order: 3 },
        { name: "Baby Development",    emoji: "🌱", order: 4 },
        { name: "General Chat",        emoji: "💬", order: 5 },
      ],
    },
  ];

  for (const c of COHORT_CIRCLES) {
    const circle = await prisma.circle.upsert({
      where: { stageKey: c.stageKey },
      create:  { name: c.name, emoji: c.emoji, stageKey: c.stageKey, groupLetter: c.groupLetter },
      update:  { name: c.name, emoji: c.emoji, groupLetter: c.groupLetter },
    });
    for (const ch of c.channels) {
      const exists = await prisma.circleChannel.findFirst({ where: { circleId: circle.id, name: ch.name } });
      if (!exists) {
        await prisma.circleChannel.create({ data: { circleId: circle.id, name: ch.name, emoji: ch.emoji, order: ch.order } });
      }
    }
    console.log(`  ✓ ${c.emoji} ${c.name}`);
  }

  console.log("\n✅ Seed complete! Visit http://localhost:3000");
  console.log("   Test accounts (password: password123):");
  console.log("   Donor:     amara@carecircle.ng");
  console.log("   Recipient: reviewer@carecircle.ng");
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
