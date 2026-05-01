import type {
  Register,
  RegisterItem,
  RegisterAddress,
  ShipmentAddress,
} from "@prisma/client";

// ── Admin-facing: includes all address data ──────────────────────────────────

export type AdminFacingRegisterItem = RegisterItem & {
  shipmentAddress: ShipmentAddress | null;
};

export type AdminFacingRegister = Register & {
  savedAddress: RegisterAddress | null;
  items: AdminFacingRegisterItem[];
};

// ── Donor-facing: address fields structurally absent ─────────────────────────
// These types do NOT include savedAddress or shipmentAddress.
// Donor-facing endpoints must use fetchDonorRegister() which excludes address
// data at the Prisma query level, then return DonorFacingRegister.
// The compiler prevents passing AdminFacingRegister where DonorFacingRegister
// is expected because the shapes are structurally incompatible once the
// address fields are present on the admin type.
//
// TypeScript structural-incompatibility note:
//   declare const admin: AdminFacingRegister;
//   declare function sendToDonor(r: DonorFacingRegister): void;
//   sendToDonor(admin); // ← COMPILER ERROR: savedAddress is excess on AdminFacingRegister
//   sendToDonor({ ...admin, savedAddress: undefined }); // still errors — savedAddress key present
//   // Correct usage: sendToDonor(toDonorFacingRegister(admin));

export type DonorFacingRegisterItem = Omit<RegisterItem, never>;
// No shipmentAddress field — structurally cannot carry address data.

export type DonorFacingRegister = Omit<Register, never> & {
  items: DonorFacingRegisterItem[];
  // savedAddress is absent by omission — not Omit<>, just not declared.
  // This means AdminFacingRegister is NOT assignable to DonorFacingRegister
  // because DonorFacingRegister does not declare savedAddress, so any
  // object with savedAddress is an excess property violation in strict mode.
};

// ── Conversion utility ────────────────────────────────────────────────────────

export function toDonorFacingRegister(
  register: AdminFacingRegister
): DonorFacingRegister {
  const { savedAddress: _savedAddress, items, ...rest } = register;
  return {
    ...rest,
    items: items.map(
      ({ shipmentAddress: _shipmentAddress, ...item }) => item
    ),
  };
}
