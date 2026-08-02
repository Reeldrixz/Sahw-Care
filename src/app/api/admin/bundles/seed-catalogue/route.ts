import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 9 live bundles: B01, B02, B03, B04, B06, B07, B08, B09, B12.
// Retired (active:false, hidden from mothers, records kept): B05, B10, B11.
// Item counts (live): B01=7, B02=6, B03=6, B04=7, B06=10, B07=7, B08=8, B09=6, B12=7.
// Internal price bands (never shown to mothers): $100 Essentials, $175 Core, $250 Complete.
// NOTE: B08's stored band may not match its real ~$200 cost after the pump was
// cut; price-band redraw is a separate deliberate pass (intentionally not done here).
const BUNDLES = [
  {
    code: "B01",
    name: "First Trimester Essentials",
    stage: "PREGNANCY" as const,
    description: "Everything a first-time mother needs during her pregnancy journey: vitamins, comfort aids, and reading material to prepare.",
    contentsMarkdown: [
      "- Pregnancy pillow",
      "- Prenatal multivitamin (90-day supply)",
      "- Stretch-mark cream (2×)",
      "- Belly band / maternity support belt",
      "- *What to Expect When You're Expecting* book",
      "- Compression socks (1 pair)",
      "- Pregnancy-safe lip balm",
    ].join("\n"),
    estimatedValue: 18000,
    priceBand: "CORE_175" as const,
    targetPriceCad: 175,
  },
  {
    code: "B02",
    name: "Second Trimester Comfort Kit",
    stage: "PREGNANCY" as const,
    description: "Targeted relief for the physical demands of pregnancy: swollen feet, back pain, and restless nights.",
    contentsMarkdown: [
      "- Heating pad (back & belly safe)",
      "- Lumbar support wedge cushion",
      "- Compression socks (2 pairs)",
      "- Body pillow case (waterproof)",
      "- Cooling towel",
      "- Lavender bath salts",
    ].join("\n"),
    estimatedValue: 14000,
    priceBand: "CORE_175" as const,
    targetPriceCad: 175,
  },
  {
    code: "B03",
    name: "Third Trimester Preparation Kit",
    stage: "PREGNANCY" as const,
    description: "Practical comfort and hydration support for the final stretch before birth.",
    contentsMarkdown: [
      "- Insulated water bottle",
      "- Hydration electrolyte sachets (30-pack)",
      "- Ginger chews for morning sickness (50-pack)",
      "- Assorted healthy snack bars (24-pack)",
      "- Nipple cream",
      "- Nursing bra (1)",
    ].join("\n"),
    estimatedValue: 12000,
    priceBand: "CORE_175" as const,
    targetPriceCad: 175,
  },
  {
    code: "B04",
    name: "Hospital Bag for Mother",
    stage: "LABOUR" as const,
    description: "Practical items to help mothers feel prepared and comfortable during labour and delivery.",
    contentsMarkdown: [
      "- Toiletry kit",
      "- Nursing-friendly robe",
      "- Hospital bag organiser",
      "- Non-slip socks (2 pairs)",
      "- Lip balm",
      "- Snack bag for labour (granola bars, nuts, electrolytes)",
      "- Perineal cooling pads (20-pack)",
    ].join("\n"),
    estimatedValue: 10000,
    priceBand: "CORE_175" as const,
    targetPriceCad: 175,
  },
  {
    code: "B05",
    active: false, // Retired: off-mission (serves partner, not mother). Hidden from mothers; record kept.
    name: "Birth Partner Support Kit",
    stage: "LABOUR" as const,
    description: "Tools and comforts to help a birth partner provide meaningful support during labour.",
    contentsMarkdown: [
      "- Birth partner guide book",
      "- Massage roller & hand lotion",
      "- Comfort focal-point card set",
      "- Snacks for the support person",
      "- Cooling spray bottle",
      "- Hand-held mini fan",
      "- Encouraging messages card set",
    ].join("\n"),
    estimatedValue: 8000,
    priceBand: "ESSENTIALS_100" as const,
    targetPriceCad: 100,
  },
  {
    code: "B06",
    name: "Complete Newborn Bundle",
    stage: "NEWBORN" as const,
    description: "The absolute essentials a newborn needs in the first weeks of life.",
    contentsMarkdown: [
      "- Digital baby thermometer",
      "- Newborn onesies (6-pack, gender-neutral)",
      "- Swaddle blankets (3-pack)",
      "- Baby beanie & mittens set",
      "- Newborn nappies (84ct) ×2",
      "- Fragrance-free baby wipes (pack of 64)",
      "- Baby nail clippers",
      "- Muslin burp cloths (4-pack)",
      "- Fragrance-free baby bath & lotion set",
      "- Baby hair brush & comb set",
    ].join("\n"),
    estimatedValue: 15000,
    priceBand: "CORE_175" as const,
    targetPriceCad: 175,
  },
  {
    code: "B07",
    name: "Newborn Sleep & Soothing Kit",
    stage: "NEWBORN" as const,
    description: "Help baby and mother get the rest they need with sleep aids and soothing essentials.",
    contentsMarkdown: [
      "- White noise machine",
      "- Nightlight with timer",
      "- Baby sleep sack (0-3 months)",
      "- Swaddle wraps (2-pack)",
      "- Pacifiers (orthodontic, 2-pack)",
      "- Fragrance-free baby lotion",
      "- Blackout window clings (2-pack)",
    ].join("\n"),
    estimatedValue: 13000,
    priceBand: "CORE_175" as const,
    targetPriceCad: 175,
  },
  {
    code: "B08",
    name: "Feeding Kit",
    stage: "NEWBORN" as const,
    description: "Support for breastfeeding and bottle-feeding through the early weeks.",
    contentsMarkdown: [
      "- Baby feeding pillow",
      "- Breast pads (reusable, 8-pack)",
      "- Nipple cream",
      "- Bottle set (3 bottles with slow-flow nipples)",
      "- Bottle brush & drying rack",
      "- Nursing cover",
      "- Milk storage bags (50-pack)",
      "- Nursing bra (1)",
    ].join("\n"),
    estimatedValue: 20000,
    priceBand: "COMPLETE_250" as const,
    targetPriceCad: 250,
  },
  {
    code: "B09",
    name: "Postpartum Recovery Kit",
    stage: "POSTPARTUM" as const,
    description: "Essential recovery items to help mothers heal physically after childbirth.",
    contentsMarkdown: [
      "- Sitz bath kit",
      "- Postpartum mesh underwear (10-pack)",
      "- Perineal spray",
      "- Nipple shields",
      "- Peri bottle (postpartum hygiene)",
      "- Witch hazel pads (40-pack)",
    ].join("\n"),
    estimatedValue: 16000,
    priceBand: "ESSENTIALS_100" as const,
    targetPriceCad: 100,
  },
  {
    code: "B10",
    active: false, // Retired: informational/digital filler, not material support. Hidden from mothers; record kept.
    name: "Fourth Trimester Wellness Kit",
    stage: "POSTPARTUM" as const,
    description: "Resources and self-care items to support maternal mental health in the fourth trimester.",
    contentsMarkdown: [
      "- Postpartum wellness journal",
      "- Mindfulness meditation app gift card (3 months)",
      "- Herbal stress-relief tea (30 bags)",
      "- Self-care planner",
      "- *The Fourth Trimester* book",
      "- Affirmation card deck",
      "- Relaxing bath soak set",
      "- Calming soy candle",
    ].join("\n"),
    estimatedValue: 11000,
    priceBand: "CORE_175" as const,
    targetPriceCad: 175,
  },
  {
    code: "B11",
    active: false, // Retired: supplement-based, violates no-supplement rule. Hidden from mothers; record kept.
    name: "Maternal Nutrition & Recovery Bundle",
    stage: "POSTPARTUM" as const,
    description: "Nutritional support for recovery and breastfeeding in the months after birth.",
    contentsMarkdown: [
      "- Postnatal multivitamin (90-day supply)",
      "- Omega-3 supplement",
      "- Lactation tea (30 bags)",
      "- Lactation cookies (2 boxes)",
      "- Protein meal-replacement shakes (1-week supply)",
      "- Lactation protein powder (large tub, 30 servings)",
      "- Reusable snack bags",
      "- Iron supplement (postpartum)",
      "- Collagen peptides powder (30 servings)",
      "- Bone broth sachets (10-pack)",
      "- Nut & seed trail mix (500g)",
      "- Electrolyte drink mix (30-pack)",
      "- Postpartum belly wrap / binder",
      "- Postpartum meal prep guide",
    ].join("\n"),
    estimatedValue: 23000,
    priceBand: "COMPLETE_250" as const,
    targetPriceCad: 250,
  },
  {
    code: "B12",
    name: "Baby Development & Play Kit",
    stage: "NEWBORN" as const,
    description: "Stimulating and developmental toys for babies aged 0-6 months.",
    contentsMarkdown: [
      "- Baby play gym with activity arch & play mat",
      "- High-contrast black & white sensory cards",
      "- Rattles & teething rings set",
      "- Baby mirror toy",
      "- Board books (set of 4, 0-6 months)",
      "- Soft stacking rings",
      "- Tummy time support pillow",
    ].join("\n"),
    estimatedValue: 17000,
    priceBand: "COMPLETE_250" as const,
    targetPriceCad: 250,
  },
];

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const results = [];
  for (const b of BUNDLES) {
    const itemCount = b.contentsMarkdown.split("\n").filter((l) => l.startsWith("- ")).length;
    const bundle = await prisma.bundle.upsert({
      where: { code: b.code },
      update: {
        name: b.name,
        stage: b.stage,
        description: b.description,
        contentsMarkdown: b.contentsMarkdown,
        estimatedValue: b.estimatedValue,
        priceBand: b.priceBand,
        targetPriceCad: b.targetPriceCad,
        // Seed is authoritative for active state: a re-seed enforces the flag
        // above (retired bundles stay hidden). Manual admin pause/unpause is
        // overridden on re-seed by design.
        isActive: b.active ?? true,
      },
      create: {
        code: b.code,
        name: b.name,
        stage: b.stage,
        description: b.description,
        contentsMarkdown: b.contentsMarkdown,
        estimatedValue: b.estimatedValue,
        priceBand: b.priceBand,
        targetPriceCad: b.targetPriceCad,
        slotsPerMonth: 10,
        isActive: b.active ?? true,
      },
    });
    results.push({ code: bundle.code, name: bundle.name, itemCount });
  }

  return NextResponse.json({ seeded: results.length, bundles: results });
}
