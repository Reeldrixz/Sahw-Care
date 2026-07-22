import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Set the caller's referredByUserId to the creator behind a link code. Set
// ONCE, right after signup. Never overwrites an existing attribution; never
// attributes a user to themselves.
export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`creator-attribute:${getClientIp(req)}`, 20, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ ok: false }, { status: 429 });

  const { ref } = await req.json().catch(() => ({ ref: "" }));
  if (!ref || typeof ref !== "string") return NextResponse.json({ ok: false });

  const me = await prisma.user.findUnique({ where: { id: auth.userId }, select: { referredByUserId: true } });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (me.referredByUserId) return NextResponse.json({ ok: true, already: true }); // set once

  const creator = await prisma.user.findFirst({
    where:  { creatorReferralCode: ref.trim(), isCreator: true },
    select: { id: true },
  });
  if (!creator || creator.id === auth.userId) return NextResponse.json({ ok: false });

  await prisma.user.update({ where: { id: auth.userId }, data: { referredByUserId: creator.id } });
  return NextResponse.json({ ok: true });
}
