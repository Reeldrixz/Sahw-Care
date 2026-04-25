import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  sendBundleApproved,
  sendBundleShipped,
} from "@/lib/email";

export const dynamic = "force-dynamic";

async function adminGuard(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return null;
  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { role: true } });
  return user?.role === "ADMIN" ? auth : null;
}

type Params = { params: Promise<{ id: string }> };

// PATCH /api/admin/bundles/[id] — update instance status / campaign / template
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await adminGuard(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {

  const { id } = await params;
  const body = await req.json();

  // Campaign update
  if (body.type === "campaign") {
    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...(body.title           !== undefined && { title:           body.title }),
        ...(body.description     !== undefined && { description:     body.description }),
        ...(body.sponsorName     !== undefined && { sponsorName:     body.sponsorName }),
        ...(body.status          !== undefined && { status:          body.status }),
        ...(body.bundlesRemaining !== undefined && { bundlesRemaining: body.bundlesRemaining }),
        ...(body.totalBundles    !== undefined && { totalBundles:    body.totalBundles }),
        ...(body.costPerBundle   !== undefined && { costPerBundle:   body.costPerBundle }),
        ...(body.totalBudget     !== undefined && { totalBudget:     body.totalBudget }),
        ...(body.targetStage     !== undefined && { targetStage:     body.targetStage || null }),
        ...(body.targetRegion    !== undefined && { targetRegion:    body.targetRegion || null }),
      },
    });
    return NextResponse.json({ campaign });
  }

  // Template update
  if (body.type === "template") {
    const template = await prisma.bundleTemplate.update({
      where: { id },
      data: {
        ...(body.name          !== undefined && { name:          body.name }),
        ...(body.description   !== undefined && { description:   body.description }),
        ...(body.estimatedCost !== undefined && { estimatedCost: body.estimatedCost }),
        ...(body.items         !== undefined && { items:         body.items }),
        ...(body.targetStage   !== undefined && { targetStage:   body.targetStage || null }),
        ...(body.isActive      !== undefined && { isActive:      body.isActive }),
      },
    });
    return NextResponse.json({ template });
  }

  // BundleInstance status update
  const instance = await prisma.bundleInstance.findUnique({
    where:   { id },
    include: { recipient: { select: { name: true, email: true } }, template: { select: { name: true } } },
  });
  if (!instance) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const statusToDateField: Record<string, string> = {
    APPROVED:  "approvedAt",
    ORDERED:   "orderedAt",
    SHIPPED:   "shippedAt",
    DELIVERED: "deliveredAt",
    COMPLETED: "confirmedAt",
  };

  const newStatus = body.status as string;
  const dateField = statusToDateField[newStatus];

  const updated = await prisma.bundleInstance.update({
    where: { id },
    data: {
      ...(newStatus && { status: newStatus as never }),
      ...(dateField && { [dateField]: new Date() }),
      ...(body.trackingNumber  !== undefined && { trackingNumber:  body.trackingNumber }),
      ...(body.orderReference  !== undefined && { orderReference:  body.orderReference }),
      ...(body.adminNotes      !== undefined && { adminNotes:      body.adminNotes }),
    },
  });

  // If rejected, free up the user's activeBundleId
  if (newStatus === "REJECTED") {
    await prisma.user.update({
      where: { id: instance.recipientId },
      data:  { activeBundleId: null },
    });
    await prisma.campaign.update({
      where: { id: instance.campaignId },
      data:  { bundlesRemaining: { increment: 1 } },
    });
  }

  // Email notifications (fire-and-forget)
  const firstName = instance.recipient.name.split(" ")[0];
  if (newStatus === "APPROVED") {
    sendBundleApproved({ firstName, email: instance.recipient.email, templateName: instance.template.name }).catch(() => {});
  }
  if (newStatus === "SHIPPED") {
    sendBundleShipped({ firstName, email: instance.recipient.email, templateName: instance.template.name, trackingNumber: body.trackingNumber ?? null }).catch(() => {});
  }

  return NextResponse.json({ instance: updated });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/bundles/[id] — create campaign or template
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await adminGuard(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {

  const { id: type } = await params; // "campaign" or "template"
  const body = await req.json();

  if (type === "campaign") {
    const campaign = await prisma.campaign.create({
      data: {
        title:           body.title,
        description:     body.description,
        sponsorName:     body.sponsorName ?? "Kradəl Care",
        totalBudget:     Number(body.totalBudget) || 0,
        costPerBundle:   Number(body.costPerBundle) || 0,
        totalBundles:    Number(body.totalBundles) || 0,
        bundlesRemaining: Number(body.totalBundles) || 0,
        status:          body.status ?? "DRAFT",
        targetStage:     body.targetStage || null,
        targetRegion:    body.targetRegion || null,
        templateId:      body.templateId,
      },
    });
    return NextResponse.json({ campaign }, { status: 201 });
  }

  if (type === "template") {
    const template = await prisma.bundleTemplate.create({
      data: {
        name:          body.name,
        description:   body.description,
        estimatedCost: Number(body.estimatedCost) || 0,
        items:         body.items ?? [],
        targetStage:   body.targetStage || null,
        isActive:      true,
      },
    });
    return NextResponse.json({ template }, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
