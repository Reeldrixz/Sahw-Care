import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const BUNDLES = [
  {
    code: "B01",
    name: "Prenatal Essentials",
    stage: "PREGNANCY" as const,
    description: "Everything a first-time mother needs during her pregnancy journey — vitamins, comfort aids, and reading material to prepare.",
    contentsMarkdown: `- Prenatal multivitamin (90-day supply)\n- Pregnancy pillow\n- Stretch-mark cream (2×)\n- Belly band / maternity support belt\n- Pregnancy journal\n- *What to Expect When You're Expecting* book`,
    estimatedValue: 18000,
  },
  {
    code: "B02",
    name: "Maternity Comfort Kit",
    stage: "PREGNANCY" as const,
    description: "Targeted relief for the physical demands of pregnancy — swollen feet, back pain, and restless nights.",
    contentsMarkdown: `- Compression socks (2 pairs)\n- Heating pad (back & belly safe)\n- Body pillow case (waterproof)\n- Cooling towel\n- Prenatal yoga DVD / resistance band set\n- Lavender bath salts`,
    estimatedValue: 14000,
  },
  {
    code: "B03",
    name: "Nutrition & Wellness Bundle",
    stage: "PREGNANCY" as const,
    description: "Nutritional support for mother and growing baby, including supplements and healthy snack options.",
    contentsMarkdown: `- DHA / Omega-3 supplement\n- Iron supplement\n- Protein powder (pregnancy-safe)\n- Assorted healthy snack bars (24-pack)\n- Hydration electrolyte sachets (30-pack)\n- Insulated water bottle`,
    estimatedValue: 12000,
  },
  {
    code: "B04",
    name: "Labour Prep Bundle",
    stage: "LABOUR" as const,
    description: "Practical items to help mothers feel prepared and comfortable during labour and delivery.",
    contentsMarkdown: `- Hospital bag checklist & organiser\n- Nursing-friendly robe\n- Non-slip socks (2 pairs)\n- Lip balm & toiletry kit\n- Snack bag for labour (granola bars, nuts, electrolytes)\n- Small speaker / white noise machine`,
    estimatedValue: 10000,
  },
  {
    code: "B05",
    name: "Birth Partner Support Kit",
    stage: "LABOUR" as const,
    description: "Tools and comforts to help a birth partner provide meaningful support during labour.",
    contentsMarkdown: `- Birth partner guide book\n- Massage roller & hand lotion\n- Comfort focal-point card set\n- Snacks for the support person\n- Portable phone charger`,
    estimatedValue: 8000,
  },
  {
    code: "B06",
    name: "Newborn Starter Bundle",
    stage: "NEWBORN" as const,
    description: "The absolute essentials a newborn needs in the first weeks of life.",
    contentsMarkdown: `- Newborn onesies (6-pack, gender-neutral)\n- Swaddle blankets (3-pack)\n- Baby beanie & mittens set\n- Newborn nappies (pack of 48)\n- Fragrance-free baby wipes (pack of 64)\n- Baby nail file set`,
    estimatedValue: 15000,
  },
  {
    code: "B07",
    name: "Sleep & Soothe Bundle",
    stage: "NEWBORN" as const,
    description: "Help baby and mother get the rest they need with sleep aids and soothing essentials.",
    contentsMarkdown: `- White noise machine\n- Baby sleep sack (0–3 months)\n- Swaddle wraps (2-pack)\n- Pacifiers (orthodontic, 2-pack)\n- Gripe water\n- Lavender-infused baby lotion`,
    estimatedValue: 13000,
  },
  {
    code: "B08",
    name: "Feeding Support Bundle",
    stage: "NEWBORN" as const,
    description: "Support for breastfeeding and bottle-feeding through the early weeks.",
    contentsMarkdown: `- Manual breast pump\n- Breast pads (reusable, 8-pack)\n- Nipple cream\n- Bottle set (3 bottles with slow-flow nipples)\n- Bottle brush & drying rack\n- Nursing cover`,
    estimatedValue: 20000,
  },
  {
    code: "B09",
    name: "Postpartum Recovery Bundle",
    stage: "POSTPARTUM" as const,
    description: "Essential recovery items to help mothers heal physically after childbirth.",
    contentsMarkdown: `- Postpartum mesh underwear (10-pack)\n- Perineal spray\n- Sitz bath kit\n- Stool softener (gentle, 30-day)\n- Postpartum belly wrap / binder\n- Nipple shields`,
    estimatedValue: 16000,
  },
  {
    code: "B10",
    name: "Mental Wellness Bundle",
    stage: "POSTPARTUM" as const,
    description: "Resources and self-care items to support maternal mental health in the fourth trimester.",
    contentsMarkdown: `- Postpartum wellness journal\n- Mindfulness meditation app gift card (3 months)\n- Herbal stress-relief tea (30 bags)\n- Self-care planner\n- *The Fourth Trimester* book\n- Affirmation card deck`,
    estimatedValue: 11000,
  },
  {
    code: "B11",
    name: "Postpartum Nutrition Bundle",
    stage: "POSTPARTUM" as const,
    description: "Nutritional support for recovery and breastfeeding in the months after birth.",
    contentsMarkdown: `- Postnatal multivitamin (60-day supply)\n- Omega-3 supplement\n- Lactation tea (30 bags)\n- Lactation cookies (2 boxes)\n- Protein meal-replacement shakes (1-week supply)\n- Reusable snack bags`,
    estimatedValue: 13500,
  },
  {
    code: "B12",
    name: "Baby Development Bundle",
    stage: "POSTPARTUM" as const,
    description: "Stimulating and developmental toys for babies aged 0–6 months.",
    contentsMarkdown: `- High-contrast black & white sensory cards\n- Soft sensory play mat\n- Rattles & teething rings set\n- Baby mirror toy\n- Board books (set of 4, 0–6 months)\n- Baby gym / activity arch`,
    estimatedValue: 17000,
  },
];

export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const results = [];
  for (const b of BUNDLES) {
    const bundle = await prisma.bundle.upsert({
      where: { code: b.code },
      update: {
        name: b.name,
        stage: b.stage,
        description: b.description,
        contentsMarkdown: b.contentsMarkdown,
        estimatedValue: b.estimatedValue,
      },
      create: {
        code: b.code,
        name: b.name,
        stage: b.stage,
        description: b.description,
        contentsMarkdown: b.contentsMarkdown,
        estimatedValue: b.estimatedValue,
        slotsPerMonth: 10,
        isActive: true,
      },
    });
    results.push({ code: bundle.code, name: bundle.name });
  }

  return NextResponse.json({ seeded: results.length, bundles: results });
}
