import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { confirmLiveAddress } from "@/lib/liveAddress";

export const dynamic = "force-dynamic";

// The live-feature consent card's address step (lib/liveAddress). Saves, or
// re-confirms, this register's saved address, stamped confirmedAt, after the
// same identity check as the per-item confirm. An ask-per-shipment register
// is switched into saved-address mode, and remembered as switched by the card.
// Funded items of this register already waiting for an address are queued.
//
// It doesn't record consent: she still says yes on the card afterwards.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  const fields = {
    fullName: str("fullName"), streetAddress: str("streetAddress"), unit: str("unit") || null,
    city: str("city"), province: str("province"), postalCode: str("postalCode"), phone: str("phone"),
  };
  if (!fields.fullName || !fields.streetAddress || !fields.city || !fields.province || !fields.postalCode || !fields.phone) {
    return NextResponse.json({ error: "All address fields are required" }, { status: 400 });
  }
  if (Object.values(fields).some((v) => typeof v === "string" && v.length > 200)) {
    return NextResponse.json({ error: "One of the fields is too long." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction((tx) => confirmLiveAddress(tx, id, auth.userId, fields));
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
    // A yes/no and counts only; the address is never echoed back.
    return NextResponse.json({ ok: true, switched: result.switched, queued: result.queued });
  } catch (err) {
    if (err instanceof Error && err.message === "ADDRESS_RACE") {
      return NextResponse.json({ error: "Your address was just confirmed. Refresh to continue." }, { status: 409 });
    }
    throw err;
  }
}
