import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Public: increment a creator's link-visit counter. Rate-limited per IP so a
// counter can't be inflated by refresh. Invalid codes are a silent no-op and
// never reveal whether a code exists.
export async function POST(req: NextRequest) {
  const rl = rateLimit(`creator-visit:${getClientIp(req)}`, 60, 5 * 60 * 1000);
  if (!rl.ok) return NextResponse.json({ ok: true }); // don't error the page on a busy IP

  const { ref } = await req.json().catch(() => ({ ref: "" }));
  if (!ref || typeof ref !== "string") return NextResponse.json({ ok: true });

  await prisma.user.updateMany({
    where: { creatorReferralCode: ref.trim(), isCreator: true },
    data:  { creatorLinkVisits: { increment: 1 } },
  });
  return NextResponse.json({ ok: true });
}
