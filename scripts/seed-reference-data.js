// Reference-data seed: cohort circles + item catalogue ONLY.
//
// Extracted verbatim from prisma/seed.js (COHORT_CIRCLES, lines 116-187) and
// prisma/seed.ts (skus, lines 346-404) by slicing those exact line ranges, so
// the data is byte-identical to the originals.
//
// DELIBERATELY OMITTED: every prisma.user.* call, and the demo requests,
// reviews, items and missions that hang off those users. This database takes
// real payments; it gets no seeded accounts. Real accounts are created by
// signing up through the app.
//
// Both writes are upserts keyed on a unique column (Circle.stageKey,
// ItemCatalog.sku), so re-running this is safe and idempotent.

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const now = new Date();

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

  const skus = [
    // ── FEEDING ──────────────────────────────────────────────────────────
    { sku: "F01", name: "Standard Infant Formula, Powder", category: "Feeding", standardPriceCents: 4300, priceCentsMin: 3800, priceCentsMax: 4800, description: "Enfamil A+ or Similac Advance. 650g tin. For healthy babies 0-12 months.", preferredVendor: "Walmart.ca", ageStage: "0-12 months", requiresSize: false, substituteNote: "Substitute: Nestle Good Start. Verify stock before ordering." },
    { sku: "F02", name: "Standard Infant Formula, Ready to Feed", category: "Feeding", standardPriceCents: 1500, priceCentsMin: 1200, priceCentsMax: 1800, description: "Enfamil A+ or Similac Advance. 946ml ready-to-use liquid. For hospital or newborn stage.", preferredVendor: "Walmart.ca", ageStage: "0-3 months", requiresSize: false, substituteNote: null },
    { sku: "F03", name: "Baby Bottles, Newborn Flow (2-pack)", category: "Feeding", standardPriceCents: 2200, priceCentsMin: 1800, priceCentsMax: 2600, description: "Philips Avent Natural or Dr. Brown's Original. BPA-free. Slow flow nipple for newborns.", preferredVendor: "Amazon.ca", ageStage: "0-3 months", requiresSize: false, substituteNote: null },
    { sku: "F04", name: "Baby Bottles, Medium Flow (2-pack)", category: "Feeding", standardPriceCents: 2200, priceCentsMin: 1800, priceCentsMax: 2600, description: "Philips Avent or MAM Anti-Colic. BPA-free. Medium flow nipple for 3+ months.", preferredVendor: "Amazon.ca", ageStage: "3-12 months", requiresSize: false, substituteNote: "Substitute: Tommee Tippee Closer to Nature." },
    { sku: "F05", name: "Bottle Brush & Drying Rack Set", category: "Feeding", standardPriceCents: 2300, priceCentsMin: 1800, priceCentsMax: 2800, description: "OXO Tot or Dr. Brown's. Includes bottle brush, nipple brush, and rack.", preferredVendor: "Amazon.ca", ageStage: "0-12 months", requiresSize: false, substituteNote: null },
    { sku: "F06", name: "Disposable Nursing Pads (60-count)", category: "Feeding", standardPriceCents: 1450, priceCentsMin: 1200, priceCentsMax: 1700, description: "Lansinoh Stay Dry or Medela. Individually wrapped, super absorbent, leak-proof.", preferredVendor: "Shoppers Drug Mart", ageStage: "0-6 months", requiresSize: false, substituteNote: null },
    { sku: "F07", name: "Nipple Cream, Lanolin (40g)", category: "Feeding", standardPriceCents: 1650, priceCentsMin: 1300, priceCentsMax: 2000, description: "Lansinoh HPA Lanolin or Medela Purelan. Safe for baby, no need to wipe off.", preferredVendor: "Shoppers Drug Mart", ageStage: "0-6 months", requiresSize: false, substituteNote: "Substitute: Earth Mama Nipple Butter." },
    { sku: "F08", name: "Manual Breast Pump", category: "Feeding", standardPriceCents: 4500, priceCentsMin: 3500, priceCentsMax: 5500, description: "Medela Harmony or Haakaa Silicone. Single-sided. For occasional pumping.", preferredVendor: "Shoppers Drug Mart", ageStage: "0-12 months", requiresSize: false, substituteNote: "NEW ONLY. Substitute: Lansinoh manual pump." },
    { sku: "F09", name: "Breast Milk Storage Bags (50-count)", category: "Feeding", standardPriceCents: 1900, priceCentsMin: 1600, priceCentsMax: 2200, description: "Lansinoh or Medela. Pre-sterilised, double-sealed, freezer safe.", preferredVendor: "Shoppers Drug Mart", ageStage: "0-12 months", requiresSize: false, substituteNote: null },
    { sku: "F10", name: "Pacifier / Soother (2-pack)", category: "Feeding", standardPriceCents: 1300, priceCentsMin: 1000, priceCentsMax: 1600, description: "MAM Air or Philips Avent Soothie. BPA-free silicone. Newborn size.", preferredVendor: "Walmart.ca", ageStage: "0-6 months", requiresSize: false, substituteNote: null },
    // ── DIAPERING ────────────────────────────────────────────────────────
    { sku: "D01", name: "Diapers, Newborn (Size NB, 40-count)", category: "Diapering", standardPriceCents: 2600, priceCentsMin: 2200, priceCentsMax: 3000, description: "Pampers Swaddlers or Huggies Little Snugglers. Up to 10 lbs. Ultra-soft.", preferredVendor: "Walmart.ca", ageStage: "0-1 month", requiresSize: false, substituteNote: "Substitute: Luvs or Kirkland NB." },
    { sku: "D02", name: "Diapers, Size 1 (pack of 40-50)", category: "Diapering", standardPriceCents: 2900, priceCentsMin: 2400, priceCentsMax: 3400, description: "Pampers Swaddlers or Huggies Little Snugglers. 8-14 lbs.", preferredVendor: "Walmart.ca", ageStage: "1-3 months", requiresSize: false, substituteNote: "Substitute: Pampers Baby Dry Size 1." },
    { sku: "D03", name: "Diapers, Size 2 (pack of 40-50)", category: "Diapering", standardPriceCents: 3100, priceCentsMin: 2600, priceCentsMax: 3600, description: "Pampers or Huggies Snug & Dry. 12-18 lbs.", preferredVendor: "Walmart.ca", ageStage: "3-6 months", requiresSize: false, substituteNote: "Substitute: Pampers Baby Dry or Huggies Little Movers." },
    { sku: "D04", name: "Diapers, Size 3 (pack of 40)", category: "Diapering", standardPriceCents: 3300, priceCentsMin: 2800, priceCentsMax: 3800, description: "Pampers Cruisers or Huggies Little Movers. 16-28 lbs.", preferredVendor: "Walmart.ca", ageStage: "6-12 months", requiresSize: false, substituteNote: "Substitute: Pampers Baby Dry." },
    { sku: "D05", name: "Diapers, Size 4 (pack of 40)", category: "Diapering", standardPriceCents: 3500, priceCentsMin: 3000, priceCentsMax: 4000, description: "Pampers Cruisers or Huggies Little Movers. 22-37 lbs.", preferredVendor: "Walmart.ca", ageStage: "12-24 months", requiresSize: false, substituteNote: null },
    { sku: "D06", name: "Baby Wipes, Fragrance Free (2-pack)", category: "Diapering", standardPriceCents: 1700, priceCentsMin: 1400, priceCentsMax: 2000, description: "Pampers Sensitive or Huggies Natural Care. 80 count per pack, flip-top lid.", preferredVendor: "Walmart.ca", ageStage: "All stages", requiresSize: false, substituteNote: "Substitute: WaterWipes or Kirkland wipes." },
    { sku: "D07", name: "Baby Wipes, Large Pack (3-pack)", category: "Diapering", standardPriceCents: 2200, priceCentsMin: 1800, priceCentsMax: 2600, description: "Pampers Sensitive or Huggies Natural Care. 3 x 80 count refill packs.", preferredVendor: "Walmart.ca", ageStage: "All stages", requiresSize: false, substituteNote: null },
    { sku: "D08", name: "Diaper Rash Cream, Standard (113g)", category: "Diapering", standardPriceCents: 1150, priceCentsMin: 900, priceCentsMax: 1400, description: "Desitin Maximum Strength or Penaten Cream. Zinc oxide formula.", preferredVendor: "Walmart.ca", ageStage: "All stages", requiresSize: false, substituteNote: "Substitute: Aveeno Baby Soothing Relief Cream." },
    { sku: "D09", name: "Diaper Rash Cream, Sensitive (85g)", category: "Diapering", standardPriceCents: 1300, priceCentsMin: 1000, priceCentsMax: 1600, description: "Cetaphil Baby or Aveeno Baby. Fragrance-free, for sensitive skin.", preferredVendor: "Shoppers Drug Mart", ageStage: "All stages", requiresSize: false, substituteNote: null },
    { sku: "D10", name: "Changing Mat / Waterproof Pad (2-pack)", category: "Diapering", standardPriceCents: 2300, priceCentsMin: 1800, priceCentsMax: 2800, description: "Kushies or Summer Infant. Waterproof, washable, portable.", preferredVendor: "Amazon.ca", ageStage: "All stages", requiresSize: false, substituteNote: null },
    // ── CLOTHING ─────────────────────────────────────────────────────────
    { sku: "C01", name: "Onesies / Bodysuits (5-pack)", category: "Clothing", standardPriceCents: 2200, priceCentsMin: 1800, priceCentsMax: 2600, description: "Carter's or Simple Joys by Carter's. Short-sleeve, snap closure, cotton. Gender-neutral colours.", preferredVendor: "Amazon.ca", ageStage: "NB to 24m", requiresSize: true, substituteNote: "Substitute: George brand (Walmart)." },
    { sku: "C02", name: "Sleepsuits / Footie Pajamas (3-pack)", category: "Clothing", standardPriceCents: 2500, priceCentsMin: 2000, priceCentsMax: 3000, description: "Carter's or George. Full-length footed sleeper, snap or zip closure.", preferredVendor: "Amazon.ca", ageStage: "NB to 18m", requiresSize: true, substituteNote: null },
    { sku: "C03", name: "Long-Sleeve Onesies (3-pack)", category: "Clothing", standardPriceCents: 2000, priceCentsMin: 1600, priceCentsMax: 2400, description: "Carter's or Simple Joys. Cotton, long sleeve, snap closure.", preferredVendor: "Amazon.ca", ageStage: "NB to 18m", requiresSize: true, substituteNote: null },
    { sku: "C04", name: "Baby Swaddle Blankets (3-pack)", category: "Clothing", standardPriceCents: 2850, priceCentsMin: 2200, priceCentsMax: 3500, description: "Aden + Anais or Carter's. 100% cotton muslin. Multi-use: swaddle, nursing cover, burp cloth.", preferredVendor: "Amazon.ca", ageStage: "0-6 months", requiresSize: false, substituteNote: "Substitute: Hudson Baby muslin." },
    { sku: "C05", name: "Warm Sleepsuits / Winter Footed Pajamas (2-pack)", category: "Clothing", standardPriceCents: 2700, priceCentsMin: 2200, priceCentsMax: 3200, description: "Carter's fleece or George fleece footed sleeper. Warm lining.", preferredVendor: "Amazon.ca", ageStage: "NB to 18m", requiresSize: true, substituteNote: null },
    { sku: "C06", name: "Baby Socks (8-pack)", category: "Clothing", standardPriceCents: 1500, priceCentsMin: 1200, priceCentsMax: 1800, description: "Carter's or Robeez. Non-slip grip, stay-on design.", preferredVendor: "Amazon.ca", ageStage: "0-24m", requiresSize: true, substituteNote: null },
    { sku: "C07", name: "Baby Hat (2-pack, cotton)", category: "Clothing", standardPriceCents: 1100, priceCentsMin: 800, priceCentsMax: 1400, description: "Carter's or George. Soft cotton knit, no embellishments.", preferredVendor: "Amazon.ca", ageStage: "NB to 12m", requiresSize: true, substituteNote: null },
    { sku: "C08", name: "Baby Mittens (2-pack)", category: "Clothing", standardPriceCents: 950, priceCentsMin: 700, priceCentsMax: 1200, description: "Carter's or Gerber. Soft cotton, elastic cuff to keep on.", preferredVendor: "Amazon.ca", ageStage: "0-3 months", requiresSize: false, substituteNote: null },
    { sku: "C09", name: "Snowsuit / Winter Bunting (0-12m)", category: "Clothing", standardPriceCents: 4000, priceCentsMin: 3000, priceCentsMax: 5000, description: "Carter's or Columbia infant bunting. Full zip, warm lining.", preferredVendor: "Amazon.ca", ageStage: "0-12m", requiresSize: true, substituteNote: null },
    { sku: "C10", name: "Baby Bath Towels with Hood (2-pack)", category: "Clothing", standardPriceCents: 2600, priceCentsMin: 2000, priceCentsMax: 3200, description: "Burt's Bees Baby or Carter's. Extra soft, hooded, 100% cotton.", preferredVendor: "Amazon.ca", ageStage: "0-24m", requiresSize: false, substituteNote: null },
    // ── MATERNITY & POSTPARTUM ────────────────────────────────────────────
    { sku: "M01", name: "Maternity / Postpartum Pads, Heavy (2-pack)", category: "Maternity & Postpartum", standardPriceCents: 2200, priceCentsMin: 1800, priceCentsMax: 2600, description: "Always Discreet Maximum or Stayfree Maxi Overnight. Extra-long, heavy absorbency.", preferredVendor: "Shoppers Drug Mart", ageStage: "Labour + 0-2 weeks postpartum", requiresSize: false, substituteNote: null },
    { sku: "M02", name: "Postpartum Disposable Underwear (8-pack)", category: "Maternity & Postpartum", standardPriceCents: 2200, priceCentsMin: 1800, priceCentsMax: 2600, description: "Frida Mom Disposable Postpartum Underwear or Always Discreet. High-waist, full coverage.", preferredVendor: "Shoppers Drug Mart", ageStage: "0-2 weeks postpartum", requiresSize: false, substituteNote: null },
    { sku: "M03", name: "Peri Bottle, Perineal Rinse", category: "Maternity & Postpartum", standardPriceCents: 1500, priceCentsMin: 1200, priceCentsMax: 1800, description: "Frida Mom Upside Down Peri Bottle or Medela. Angled for easy use post-birth.", preferredVendor: "Shoppers Drug Mart", ageStage: "0-6 weeks postpartum", requiresSize: false, substituteNote: null },
    { sku: "M04", name: "Sitz Bath Soak (Epsom Salt + Herbs)", category: "Maternity & Postpartum", standardPriceCents: 1900, priceCentsMin: 1600, priceCentsMax: 2200, description: "Frida Mom Sitz Bath Soak or Earth Mama Organic. For perineal healing.", preferredVendor: "Shoppers Drug Mart", ageStage: "0-6 weeks postpartum", requiresSize: false, substituteNote: null },
    { sku: "M05", name: "Perineal Cold Packs (8-count)", category: "Maternity & Postpartum", standardPriceCents: 2200, priceCentsMin: 1800, priceCentsMax: 2600, description: "Frida Mom Instant Ice Maxi Pads or Medela. Ready-to-use cold therapy.", preferredVendor: "Shoppers Drug Mart", ageStage: "0-2 weeks postpartum", requiresSize: false, substituteNote: null },
    { sku: "M06", name: "Nursing Bra, Wireless (1 unit)", category: "Maternity & Postpartum", standardPriceCents: 4000, priceCentsMin: 3000, priceCentsMax: 5000, description: "Medela Comfy Bra or Kindred Bravely Simply Sublime. Seamless, no wire.", preferredVendor: "Amazon.ca", ageStage: "Pregnancy + postpartum", requiresSize: true, substituteNote: "Substitute: Bravado Designs Body Silk." },
    { sku: "M07", name: "Postpartum Belly Band / Wrap", category: "Maternity & Postpartum", standardPriceCents: 5500, priceCentsMin: 4500, priceCentsMax: 6500, description: "Belly Bandit or Frida Mom Shrinkx Belly. Supports core and reduces swelling post-birth.", preferredVendor: "Amazon.ca", ageStage: "0-6 weeks postpartum", requiresSize: true, substituteNote: null },
    { sku: "M08", name: "Prenatal / Postnatal Vitamins (30-day supply)", category: "Maternity & Postpartum", standardPriceCents: 2400, priceCentsMin: 1800, priceCentsMax: 3000, description: "Materna, Jamieson Prenatal, or New Chapter Perfect Prenatal. Canadian brand.", preferredVendor: "Shoppers Drug Mart", ageStage: "Pregnancy + postpartum", requiresSize: false, substituteNote: "Substitute: Kirkland Prenatal (Costco)." },
    { sku: "M09", name: "Pregnancy Pillow, C or U Shape", category: "Maternity & Postpartum", standardPriceCents: 7000, priceCentsMin: 5500, priceCentsMax: 8500, description: "Pharmedoc or Leachco Snoogle. Full body support for pregnancy sleep.", preferredVendor: "Amazon.ca", ageStage: "Pregnancy", requiresSize: false, substituteNote: null },
    { sku: "M10", name: "Haemorrhoid Relief Cream / Spray", category: "Maternity & Postpartum", standardPriceCents: 1300, priceCentsMin: 1000, priceCentsMax: 1600, description: "Preparation H or Frida Mom. Fragrance-free, postpartum safe.", preferredVendor: "Shoppers Drug Mart", ageStage: "0-6 weeks postpartum", requiresSize: false, substituteNote: null },
    { sku: "M11", name: "Compression Socks (2-pack)", category: "Maternity & Postpartum", standardPriceCents: 2300, priceCentsMin: 1800, priceCentsMax: 2800, description: "Physix Gear or SB SOX. Graduated compression, 15-20mmHg. For pregnancy swelling.", preferredVendor: "Amazon.ca", ageStage: "Pregnancy", requiresSize: true, substituteNote: "Substitute: Truform compression socks." },
    { sku: "M12", name: "Nipple Shields (2-pack)", category: "Maternity & Postpartum", standardPriceCents: 2000, priceCentsMin: 1600, priceCentsMax: 2400, description: "Medela Contact Nipple Shields. Medical-grade silicone. For latch difficulties.", preferredVendor: "Shoppers Drug Mart", ageStage: "0-6 months", requiresSize: true, substituteNote: null },
    // ── HYGIENE & BATH ────────────────────────────────────────────────────
    { sku: "H01", name: "Baby Wash & Shampoo 2-in-1 (400ml)", category: "Hygiene & Bath", standardPriceCents: 1200, priceCentsMin: 900, priceCentsMax: 1500, description: "Johnson's Baby Head-to-Toe or Aveeno Baby Wash & Shampoo. Tear-free, hypoallergenic.", preferredVendor: "Walmart.ca", ageStage: "All stages", requiresSize: false, substituteNote: "Substitute: Burt's Bees Baby Shampoo & Wash." },
    { sku: "H02", name: "Baby Lotion / Moisturiser (400ml)", category: "Hygiene & Bath", standardPriceCents: 1400, priceCentsMin: 1000, priceCentsMax: 1800, description: "Aveeno Baby Daily Moisture or Cetaphil Baby. Fragrance-free, fast-absorbing.", preferredVendor: "Shoppers Drug Mart", ageStage: "All stages", requiresSize: false, substituteNote: "Substitute: Lubriderm Baby or Vaseline Baby." },
    { sku: "H03", name: "Baby Bath Set: Tub, Thermometer & Brush", category: "Hygiene & Bath", standardPriceCents: 3650, priceCentsMin: 2800, priceCentsMax: 4500, description: "Summer Infant or Munchkin. Includes infant tub with newborn insert and bath thermometer.", preferredVendor: "Amazon.ca", ageStage: "0-24m", requiresSize: false, substituteNote: null },
    { sku: "H04", name: "Nasal Aspirator (Bulb + Electric)", category: "Hygiene & Bath", standardPriceCents: 2300, priceCentsMin: 1800, priceCentsMax: 2800, description: "Frida Baby NoseFrida or Safety 1st. Includes bulb syringe and nasal saline.", preferredVendor: "Shoppers Drug Mart", ageStage: "0-12 months", requiresSize: false, substituteNote: null },
    { sku: "H05", name: "Digital Baby Thermometer", category: "Hygiene & Bath", standardPriceCents: 5000, priceCentsMin: 3500, priceCentsMax: 6500, description: "Braun ThermoScan 7 (ear) or Braun No-Touch (forehead). Health Canada approved.", preferredVendor: "Shoppers Drug Mart", ageStage: "All stages", requiresSize: false, substituteNote: "Substitute: iProven Forehead & Ear Thermometer." },
    { sku: "H06", name: "Baby Nail Scissors / File Set", category: "Hygiene & Bath", standardPriceCents: 1300, priceCentsMin: 1000, priceCentsMax: 1600, description: "Safety 1st or FridaBaby NailFrida. Rounded tip scissors and nail file.", preferredVendor: "Amazon.ca", ageStage: "0-12 months", requiresSize: false, substituteNote: null },
    { sku: "H07", name: "Cotton Balls (200-count)", category: "Hygiene & Bath", standardPriceCents: 700, priceCentsMin: 500, priceCentsMax: 900, description: "President's Choice or Rexall brand. 100% pure cotton, hypoallergenic.", preferredVendor: "Shoppers Drug Mart", ageStage: "All stages", requiresSize: false, substituteNote: null },
    { sku: "H08", name: "Baby Saline Nasal Drops / Spray", category: "Hygiene & Bath", standardPriceCents: 1050, priceCentsMin: 800, priceCentsMax: 1300, description: "Simply Saline Baby or Ayr Baby. Sterile saline for nasal congestion.", preferredVendor: "Shoppers Drug Mart", ageStage: "0-12 months", requiresSize: false, substituteNote: null },
    { sku: "H09", name: "Baby Sunscreen SPF 50 (100ml)", category: "Hygiene & Bath", standardPriceCents: 1700, priceCentsMin: 1400, priceCentsMax: 2000, description: "Aveeno Baby Continuous Protection or Neutrogena Pure & Free Baby. Mineral-based.", preferredVendor: "Shoppers Drug Mart", ageStage: "6 months+", requiresSize: false, substituteNote: null },
    { sku: "H10", name: "Gripe Water / Gas Drops", category: "Hygiene & Bath", standardPriceCents: 1400, priceCentsMin: 1000, priceCentsMax: 1800, description: "Ovol Drops (simethicone) or Mommy's Bliss Gripe Water. For infant gas and colic.", preferredVendor: "Shoppers Drug Mart", ageStage: "0-6 months", requiresSize: false, substituteNote: null },
  ];

  for (const c of COHORT_CIRCLES) {
    const circle = await prisma.circle.upsert({
      where:  { stageKey: c.stageKey },
      create: { name: c.name, emoji: c.emoji, stageKey: c.stageKey, groupLetter: c.groupLetter },
      update: { name: c.name, emoji: c.emoji, groupLetter: c.groupLetter },
    });
    for (const ch of c.channels) {
      const exists = await prisma.circleChannel.findFirst({ where: { circleId: circle.id, name: ch.name } });
      if (!exists) {
        await prisma.circleChannel.create({ data: { circleId: circle.id, name: ch.name, emoji: ch.emoji, order: ch.order } });
      }
    }
  }
  console.log(`OK  seeded ${COHORT_CIRCLES.length} cohort circles (+ channels)`);

  // The sliced SKU data still carries priceCentsMin / priceCentsMax, from an
  // older ItemCatalog that had a price band. The current model keeps only
  // standardPriceCents, so those two fields are dropped here rather than edited
  // out of the data above, which stays byte-identical to prisma/seed.ts. The
  // band values are not stored anywhere; if price ranges are wanted back, they
  // need columns first.
  for (const sku of skus) {
    const { priceCentsMin, priceCentsMax, ...fields } = sku;
    await prisma.itemCatalog.upsert({
      where:  { sku: fields.sku },
      update: { ...fields, lastVerifiedAt: now },
      create: { ...fields, isActive: true, lastVerifiedAt: now },
    });
  }
  console.log(`OK  seeded ${skus.length} catalogue SKUs`);

  const userCount = await prisma.user.count();
  console.log(`    User rows in database afterwards: ${userCount}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
