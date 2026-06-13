import { prisma } from "@/lib/prisma";
import type { AdminFacingRegister, DonorFacingRegister } from "@/types/register-dtos";

// ── Public share helper: privacy-safe, no auth required ───────────────────────
// Powers the shareable /r/[id] page. Exposes the mother's FIRST NAME only and
// never loads address or contact data (address relations are not selected).
// DRAFT / ABANDONED registers are treated as not-found so half-built or
// retired lists are never publicly reachable.

export interface PublicRegisterItem {
  id:                 string;
  name:               string;
  category:           string;
  quantity:           string;
  note:               string | null;
  status:             string;
  standardPriceCents: number;
  totalFundedCents:   number;
  fundingStatus:      string;
  contributorCount:   number;
  imageUrl:           string | null;
}

export interface PublicRegister {
  id:                string;
  title:             string;
  city:              string;
  dueDate:           string; // ISO
  status:            string;
  intro:             string | null;
  firstName:         string;
  verificationLevel: number;
  items:             PublicRegisterItem[];
}

export async function fetchPublicRegister(id: string): Promise<PublicRegister | null> {
  const register = await prisma.register.findUnique({
    where: { id },
    select: {
      id:      true,
      title:   true,
      city:    true,
      dueDate: true,
      status:  true,
      intro:   true,
      // creator: first name + verification only — never full name, location, contact
      creator: { select: { name: true, verificationLevel: true } },
      items: {
        where:   { status: { notIn: ["PENDING_APPROVAL", "CANCELLED"] } },
        orderBy: { createdAt: "asc" },
        select: {
          id:                 true,
          name:               true,
          category:           true,
          quantity:           true,
          note:               true,
          status:             true,
          standardPriceCents: true,
          totalFundedCents:   true,
          fundingStatus:      true,
          _count:             { select: { funding: true } },
          catalogItem:        { select: { imageUrl: true } },
          // shipmentAddress intentionally never selected
        },
      },
    },
  });

  if (!register || register.status === "DRAFT" || register.status === "ABANDONED") {
    return null;
  }

  return {
    id:                register.id,
    title:             register.title,
    city:              register.city,
    dueDate:           register.dueDate.toISOString(),
    status:            register.status,
    intro:             register.intro ?? null,
    firstName:         register.creator.name.split(" ")[0] || register.creator.name,
    verificationLevel: register.creator.verificationLevel ?? 0,
    items: register.items.map((i) => ({
      id:                 i.id,
      name:               i.name,
      category:           i.category,
      quantity:           i.quantity,
      note:               i.note,
      status:             i.status,
      standardPriceCents: i.standardPriceCents,
      totalFundedCents:   i.totalFundedCents,
      fundingStatus:      i.fundingStatus,
      contributorCount:   i._count.funding,
      imageUrl:           i.catalogItem?.imageUrl ?? null,
    })),
  };
}

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
        where: { status: { not: "PENDING_APPROVAL" } },
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
