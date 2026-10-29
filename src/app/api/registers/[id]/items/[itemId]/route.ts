import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { removalFactsLocked, removalRefusal, REMOVAL_REFUSED } from "@/lib/registerItemRules";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; itemId: string }> };

// Loads the item and enforces that it belongs to the register in the URL.
// Returns { item } or an error response — every handler goes through this so an
// itemId from a different register can never be read or mutated via another
// register's id (object-level authorization / IDOR guard).
async function loadScopedItem(id: string, itemId: string) {
  const item = await prisma.registerItem.findUnique({
    where: { id: itemId },
    include: {
      register: { include: { creator: { select: { id: true, name: true } } } },
      assignment: {
        include: {
          donor: { select: { id: true, name: true } },
          messages: {
            orderBy: { createdAt: "asc" },
            include: { sender: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });
  if (!item || item.registerId !== id) return null;
  return item;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id, itemId } = await params;
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await loadScopedItem(id, itemId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the register owner (mom) or the assigned donor may read the item's
  // coordination detail (which includes private assignment messages).
  const isMom = item.register.creatorId === auth.userId;
  const isDonor = item.assignment?.donorId === auth.userId;
  if (!isMom && !isDonor) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id, itemId } = await params;
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await loadScopedItem(id, itemId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.register.creatorId !== auth.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, quantity, note, storeLinks } = await req.json();
  const updated = await prisma.registerItem.update({
    where: { id: itemId },
    data: {
      ...(name && { name }),
      ...(quantity && { quantity }),
      ...(note !== undefined && { note }),
      ...(storeLinks && { storeLinks }),
    },
  });

  return NextResponse.json({ item: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, itemId } = await params;
  const token = await getTokenFromRequest(req);
  const auth = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const item = await loadScopedItem(id, itemId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.register.creatorId !== auth.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // lib/registerItemRules: never anything with a payment attached; on a live
  // register, nothing reserved, being ordered, in progress, in a live event or
  // on a register that unlocked a bundle. Checked under a lock on the item row,
  // in the same transaction as the delete.
  const refusal = await prisma.$transaction(async (tx) => {
    const facts = await removalFactsLocked(tx, itemId);
    if (!facts) return "GONE" as const;
    const why = removalRefusal(facts);
    if (why) return why;
    await tx.registerItem.delete({ where: { id: itemId } });
    return null;
  });
  if (refusal === "GONE") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (refusal) return NextResponse.json({ error: REMOVAL_REFUSED[refusal], code: refusal }, { status: 400 });
  return NextResponse.json({ ok: true });
}
