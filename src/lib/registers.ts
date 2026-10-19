import { prisma } from "@/lib/prisma";
import type { AdminFacingRegister, DonorFacingRegister } from "@/types/register-dtos";
import { VERIFICATION_BADGE_FIELDS, verificationBadgeFor, type VerificationBadge } from "@/lib/verificationBadge";
import { FEATURE_CONSENT_VERSION } from "@/lib/featureConsent";
import { isPickableByProgress } from "@/lib/eventProgress";

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
  verificationBadge: VerificationBadge;
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
      // creator: first name + the inputs to her verification badge only — never
      // full name, location, contact. The badge inputs are reduced to the badge
      // below and are not returned.
      creator: { select: { name: true, ...VERIFICATION_BADGE_FIELDS } },
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
    verificationBadge: verificationBadgeFor(register.creator),
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

// ── Event registers: what fundraising events can show ────────────────────────
//
// Two reads, deliberately different:
//
//   fetchFeaturableRegisters() — the PICKABLE pool: the registers a host may
//     choose to put on screen: current consent, ACTIVE, and under 30% funded
//     (lib/eventProgress), oldest first. Used for the host's list and the
//     public event page's list. isRegisterPickable(id) is the same rule for one
//     register, used by the host's "feature this" check.
//   fetchOnScreenRegister(id)  — the register a host has ALREADY put on screen,
//     for the overlay, the host's "On screen" panel and the top of the public
//     event page.
//
// Consent and the 30% rule are checked when a register is PICKED, not while it
// is on screen: a register that crosses 30%, or completes, stays up until the
// host moves on. A mother who withdraws stops being pickable at once; a stream
// already showing her keeps showing her until the host moves on or the event
// ends. That is what the consent card (lib/featureConsent, version 2) tells her
// before she agrees, so the on-screen read does not re-check consent.
//
// Load-bearing properties of the pickable pool, not to be relaxed:
//
// 1. Consent lives IN THE WHERE, never as a post-filter: featureConsent true
//    AND featureConsentVersion = the current wording. A register without
//    current consent is unreachable by construction rather than by a filter
//    someone can forget to apply, reorder, or drop while refactoring. Consent
//    to an earlier wording does not count.
//
// 2. Both reads return fetchPublicRegister's shape, by calling it, MINUS the
//    verification badge, her city and her due date. There is no second mapping
//    that could drift and start including a surname, a contact detail or an
//    address; an event can only ever see a subset of the public page.
//      badge    — for a donor who has opened her register (/r, /registers/[id]),
//                 not for a broadcast, an event listing or a host's tooling
//      city     — the consent card promises viewers never see her area
//      due date — the consent card promises viewers never see her due date
//    Stripped here, not per consumer, so no event surface can receive them.
//
// ACTIVE only in the pickable pool. A COMPLETED register is deliberately
// excluded even with consent on: she agreed while her register was live and
// asking for help, and appearing in a campaign months after it was fulfilled
// is a materially different thing to have agreed to. (The on-screen read keeps
// showing a register that completes while featured — that is the moment the
// event exists for.)
//
// Both are read LIVE. Anything that caches the pickable pool must re-check
// before picking.
export type FeaturableRegister = Omit<PublicRegister, "verificationBadge" | "city" | "dueDate">;

function toEventShape(r: PublicRegister): FeaturableRegister {
  const { verificationBadge: _badge, city: _city, dueDate: _due, ...rest } = r;
  return rest;
}

// Who can be picked: current-version consent and ACTIVE, in the query; under
// 30% funded (lib/eventProgress), in code, on the same items a donor sees.
// The 30% rule is applied in code rather than SQL so it has one definition;
// it is a progress rule, not a privacy one, so consent stays in the WHERE.
const PICKABLE_WHERE = {
  featureConsent:        true,
  featureConsentVersion: FEATURE_CONSENT_VERSION,
  status:                "ACTIVE" as const,
};

const PROGRESS_ITEMS_SELECT = {
  where:  { status: { notIn: ["PENDING_APPROVAL", "CANCELLED"] as ("PENDING_APPROVAL" | "CANCELLED")[] } },
  select: { standardPriceCents: true, totalFundedCents: true, fundingStatus: true },
};

// The pickable pool, in one stable order: oldest register first (createdAt,
// then id), never by need or progress. No cap: the host sees every eligible
// register. The cap used to be applied in the query, before any filtering, so
// the 51st eligible register was silently missing — and the pick check, which
// searched the same capped list, would have refused it.
export async function fetchFeaturableRegisters(): Promise<FeaturableRegister[]> {
  const candidates = await prisma.register.findMany({
    where:   PICKABLE_WHERE,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select:  { id: true, items: PROGRESS_ITEMS_SELECT },
  });
  const pickable = candidates.filter((r) => isPickableByProgress(r.items));

  // Deliberately re-fetched through the public helper rather than selected here.
  // One definition of what is public, one place to audit.
  const full = await Promise.all(pickable.map((r) => fetchPublicRegister(r.id)));
  return full.filter((r): r is PublicRegister => r !== null).map(toEventShape);
}

// The pick check for one register: the same rule as the pool, without
// building the whole pool.
export async function isRegisterPickable(id: string): Promise<boolean> {
  const r = await prisma.register.findFirst({
    where:  { id, ...PICKABLE_WHERE },
    select: { items: PROGRESS_ITEMS_SELECT },
  });
  return !!r && isPickableByProgress(r.items);
}

// The register an event currently has on screen, by the id the host picked.
// No consent check — see above: consent was checked when it was picked.
export async function fetchOnScreenRegister(id: string | null): Promise<FeaturableRegister | null> {
  if (!id) return null;
  const r = await fetchPublicRegister(id);
  return r ? toEventShape(r) : null;
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
