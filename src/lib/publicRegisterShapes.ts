import { prisma } from "@/lib/prisma";
import { checkLiveTitle } from "@/lib/registerTitle";
import { registerDisplayName } from "@/lib/registerName";
import { fetchPublicRegister, type PublicRegister } from "@/lib/registers";
import type { VerificationBadge } from "@/lib/verificationBadge";

// What a register looks like to someone who is NOT her and NOT an admin.
// Each shape is built field by field from what that page renders, never by
// spreading a row, so a column added to the database can't reach the public
// by accident. Owners and admins keep the full records.
//
// Never public, on any of these: her surname, her location, her due date (a
// derived stage line or label is sent instead), her address mode, consent
// fields, timestamps, assigned donors' names, or a draft register.

// ── Who is asking ───────────────────────────────────────────────────────────

// Admin is read from the database, not the token, as requireAdmin does: a
// demoted admin's old token must not keep full access.
export async function isAdminUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return u?.role === "ADMIN";
}

const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] || name;

// The one way a public shape names a register: the title through the check
// (with her full name, for the surname rule), then lib/registerName. The raw
// title never leaves; only this name (and, in search, the checked title).
export function publicDisplayName(title: string | null | undefined, motherName: string): string {
  return registerDisplayName(firstNameOf(motherName), checkLiveTitle(title, motherName));
}

// ── Derived dates (instead of the due date itself): lib/dueLabel ──────────

export { stageLine, browseDueLabel, isDueSoon, DUE_SOON_DAYS } from "@/lib/dueLabel";
import { stageLine, browseDueLabel, isDueSoon } from "@/lib/dueLabel";

// ── Search ──────────────────────────────────────────────────────────────────

export type SearchRegister = { id: string; firstName: string; title: string | null; city: string; displayName: string };

// A register matches on its title only when the title passes the check, so a
// search for, say, her surname can't find her through a title we would hide.
// It can also match on her city (shown publicly on her share page) or her
// FIRST name. Never on the rest of her name, so a surname finds nothing.
export function toSearchRegister(
  r: { id: string; title: string; city: string; creator: { name: string } }, q: string,
): SearchRegister | null {
  const title = checkLiveTitle(r.title, r.creator.name);
  const firstName = firstNameOf(r.creator.name);
  const needle = q.toLocaleLowerCase();
  const titleMatch = title !== null && r.title.toLocaleLowerCase().includes(needle);
  const cityMatch = r.city.toLocaleLowerCase().includes(needle);
  const nameMatch = firstName.toLocaleLowerCase().includes(needle);
  if (!titleMatch && !cityMatch && !nameMatch) return null;
  return { id: r.id, firstName, title, city: r.city, displayName: registerDisplayName(firstName, title) };
}

// ── Search: Discover items ──────────────────────────────────────────────────

// An item result names its donor by FIRST name only: no full name, id, email
// or avatar. verified is the yes/no the search page shows as a tick.
export type SearchItem = {
  id: string; title: string; category: string; condition: string; location: string;
  images: string[]; createdAt: Date; donor: { firstName: string; verified: boolean };
};
export function toSearchItem(i: {
  id: string; title: string; category: string; condition: string; location: string; images: string[]; createdAt: Date;
  donor: { name: string; verificationLevel: number | null };
}): SearchItem {
  return {
    id: i.id, title: i.title, category: i.category, condition: i.condition, location: i.location,
    images: i.images, createdAt: i.createdAt,
    donor: { firstName: firstNameOf(i.donor.name), verified: (i.donor.verificationLevel ?? 0) >= 1 },
  };
}

// ── The share page /r/[id] ──────────────────────────────────────────────────

export type SharePageItem = {
  id: string; name: string; category: string; quantity: string;
  standardPriceCents: number; totalFundedCents: number; fundingStatus: string;
  contributorCount: number; imageUrl: string | null;
};
export type SharePageRegister = {
  id: string; firstName: string; displayName: string; city: string; status: string; intro: string | null;
  stageLine: string; verificationBadge: VerificationBadge; items: SharePageItem[];
};

// Only what PublicRegisterClient renders: the display name rather than the
// raw title, a stage line rather than the due date, no item notes. motherName
// (her full name) is used for the title's surname rule only and not returned.
export function toSharePageRegister(r: PublicRegister, motherName: string, now = new Date()): SharePageRegister {
  return {
    id: r.id, firstName: r.firstName, displayName: publicDisplayName(r.title, motherName),
    city: r.city, status: r.status, intro: r.intro,
    stageLine: stageLine(new Date(r.dueDate), now), verificationBadge: r.verificationBadge,
    items: r.items.map((i) => ({
      id: i.id, name: i.name, category: i.category, quantity: i.quantity,
      standardPriceCents: i.standardPriceCents, totalFundedCents: i.totalFundedCents, fundingStatus: i.fundingStatus,
      contributorCount: i.contributorCount, imageUrl: i.imageUrl,
    })),
  };
}

// ── GET /api/registers/[id] for everyone but her and admins ─────────────────

type RegisterRow = {
  id: string; title: string; city: string; dueDate: Date; intro: string | null; status: string;
  creator: { id: string; name: string; verificationBadge: VerificationBadge };
  items: {
    id: string; name: string; category: string; quantity: string; status: string;
    standardPriceCents: number; totalFundedCents: number; fundingStatus: string;
    _count: { funding: number }; catalogItem: { imageUrl: string | null } | null;
  }[];
};

// Only what the register page renders for a donor. creator.name carries her
// FIRST name only (the page reads it as a first name); creator.id stays so the
// page can tell she isn't the viewer. The title reaches it only through
// displayName.
export function toPublicRegisterView(r: RegisterRow, now = new Date()) {
  return {
    id: r.id, displayName: publicDisplayName(r.title, r.creator.name), city: r.city, intro: r.intro, status: r.status,
    stageLine: stageLine(r.dueDate, now),
    creator: { id: r.creator.id, name: firstNameOf(r.creator.name), verificationBadge: r.creator.verificationBadge },
    items: r.items.filter((i) => i.status !== "PENDING_APPROVAL").map((i) => ({
      id: i.id, name: i.name, category: i.category, quantity: i.quantity, status: i.status,
      standardPriceCents: i.standardPriceCents, totalFundedCents: i.totalFundedCents, fundingStatus: i.fundingStatus,
      _count: { funding: i._count.funding }, catalogItem: i.catalogItem ? { imageUrl: i.catalogItem.imageUrl } : null,
    })),
  };
}

// ── GET /api/registers/saved: other mothers' registers, for a donor ─────────

export function toSavedRegister(r: { id: string; title: string; city: string; dueDate: Date; creator: { name: string } }, now = new Date()) {
  return {
    id: r.id, displayName: publicDisplayName(r.title, r.creator.name), city: r.city,
    dueLabel: browseDueLabel(r.dueDate, now), creator: { firstName: firstNameOf(r.creator.name) },
  };
}

// ── GET /api/registers (browse) for everyone but her and admins ─────────────

type ListRow = {
  id: string; title: string; city: string; dueDate: Date;
  creator: { id: string; name: string };
  items: {
    id: string; name: string; quantity: string; status: string; fundingStatus: string;
    standardPriceCents: number; totalFundedCents: number;
    _count: { funding: number }; catalogItem: { imageUrl: string | null } | null;
  }[];
};

// Only what the browse page renders.
export function toPublicListRegister(r: ListRow, savedItemIds: Set<string>, now = new Date()) {
  return {
    id: r.id, displayName: publicDisplayName(r.title, r.creator.name), city: r.city,
    dueLabel: browseDueLabel(r.dueDate, now), dueSoon: isDueSoon(r.dueDate, now),
    creator: { firstName: firstNameOf(r.creator.name) },
    items: r.items.map((i) => ({
      id: i.id, name: i.name, quantity: i.quantity, status: i.status, fundingStatus: i.fundingStatus,
      standardPriceCents: i.standardPriceCents, totalFundedCents: i.totalFundedCents,
      _count: { funding: i._count.funding }, catalogItem: i.catalogItem ? { imageUrl: i.catalogItem.imageUrl } : null,
      savedByMe: savedItemIds.has(i.id),
    })),
  };
}

// ── The share page's read ───────────────────────────────────────────────────

// fetchPublicRegister plus her full name (for the title check only), shaped
// for the page. null when the register isn't public.
export async function fetchSharePageRegister(id: string): Promise<SharePageRegister | null> {
  const [pub, owner] = await Promise.all([
    fetchPublicRegister(id),
    prisma.register.findUnique({ where: { id }, select: { creator: { select: { name: true } } } }),
  ]);
  return pub && owner ? toSharePageRegister(pub, owner.creator.name) : null;
}
