import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PUBLISH_REFUSED } from "@/lib/registerItemRules";

export const dynamic = "force-dynamic";

// Publish a draft register: DRAFT → ACTIVE. Owner only. Needs at least one
// item that isn't cancelled; a custom item still awaiting approval counts (it
// stays hidden from donors until approved, as before). After this, items
// can't be added (lib/registerItemRules).
//
// Locks the register row, as the item add does, so a publish and an add
// can't interleave.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ creatorId: string; status: string }[]>`
      SELECT "creatorId", "status"::text AS "status" FROM "Register" WHERE "id" = ${id} FOR UPDATE`;
    if (locked.length === 0) return { status: 404, error: "Not found" };
    if (locked[0].creatorId !== auth.userId) return { status: 403, error: "Forbidden" };
    if (locked[0].status !== "DRAFT") return { status: 400, error: PUBLISH_REFUSED.NOT_DRAFT, code: "NOT_DRAFT" };
    const items = await tx.registerItem.count({ where: { registerId: id, status: { not: "CANCELLED" } } });
    if (items === 0) return { status: 400, error: PUBLISH_REFUSED.NO_ITEMS, code: "NO_ITEMS" };
    await tx.register.update({ where: { id }, data: { status: "ACTIVE" } });
    return { status: 200 };
  });

  if (result.status !== 200) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ ok: true, status: "ACTIVE" });
}
