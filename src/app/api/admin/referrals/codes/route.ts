import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateReferralCode } from "@/lib/referral";

export const dynamic = "force-dynamic";

const MAX_BATCH = 25;

// GET — list codes (optionally filtered by ?partnerId), newest first.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const partnerId = req.nextUrl.searchParams.get("partnerId") ?? undefined;

  const codes = await prisma.referralCode.findMany({
    where:   partnerId ? { partnerId } : undefined,
    orderBy: { createdAt: "desc" },
    take:    500,
    include: { partner: { select: { name: true } } },
  });

  const data = codes.map((c) => ({
    id:           c.id,
    code:         c.code,
    partnerId:    c.partnerId,
    partnerName:  c.partner.name,
    status:       c.status,
    createdAt:    c.createdAt,
    usedAt:       c.usedAt,
    usedByUserId: c.usedByUserId,
    expiresAt:    c.expiresAt,
    note:         c.note,
  }));

  return NextResponse.json({ codes: data });
}

// POST — generate one or a small batch of codes for a partner.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { partnerId, count, note, expiresAt } = await req.json().catch(() => ({}));
  if (!partnerId) return NextResponse.json({ error: "partnerId is required" }, { status: 400 });

  const n = Math.max(1, Math.min(MAX_BATCH, Number(count) || 1));

  const partner = await prisma.referralPartner.findUnique({ where: { id: partnerId }, select: { id: true } });
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 });

  const expiry = expiresAt ? new Date(expiresAt) : null;
  if (expiry && isNaN(expiry.getTime())) {
    return NextResponse.json({ error: "Invalid expiry date" }, { status: 400 });
  }

  const created: { id: string; code: string }[] = [];
  for (let i = 0; i < n; i++) {
    // Retry on the rare unique-collision.
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      try {
        const rc = await prisma.referralCode.create({
          data: {
            code:      generateReferralCode(),
            partnerId,
            note:      note?.trim() || null,
            expiresAt: expiry,
          },
          select: { id: true, code: true },
        });
        created.push(rc);
        inserted = true;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }
    if (!inserted) {
      return NextResponse.json({ error: "Could not generate a unique code — please retry" }, { status: 500 });
    }
  }

  return NextResponse.json({ created });
}
