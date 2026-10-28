import { NextRequest, NextResponse } from "next/server";
import { resolveEventByToken } from "@/lib/fundraisingEvent";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { fetchStreamerOrders } from "@/lib/fulfillmentOrder";

export const dynamic = "force-dynamic";

// The streamer's orders page data: for each register fully funded in this
// event, the mother's first name, the items, each order's status, tracking
// link, estimated delivery and total with tax. Nothing else.
//
// The read is lib/fulfillmentOrder fetchStreamerOrders, whose select never
// names the order number, who recorded it, supplier, cost, notes or any id.
// Don't widen it here. lib/fulfillmentOrder.test.ts and
// scripts/db-tests/streamerOrders.db-test.ts check the response.
//
// The server never fetches the tracking link; it only returns the text an
// admin entered, which lib/trackingLink checked.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const rl = rateLimit(`host-orders:${getClientIp(req)}`, 60, 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const { token } = await params;
  // Same single failure mode as the other host routes.
  const event = await resolveEventByToken(token);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const registers = await fetchStreamerOrders(event.id);
  return NextResponse.json(
    { registers, fetchedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } },
  );
}
