import { prisma } from "@/lib/prisma";
import type { AdminFacingRegister, DonorFacingRegister } from "@/types/register-dtos";

// ── Admin helper: includes all address data ───────────────────────────────────

export async function fetchAdminRegister(registerId: string): Promise<AdminFacingRegister | null> {
  return prisma.register.findUnique({
    where: { id: registerId },
    include: {
      savedAddress: true,
      items: {
        include: { shipmentAddress: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

// ── Donor helper: address data excluded at the query level ────────────────────
// Address fields are never loaded from the database — not just stripped at
// serialization time. This is the authoritative shape for all donor-facing
// register responses.

export async function fetchDonorRegister(registerId: string): Promise<DonorFacingRegister | null> {
  return prisma.register.findUnique({
    where: { id: registerId },
    select: {
      id:          true,
      title:       true,
      city:        true,
      dueDate:     true,
      addressMode: true,
      status:      true,
      completedAt: true,
      closedAt:    true,
      createdAt:   true,
      updatedAt:   true,
      creatorId:   true,
      // savedAddress intentionally absent
      items: {
        select: {
          id:                 true,
          name:               true,
          category:           true,
          quantity:           true,
          note:               true,
          storeLinks:         true,
          status:             true,
          catalogItemId:      true,
          standardPriceCents: true,
          totalFundedCents:   true,
          fundingStatus:      true,
          createdAt:          true,
          updatedAt:          true,
          registerId:         true,
          // shipmentAddress intentionally absent
        },
        orderBy: { createdAt: "asc" },
      },
    },
  }) as Promise<DonorFacingRegister | null>;
}
