import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cronAuth";
import { runAddressRedaction } from "@/lib/addressRedactionJob";

export const dynamic = "force-dynamic";

/**
 * POST /api/cron/redact-addresses
 * Runs daily at 03:00 UTC. The rules are in lib/addressRedaction.
 *
 * A. Blank a per-item ShipmentAddress 24 hours after its item reaches a
 *    terminal status (FULFILLED, DELIVERED or CANCELLED). Unchanged.
 *
 * B. Blank a register's saved RegisterAddress:
 *      - never while a funded item is still waiting to be ordered or shipped;
 *      - 24 hours after every funded item is delivered;
 *      - 24 hours after the register is closed (or ended);
 *      - with nothing funded, 90 days after she confirmed it.
 *
 * C. Finish a live-consent withdrawal: a register the consent card switched
 *    into saved-address mode, whose mother has since withdrawn and which has
 *    no funded item still waiting, goes back to ask-per-shipment and its saved
 *    address is deleted (lib/liveAddress).
 *
 * Each blanking keeps an AddressAuditSnapshot first, then clears the
 * personal fields. Idempotent: rows already blanked are skipped.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(await runAddressRedaction(new Date()));
}
export { POST as GET };
