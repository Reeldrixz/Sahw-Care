import { Prisma } from "@prisma/client";
import { canReceiveShipment } from "@/lib/access";
import { BLANK_ITEM_SELECT, waitingToShip, auditSnapshot } from "@/lib/addressRedaction";
import { confirmAddressForMother, type AddressFields } from "@/lib/addressConfirm";

// A shipping address held ahead of time, so a mother can be featured on a
// live stream: items funded on air go straight to the fulfilment queue,
// with no wait for an address and no 14-day address-timeout refund.
//
// WHO. Only a mother who consents to live features must be in saved-address
// mode (SAVED_PER_REGISTER). Everyone else keeps the address option she
// chose. The consent card switches an ask-per-shipment register into saved
// mode when she confirms an address there, and stamps
// Register.liveAddressSwitchedAt so the switch can be undone.
//
// PICKABLE only with all three, checked in the pool, isRegisterPickable and
// the consent save route:
//   - saved-address mode,
//   - a saved address she confirmed in the last 90 days that isn't blanked,
//   - the same identity check as the per-item confirm (canReceiveShipment).
//
// WITHDRAWING. A register the card switched goes back to ask-per-shipment and
// its saved address is deleted, but only once no funded item is still waiting
// to ship. Until then it stays in saved mode so those items ship. The
// redact-addresses job finishes the revert later. A register she created in
// saved-address mode herself stays in it.

export const LIVE_ADDRESS_MAX_AGE_DAYS = 90;
const DAY = 86_400_000;

export const liveAddressCutoff = (now = new Date()) => new Date(now.getTime() - LIVE_ADDRESS_MAX_AGE_DAYS * DAY);

// The address half of the pickable rule, for a Register WHERE.
export function liveAddressWhere(now = new Date()): Prisma.RegisterWhereInput {
  return {
    addressMode:  "SAVED_PER_REGISTER",
    savedAddress: { is: { redactedAt: null, confirmedAt: { gte: liveAddressCutoff(now) } } },
  };
}

// The identity half, in code: the same check as the per-item confirm.
export const LIVE_IDENTITY_SELECT = { identityVerified: true, accountHold: true, manualReviewStatus: true, referralCodeId: true } as const;
export type LiveIdentity = {
  identityVerified: boolean; accountHold: boolean;
  manualReviewStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED"; referralCodeId: string | null;
};
export function shipmentIdentity(u: LiveIdentity) {
  return canReceiveShipment({ ...u, referredByPartner: u.referralCodeId != null });
}

export type LiveAddressState = {
  addressMode: "ASK_PER_SHIPMENT" | "SAVED_PER_REGISTER";
  savedAddress: { redactedAt: Date | null; confirmedAt: Date | null } | null;
  creator: LiveIdentity;
};
export const LIVE_ADDRESS_STATE_SELECT = {
  addressMode:  true,
  savedAddress: { select: { redactedAt: true, confirmedAt: true } },
  creator:      { select: LIVE_IDENTITY_SELECT },
} as const;

export type LiveReadiness =
  | { ready: true; confirmedAt: Date }
  | { ready: false; reason: "NO_ADDRESS" | "STALE_ADDRESS" | "NEEDS_IDENTITY" | "ACCOUNT_HOLD" };

export function liveReadiness(r: LiveAddressState, now = new Date()): LiveReadiness {
  const id = shipmentIdentity(r.creator);
  if (!id.allowed) return { ready: false, reason: id.code === "ACCOUNT_HOLD" || r.creator.accountHold ? "ACCOUNT_HOLD" : "NEEDS_IDENTITY" };
  const a = r.savedAddress;
  if (r.addressMode !== "SAVED_PER_REGISTER" || !a || a.redactedAt) return { ready: false, reason: "NO_ADDRESS" };
  if (!a.confirmedAt || a.confirmedAt < liveAddressCutoff(now)) return { ready: false, reason: "STALE_ADDRESS" };
  return { ready: true, confirmedAt: a.confirmedAt };
}

// ── Funded items still waiting to ship ──────────────────────────────────────

// A saved address is never blanked or deleted while any funded item is still
// waiting to be ordered or shipped (lib/addressRedaction waitingToShip).
export async function hasFundedItemWaiting(tx: Prisma.TransactionClient, registerId: string): Promise<boolean> {
  const items = await tx.registerItem.findMany({ where: { registerId }, select: BLANK_ITEM_SELECT });
  return items.some(waitingToShip);
}

// ── Confirming on the card ──────────────────────────────────────────────────

export type ConfirmLiveResult =
  | { ok: true; switched: boolean; queued: number }
  | { ok: false; status: number; error: string; code?: string };

// Saves (or re-confirms) the register's saved address, stamped confirmedAt,
// switches an ask-per-shipment register into saved mode, and queues any funded
// items of this register already waiting for an address. Identity is checked
// first, as for the per-item confirm.
export async function confirmLiveAddress(
  tx: Prisma.TransactionClient, registerId: string, motherId: string, fields: AddressFields, now = new Date(),
): Promise<ConfirmLiveResult> {
  const reg = await tx.register.findUnique({
    where:  { id: registerId },
    select: { creatorId: true, status: true, addressMode: true, creator: { select: LIVE_IDENTITY_SELECT } },
  });
  if (!reg) return { ok: false, status: 404, error: "Not found" };
  if (reg.creatorId !== motherId) return { ok: false, status: 403, error: "Forbidden" };
  // Identity first: it's about her, and tells her what to do next.
  const id = shipmentIdentity(reg.creator);
  if (!id.allowed) return { ok: false, status: 403, error: id.message ?? "Not allowed", code: id.code };
  if (reg.status !== "ACTIVE") return { ok: false, status: 400, error: "Only an active register can be featured." };

  await tx.registerAddress.upsert({
    where:  { registerId },
    create: { registerId, ...fields, confirmedAt: now },
    update: { ...fields, confirmedAt: now, redactedAt: null },
  });
  const switched = reg.addressMode === "ASK_PER_SHIPMENT";
  if (switched) {
    await tx.register.update({
      where: { id: registerId },
      data:  { addressMode: "SAVED_PER_REGISTER", liveAddressSwitchedAt: now },
    });
  }
  const queued = await confirmAddressForMother(tx, motherId, fields, { registerId });
  return { ok: true, switched, queued: queued.length };
}

// ── Withdrawing ─────────────────────────────────────────────────────────────

// Called when she withdraws live consent (the consent save route). Reverts
// now if nothing funded is waiting; otherwise stamps
// liveAddressRevertPendingAt for the redact-addresses job to finish.
export async function onLiveConsentWithdrawn(tx: Prisma.TransactionClient, registerId: string, now = new Date()): Promise<"REVERTED" | "PENDING" | "NOT_SWITCHED"> {
  const reg = await tx.register.findUnique({ where: { id: registerId }, select: { liveAddressSwitchedAt: true } });
  if (!reg?.liveAddressSwitchedAt) return "NOT_SWITCHED";
  if (await revertLiveAddressSwitch(tx, registerId)) return "REVERTED";
  await tx.register.update({ where: { id: registerId }, data: { liveAddressRevertPendingAt: now } });
  return "PENDING";
}

// Which registers the job may revert: switched by the card, not consenting,
// and EITHER she withdrew while items were waiting (pending) OR the saved
// address is already gone (blanked after 90 days with nothing funded, say).
// A mother who confirmed on the card but hasn't said yes yet, with her
// address intact, is mid-flow and is left alone.
export const REVERT_CANDIDATE_WHERE: Prisma.RegisterWhereInput = {
  liveAddressSwitchedAt: { not: null },
  featureConsent:        false,
  OR: [
    { liveAddressRevertPendingAt: { not: null } },
    { savedAddress: { is: { redactedAt: { not: null } } } },
    { savedAddress: { is: null } },
  ],
};

// Undo the card's switch if nothing funded is still waiting to ship: back to
// ask-per-shipment, saved address deleted (an audit snapshot is kept first if
// anything was ever shipped to it, as the blanking job does). Returns whether
// it reverted. A register she put in saved mode herself is never touched.
export async function revertLiveAddressSwitch(tx: Prisma.TransactionClient, registerId: string): Promise<boolean> {
  const reg = await tx.register.findUnique({
    where:  { id: registerId },
    select: { liveAddressSwitchedAt: true, featureConsent: true, savedAddress: true, items: { select: { fulfillmentQueue: { select: { id: true } } } } },
  });
  if (!reg?.liveAddressSwitchedAt || reg.featureConsent) return false;
  if (await hasFundedItemWaiting(tx, registerId)) return false;

  const a = reg.savedAddress;
  if (a && !a.redactedAt && reg.items.some((i) => i.fulfillmentQueue)) {
    await tx.addressAuditSnapshot.create({ data: auditSnapshot(a, { registerId, registerItemId: null }) });
  }
  if (a) await tx.registerAddress.delete({ where: { registerId } });
  await tx.register.update({
    where: { id: registerId },
    data:  { addressMode: "ASK_PER_SHIPMENT", liveAddressSwitchedAt: null, liveAddressRevertPendingAt: null },
  });
  return true;
}
