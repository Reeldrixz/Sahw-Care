import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET;

function hashAddress(
  streetAddress: string,
  unit: string | null,
  city: string,
  province: string,
  postalCode: string,
  country: string
): string {
  return createHash("sha256")
    .update(`${streetAddress}|${unit ?? ""}|${city}|${province}|${postalCode}|${country}`)
    .digest("hex");
}

/**
 * POST /api/cron/redact-addresses
 * Runs daily at 03:00 UTC. Two jobs:
 *
 * A. Redact ShipmentAddress rows where the linked RegisterItem has reached
 *    a terminal status (DELIVERED or CANCELLED) at least 24 hours ago.
 *
 * B. Redact RegisterAddress rows where the linked Register has reached a
 *    terminal status (COMPLETED, CLOSED, or ABANDONED) at least 24 hours ago.
 *
 * Each redaction: captures an AddressAuditSnapshot then clears PII fields.
 * Idempotent — rows with redactedAt already set are skipped.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  let shipmentRedacted = 0;
  let savedRedacted = 0;

  // ── Job A: Per-item ShipmentAddress ─────────────────────────────────────────
  const shipmentAddresses = await prisma.shipmentAddress.findMany({
    where: {
      redactedAt: null,
      registerItem: {
        status: { in: ["DELIVERED", "CANCELLED"] },
        updatedAt: { lte: cutoff },
      },
    },
    include: {
      registerItem: { select: { id: true, registerId: true } },
    },
    take: 200,
  });

  for (const addr of shipmentAddresses) {
    const snapshot = {
      registerItemId:   addr.registerItem.id,
      registerId:       null,
      city:             addr.city,
      province:         addr.province,
      country:          addr.country,
      postalCodeFirst3: addr.postalCode.slice(0, 3).toUpperCase(),
      addressHash:      hashAddress(addr.streetAddress, addr.unit, addr.city, addr.province, addr.postalCode, addr.country),
    };

    await prisma.$transaction([
      prisma.addressAuditSnapshot.create({ data: snapshot }),
      prisma.shipmentAddress.update({
        where: { id: addr.id },
        data: {
          fullName:      "[REDACTED]",
          streetAddress: "[REDACTED]",
          unit:          null,
          postalCode:    "",
          phone:         "[REDACTED]",
          redactedAt:    now,
        },
      }),
    ]);
    shipmentRedacted++;
  }

  // ── Job B: Per-register RegisterAddress ─────────────────────────────────────
  const savedAddresses = await prisma.registerAddress.findMany({
    where: {
      redactedAt: null,
      register: {
        status: { in: ["COMPLETED", "CLOSED", "ABANDONED"] },
        updatedAt: { lte: cutoff },
      },
    },
    include: {
      register: { select: { id: true } },
    },
    take: 200,
  });

  for (const addr of savedAddresses) {
    const snapshot = {
      registerId:       addr.register.id,
      registerItemId:   null,
      city:             addr.city,
      province:         addr.province,
      country:          addr.country,
      postalCodeFirst3: addr.postalCode.slice(0, 3).toUpperCase(),
      addressHash:      hashAddress(addr.streetAddress, addr.unit, addr.city, addr.province, addr.postalCode, addr.country),
    };

    await prisma.$transaction([
      prisma.addressAuditSnapshot.create({ data: snapshot }),
      prisma.registerAddress.update({
        where: { id: addr.id },
        data: {
          fullName:      "[REDACTED]",
          streetAddress: "[REDACTED]",
          unit:          null,
          postalCode:    "",
          phone:         "[REDACTED]",
          redactedAt:    now,
        },
      }),
    ]);
    savedRedacted++;
  }

  return NextResponse.json({
    ok:               true,
    counts:           { shipmentRedacted, savedRedacted },
    timestamp:        now.toISOString(),
  });
}
