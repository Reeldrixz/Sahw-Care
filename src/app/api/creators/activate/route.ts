import { NextRequest, NextResponse } from "next/server";
import { getTokenFromRequest, verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { ensureCreatorCode } from "@/lib/creators";

export const dynamic = "force-dynamic";

// Activate the current user as an Impact Creator. Requires explicit Code of
// Conduct acceptance; stores creatorCodeAcceptedAt and issues a link code.
export async function POST(req: NextRequest) {
  const token = await getTokenFromRequest(req);
  const auth  = token ? await verifyToken(token) : null;
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`creator-activate:${getClientIp(req)}`, 10, 60 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ error: "Too many requests." }, { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 300) } });

  const { accepted } = await req.json().catch(() => ({ accepted: false }));
  if (accepted !== true) {
    return NextResponse.json({ error: "You must accept the Creator Code of Conduct to activate." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: auth.userId }, select: { creatorCodeAcceptedAt: true } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.user.update({
    where: { id: auth.userId },
    data:  { isCreator: true, creatorCodeAcceptedAt: user.creatorCodeAcceptedAt ?? new Date() },
  });
  const creatorReferralCode = await ensureCreatorCode(auth.userId);

  return NextResponse.json({ ok: true, creatorReferralCode });
}
