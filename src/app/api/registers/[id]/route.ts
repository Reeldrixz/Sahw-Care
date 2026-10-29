import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VERIFICATION_BADGE_FIELDS, withVerificationBadge } from "@/lib/verificationBadge";
import { FEATURE_CONSENT_VERSION } from "@/lib/featureConsent";
import { scrubOrdersForRegister } from "@/lib/fulfillmentOrder";
import { LIVE_ADDRESS_STATE_SELECT, liveReadiness, onLiveConsentWithdrawn } from "@/lib/liveAddress";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;

  const register = await prisma.register.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true, location: true, ...VERIFICATION_BADGE_FIELDS } },
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          assignment: {
            include: {
              donor: { select: { id: true, name: true } },
              fulfillmentLog: { select: { momConfirmed: true, mismatch: true } },
            },
          },
          _count: { select: { funding: true } },
          catalogItem: { select: { imageUrl: true, sku: true } },
        },
      },
    },
  });

  if (!register) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isCreator = auth?.userId === register.creatorId;
  const withBadge = { ...register, creator: withVerificationBadge(register.creator) };
  const responseRegister = isCreator
    ? withBadge
    : { ...withBadge, items: register.items.filter((i) => i.status !== "PENDING_APPROVAL") };

  // For her own consent card only: whether a shipping address is held ahead
  // of time. A yes/no and a date, never the address.
  if (isCreator) {
    const state = await prisma.register.findUnique({ where: { id }, select: LIVE_ADDRESS_STATE_SELECT });
    const ready = state ? liveReadiness(state) : { ready: false as const, reason: "NO_ADDRESS" as const };
    return NextResponse.json({
      register: responseRegister,
      liveAddress: ready.ready
        ? { ready: true, confirmedAt: ready.confirmedAt.toISOString() }
        : { ready: false, reason: ready.reason },
    });
  }

  return NextResponse.json({ register: responseRegister });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const register = await prisma.register.findUnique({ where: { id } });
  if (!register) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (register.creatorId !== auth.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, city, dueDate, status, featureConsent } = await req.json();

  if (status === "CLOSED") {
    const updated = await prisma.$transaction(async (tx) => {
      const reg = await tx.register.update({
        where: { id },
        data: { status: "CLOSED", closedAt: new Date() },
      });
      // Cancel all unfunded items — refund of partial contributions deferred to Phase 4
      await tx.registerItem.updateMany({
        where: {
          registerId: id,
          status: { in: ["AVAILABLE", "PENDING_APPROVAL"] },
          fundingStatus: "UNFUNDED",
        },
        data: { status: "CANCELLED" },
      });
      return reg;
    });
    return NextResponse.json({ register: updated });
  }

  // Fundraising feature consent. Only the register's own creator reaches this
  // — ownership is checked above — so consent can only ever be set by her.
  //
  // Written as an explicit boolean check rather than a truthy one: `featureConsent
  // && {...}` would silently ignore `false`, making the toggle impossible to
  // turn OFF. On a consent flag that failure mode is unacceptable, so revocation
  // has to be as easy as granting.
  //
  // Granting stamps when she agreed and which wording she agreed to — always the
  // current one, since that is the card she was shown (lib/featureConsent).
  // Revoking nulls both. No revoked-at history: keeping a record of consent she
  // withdrew is the opposite of honouring it.
  const consentPatch =
    typeof featureConsent === "boolean"
      ? featureConsent
        ? { featureConsent: true,  featureConsentAt: new Date(), featureConsentVersion: FEATURE_CONSENT_VERSION }
        : { featureConsent: false, featureConsentAt: null,       featureConsentVersion: null }
      : {};

  // A yes needs a shipping address held ahead of time (lib/liveAddress):
  // saved-address mode, confirmed in the last 90 days, and the shipment
  // identity check. Refused here, on the server, whatever the card shows.
  if (featureConsent === true) {
    const state = await prisma.register.findUnique({ where: { id }, select: LIVE_ADDRESS_STATE_SELECT });
    const ready = state ? liveReadiness(state) : null;
    if (!ready?.ready) {
      return NextResponse.json({
        error: "To be featured on a live stream, please confirm your shipping address first.",
        code:  "NEEDS_LIVE_ADDRESS",
        reason: ready && !ready.ready ? ready.reason : "NO_ADDRESS",
      }, { status: 400 });
    }
  }

  // Withdrawing undoes the card's switch to saved-address mode, in the same
  // transaction, unless a funded item is still waiting to ship (then the
  // redact-addresses job finishes it once they have shipped).
  const { updated, liveAddressReverted } = await prisma.$transaction(async (tx) => {
    const updated = await tx.register.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(city && { city }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...consentPatch,
        // Saying yes again before a pending revert ran cancels it.
        ...(featureConsent === true && { liveAddressRevertPendingAt: null }),
      },
    });
    const liveAddressReverted = featureConsent === false ? (await onLiveConsentWithdrawn(tx, id)) === "REVERTED" : false;
    return { updated, liveAddressReverted };
  });

  return NextResponse.json({ register: updated, liveAddressReverted });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getTokenFromRequest(_req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const register = await prisma.register.findUnique({ where: { id } });
  if (!register) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (register.creatorId !== auth.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Never blocked. Her orders stay as financial records with registerId set
  // to null; their tracking link and order number are cleared first, in the
  // same transaction, so nothing left points back at her.
  await prisma.$transaction(async (tx) => {
    await scrubOrdersForRegister(tx, id);
    await tx.register.delete({ where: { id } });
  });
  return NextResponse.json({ ok: true });
}
