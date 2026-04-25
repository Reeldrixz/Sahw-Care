import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { role: true } });
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Idempotent — skip if data already exists
  const existing = await prisma.campaign.count();
  if (existing > 0) return NextResponse.json({ message: "Already seeded", skipped: true });

  // Template 1: Newborn Essentials
  const template1 = await prisma.bundleTemplate.create({
    data: {
      name:        "Newborn Essentials",
      description: "Everything you need for the first weeks with your newborn.",
      estimatedCost: 75,
      targetStage: "postpartum-0-3",
      items: [
        { name: "Newborn diapers",  quantity: "1 pack",  notes: "Size NB" },
        { name: "Baby wipes",       quantity: "2 packs", notes: "Fragrance-free" },
        { name: "Onesies",          quantity: "3",       notes: "0–3 month size" },
        { name: "Baby wash",        quantity: "1 bottle", notes: "Gentle formula" },
        { name: "Cotton balls",     quantity: "1 bag",   notes: "For newborn care" },
      ],
    },
  });

  // Template 2: Pregnancy Care Kit
  const template2 = await prisma.bundleTemplate.create({
    data: {
      name:        "Pregnancy Care Kit",
      description: "Comfort essentials for your third trimester and birth preparation.",
      estimatedCost: 65,
      targetStage: "pregnancy-7-9",
      items: [
        { name: "Maternity pads",    quantity: "2 packs", notes: "Heavy flow, post-birth ready" },
        { name: "Nursing pads",      quantity: "1 pack",  notes: "Disposable" },
        { name: "Belly band",        quantity: "1",       notes: "Adjustable fit" },
        { name: "Prenatal vitamins", quantity: "1 bottle", notes: "OTC — consult your midwife" },
      ],
    },
  });

  // Campaign (uses Newborn Essentials as main template)
  const campaign = await prisma.campaign.create({
    data: {
      title:           "Kradəl Care Starter Bundle",
      description:     "A handpicked bundle of essentials, delivered to your door — completely free. Sponsored by Kradəl Care to support new mothers in our community.",
      sponsorName:     "Kradəl Care",
      totalBudget:     800,
      costPerBundle:   80,
      totalBundles:    10,
      bundlesRemaining: 10,
      status:          "ACTIVE",
      templateId:      template1.id,
      startDate:       new Date(),
    },
  });

  return NextResponse.json({ message: "Seeded successfully", campaign, templates: [template1, template2] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
