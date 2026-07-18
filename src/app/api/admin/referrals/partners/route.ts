import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET — list partners with code counts by status.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const partners = await prisma.referralPartner.findMany({
    orderBy: { createdAt: "desc" },
    include: { codes: { select: { status: true } } },
  });

  const data = partners.map((p) => {
    const codes = p.codes;
    return {
      id:           p.id,
      name:         p.name,
      orgType:      p.orgType,
      contactEmail: p.contactEmail,
      active:       p.active,
      createdAt:    p.createdAt,
      total:        codes.length,
      unused:       codes.filter((c) => c.status === "UNUSED").length,
      used:         codes.filter((c) => c.status === "USED").length,
      revoked:      codes.filter((c) => c.status === "REVOKED").length,
    };
  });

  return NextResponse.json({ partners: data });
}

// POST — create a partner org.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, orgType, contactEmail } = await req.json().catch(() => ({}));
  if (!name?.trim() || !orgType?.trim()) {
    return NextResponse.json({ error: "Name and organization type are required" }, { status: 400 });
  }

  const partner = await prisma.referralPartner.create({
    data: {
      name:         name.trim(),
      orgType:      orgType.trim(),
      contactEmail: contactEmail?.trim() || null,
    },
  });

  return NextResponse.json({ partner });
}
