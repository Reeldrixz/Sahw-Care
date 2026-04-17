import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const instances = await prisma.bundleInstance.findMany({
    where:   { recipientId: auth.userId },
    orderBy: { requestedAt: "desc" },
    take:    5,
    include: {
      campaign: { select: { title: true, sponsorName: true } },
      template: { select: { name: true, items: true } },
    },
  });

  const formatted = instances.map((i) => ({
    id:             i.id,
    status:         i.status,
    requestedAt:    i.requestedAt,
    approvedAt:     i.approvedAt,
    orderedAt:      i.orderedAt,
    shippedAt:      i.shippedAt,
    deliveredAt:    i.deliveredAt,
    confirmedAt:    i.confirmedAt,
    trackingNumber: i.trackingNumber,
    campaign:       { title: i.campaign.title, sponsorName: i.campaign.sponsorName },
    template:       { name: i.template.name, items: i.template.items },
  }));

  return NextResponse.json({ instances: formatted });
}
